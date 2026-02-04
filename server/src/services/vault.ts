import Database from 'better-sqlite3';
import path from 'path';
import { computeVaultHash, computeLearningRoot } from '../utils/hash.js';
import stableStringify from 'json-stable-stringify';
import { v4 as uuidv4 } from 'uuid';

// Types
export interface VaultData {
  id: string;
  tokenId: number | null;
  parentAId: number | null;
  parentBId: number | null;
  parentALearningRoot: string | null;
  parentBLearningRoot: string | null;
  fusionVersion: string;
  seed: string;
  traits: Record<string, string>;
  personaDelta: Record<string, number>;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface VaultCreateInput {
  tokenId?: number;
  parentAId?: number;
  parentBId?: number;
  parentALearningRoot?: string;
  parentBLearningRoot?: string;
  fusionVersion?: string;
  seed?: string;
  traits: Record<string, string>;
  personaDelta?: Record<string, number>;
  summary?: string;
}

export interface VaultCreateResult {
  vaultId: string;
  vaultURI: string;
  vaultHash: string;
  learningRoot: string;
}

// Vault Service class
export class VaultService {
  private db: Database.Database;
  private baseUrl: string;

  constructor(dbPath?: string, baseUrl?: string) {
    const resolvedPath = dbPath || path.resolve(__dirname, '../../../data/vault.db');

    // Ensure data directory exists
    const dir = path.dirname(resolvedPath);
    const fs = require('fs');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(resolvedPath);
    this.baseUrl = baseUrl || 'http://localhost:3001';
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vaults (
        id TEXT PRIMARY KEY,
        token_id INTEGER,
        parent_a_id INTEGER,
        parent_b_id INTEGER,
        parent_a_learning_root TEXT,
        parent_b_learning_root TEXT,
        fusion_version TEXT,
        seed TEXT,
        traits TEXT NOT NULL,
        persona_delta TEXT,
        summary TEXT,
        vault_hash TEXT NOT NULL,
        learning_root TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_vaults_token_id ON vaults(token_id);
      CREATE INDEX IF NOT EXISTS idx_vaults_vault_hash ON vaults(vault_hash);

      -- Chat sessions table
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        token_id INTEGER NOT NULL,
        user_address TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        message_count INTEGER DEFAULT 0,
        summary TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_token ON chat_sessions(token_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON chat_sessions(user_address);

      -- Chat messages table
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        token_count INTEGER,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id);

      -- Agent memories table
      CREATE TABLE IF NOT EXISTS agent_memories (
        id TEXT PRIMARY KEY,
        token_id INTEGER NOT NULL,
        memory_type TEXT NOT NULL,
        content TEXT NOT NULL,
        importance REAL DEFAULT 0.5,
        created_at TEXT NOT NULL,
        last_accessed TEXT,
        access_count INTEGER DEFAULT 0,
        source_session_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_memories_token ON agent_memories(token_id);
      CREATE INDEX IF NOT EXISTS idx_memories_type ON agent_memories(memory_type);

      -- Learning snapshots table
      CREATE TABLE IF NOT EXISTS learning_snapshots (
        id TEXT PRIMARY KEY,
        token_id INTEGER NOT NULL,
        version INTEGER NOT NULL,
        persona_delta TEXT NOT NULL,
        memories_hash TEXT NOT NULL,
        summary TEXT NOT NULL,
        learning_root TEXT NOT NULL,
        created_at TEXT NOT NULL,
        synced_to_chain INTEGER DEFAULT 0,
        UNIQUE(token_id, version)
      );

      CREATE INDEX IF NOT EXISTS idx_snapshots_token ON learning_snapshots(token_id);
    `);
  }

  /**
   * Create a new vault entry
   */
  create(input: VaultCreateInput): VaultCreateResult {
    const id = uuidv4();
    const now = new Date().toISOString();

    // Build vault JSON for hashing
    const vaultJson = {
      id,
      tokenId: input.tokenId || null,
      parentAId: input.parentAId || null,
      parentBId: input.parentBId || null,
      parentALearningRoot: input.parentALearningRoot || null,
      parentBLearningRoot: input.parentBLearningRoot || null,
      fusionVersion: input.fusionVersion || '1.0.0',
      seed: input.seed || '',
      traits: input.traits,
      personaDelta: input.personaDelta || {},
      createdAt: now,
    };

    // Compute hashes
    const vaultHash = computeVaultHash(vaultJson);
    const summary = input.summary || this.generateSummary(input);
    const learningRoot = computeLearningRoot(vaultHash, summary);

    // Store in database
    const stmt = this.db.prepare(`
      INSERT INTO vaults (
        id, token_id, parent_a_id, parent_b_id, parent_a_learning_root, parent_b_learning_root,
        fusion_version, seed, traits, persona_delta, summary, vault_hash, learning_root,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.tokenId || null,
      input.parentAId || null,
      input.parentBId || null,
      input.parentALearningRoot || null,
      input.parentBLearningRoot || null,
      input.fusionVersion || '1.0.0',
      input.seed || '',
      JSON.stringify(input.traits),
      JSON.stringify(input.personaDelta || {}),
      summary,
      vaultHash,
      learningRoot,
      now,
      now
    );

    return {
      vaultId: id,
      vaultURI: `${this.baseUrl}/vault/${id}`,
      vaultHash,
      learningRoot,
    };
  }

  /**
   * Get vault by ID
   */
  getById(id: string): VaultData | null {
    const stmt = this.db.prepare('SELECT * FROM vaults WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return this.rowToVaultData(row);
  }

  /**
   * Get vault by token ID
   */
  getByTokenId(tokenId: number): VaultData | null {
    const stmt = this.db.prepare('SELECT * FROM vaults WHERE token_id = ? ORDER BY created_at DESC LIMIT 1');
    const row = stmt.get(tokenId) as any;

    if (!row) return null;

    return this.rowToVaultData(row);
  }

  /**
   * Get vault by hash
   */
  getByHash(vaultHash: string): VaultData | null {
    const stmt = this.db.prepare('SELECT * FROM vaults WHERE vault_hash = ?');
    const row = stmt.get(vaultHash) as any;

    if (!row) return null;

    return this.rowToVaultData(row);
  }

  /**
   * Update token ID for a vault (after minting)
   */
  setTokenId(vaultId: string, tokenId: number): void {
    const stmt = this.db.prepare('UPDATE vaults SET token_id = ?, updated_at = ? WHERE id = ?');
    stmt.run(tokenId, new Date().toISOString(), vaultId);
  }

  /**
   * Generate summary from vault input
   */
  private generateSummary(input: VaultCreateInput): string {
    const parts: string[] = [];

    if (input.parentAId && input.parentBId) {
      parts.push(`Fusion of #${input.parentAId} and #${input.parentBId}`);
    } else {
      parts.push('Genesis agent');
    }

    const house = input.traits.House;
    if (house) {
      parts.push(`House: ${house}`);
    }

    const rarity = input.traits.RarityTier;
    if (rarity) {
      parts.push(`Rarity: ${rarity}`);
    }

    return parts.join(' | ');
  }

  /**
   * Convert database row to VaultData
   */
  private rowToVaultData(row: any): VaultData {
    return {
      id: row.id,
      tokenId: row.token_id,
      parentAId: row.parent_a_id,
      parentBId: row.parent_b_id,
      parentALearningRoot: row.parent_a_learning_root,
      parentBLearningRoot: row.parent_b_learning_root,
      fusionVersion: row.fusion_version,
      seed: row.seed,
      traits: JSON.parse(row.traits),
      personaDelta: JSON.parse(row.persona_delta),
      summary: row.summary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get the database instance (for other services)
   */
  getDatabase(): Database.Database {
    return this.db;
  }

  /**
   * Get base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

// Singleton instance
let vaultServiceInstance: VaultService | null = null;

export function getVaultService(): VaultService {
  if (!vaultServiceInstance) {
    vaultServiceInstance = new VaultService();
  }
  return vaultServiceInstance;
}
