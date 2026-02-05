/**
 * Learning Service
 * Handles Agent learning, persona evolution, and learningRoot computation
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { ethers } from 'ethers';
import {
  LearningSnapshot,
  LearningHistory,
  PersonaVector,
  Memory,
  DEFAULT_PERSONA,
} from '../types/chat.js';
import { getVaultService } from './vault.js';
import { getMemoryService, MemoryService } from './memory.js';
import { getPromptEngine, PromptEngine } from './prompt.js';
import { hashString, hashConcat } from '../utils/hash.js';

// Contract ABI for updateLearning
const AGENT_ABI = [
  'function updateLearning(uint256 tokenId, bytes32 learningRoot, uint256 version) external',
  'function getAgentMetadata(uint256 tokenId) view returns (tuple(string persona, string experience, string vaultURI, bytes32 vaultHash, bytes32 learningRoot, uint256 learningVersion, uint256 lastLearningUpdate))',
];

export class LearningService {
  private db: Database.Database;
  private memoryService: MemoryService;
  private promptEngine: PromptEngine;
  private syncThreshold: number;
  private autoSync: boolean;

  constructor() {
    this.db = getVaultService().getDatabase();
    this.memoryService = getMemoryService();
    this.promptEngine = getPromptEngine();
    this.syncThreshold = parseInt(process.env.LEARNING_SYNC_THRESHOLD || '10', 10);
    this.autoSync = process.env.LEARNING_AUTO_SYNC === 'true';
  }

  /**
   * Compute accumulated persona delta from all sessions since last snapshot
   * 使用存储的 persona_impact 数据进行更准确的计算
   */
  computePersonaDelta(tokenId: number): PersonaVector {
    // Get last snapshot
    const lastSnapshot = this.getLatestSnapshot(tokenId);
    const lastCreatedAt = lastSnapshot?.createdAt;

    // 获取上次快照之后的所有已结束会话（包含 persona_impact）
    let sessionsQuery = `
      SELECT persona_impact FROM chat_sessions
      WHERE token_id = ? AND ended_at IS NOT NULL
    `;
    const params: (number | string)[] = [tokenId];

    if (lastCreatedAt) {
      sessionsQuery += ` AND ended_at > ?`;
      params.push(lastCreatedAt);
    }

    sessionsQuery += ` ORDER BY ended_at ASC`;

    const stmt = this.db.prepare(sessionsQuery);
    const sessions = stmt.all(...params) as { persona_impact: string | null }[];

    // 从之前的快照开始累积
    const delta: PersonaVector = {
      calm: 0,
      curious: 0,
      bold: 0,
      social: 0,
      disciplined: 0,
    };

    // 应用之前快照的累积 delta
    if (lastSnapshot) {
      try {
        const prevDelta = typeof lastSnapshot.personaDelta === 'string'
          ? JSON.parse(lastSnapshot.personaDelta)
          : lastSnapshot.personaDelta;
        delta.calm = prevDelta.calm || 0;
        delta.curious = prevDelta.curious || 0;
        delta.bold = prevDelta.bold || 0;
        delta.social = prevDelta.social || 0;
        delta.disciplined = prevDelta.disciplined || 0;
      } catch (e) {
        // Ignore parse errors
      }
    }

    // 累加每次会话的性格影响
    for (const session of sessions) {
      if (session.persona_impact) {
        try {
          const impact = JSON.parse(session.persona_impact) as Partial<PersonaVector>;
          for (const key of Object.keys(delta) as (keyof PersonaVector)[]) {
            if (impact[key] !== undefined) {
              delta[key] += impact[key]!;
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    // 基础增量：有对话就略微增加社交性
    if (sessions.length > 0) {
      delta.social += Math.min(0.02, sessions.length * 0.005);
    }

    // Clamp values to [-1, 1]
    for (const key of Object.keys(delta) as (keyof PersonaVector)[]) {
      delta[key] = Math.max(-1, Math.min(1, delta[key]));
    }

    return delta;
  }

  /**
   * Create a learning snapshot
   */
  createSnapshot(tokenId: number): LearningSnapshot {
    const id = uuidv4();
    const now = new Date().toISOString();

    // Get next version
    const version = this.getNextVersion(tokenId);

    // Compute persona delta
    const personaDelta = this.computePersonaDelta(tokenId);

    // Compute memories hash
    const memoriesHash = this.memoryService.computeMemoriesHash(tokenId);

    // Get all memories for summary
    const memories = this.memoryService.getAllForHash(tokenId);

    // Generate summary
    const summary = this.promptEngine.generateLearningSummary(memories, personaDelta);

    // Compute learning root
    const learningRoot = this.computeLearningRoot(tokenId, memoriesHash, summary);

    // Store snapshot
    const stmt = this.db.prepare(`
      INSERT INTO learning_snapshots (
        id, token_id, version, persona_delta, memories_hash,
        summary, learning_root, created_at, synced_to_chain
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);
    stmt.run(
      id,
      tokenId,
      version,
      JSON.stringify(personaDelta),
      memoriesHash,
      summary,
      learningRoot,
      now
    );

    return {
      id,
      tokenId,
      version,
      personaDelta,
      memoriesHash,
      summary,
      learningRoot,
      createdAt: now,
      syncedToChain: false,
    };
  }

  /**
   * Compute learningRoot from components
   */
  private computeLearningRoot(tokenId: number, memoriesHash: string, summary: string): string {
    // Get vault hash
    const vault = getVaultService().getByTokenId(tokenId);
    const vaultHash = vault ? hashString(JSON.stringify({
      traits: vault.traits,
      tokenId: vault.tokenId,
    })) : hashString(`token-${tokenId}`);

    // summaryHash
    const summaryHash = hashString(summary);

    // learningRoot = keccak256(vaultHash + memoriesHash + summaryHash)
    return hashConcat(vaultHash, memoriesHash, summaryHash);
  }

  /**
   * Get next version number for a token
   */
  private getNextVersion(tokenId: number): number {
    const stmt = this.db.prepare(`
      SELECT MAX(version) as max_version FROM learning_snapshots WHERE token_id = ?
    `);
    const result = stmt.get(tokenId) as { max_version: number | null };
    return (result.max_version || 0) + 1;
  }

  /**
   * Get latest snapshot for a token
   */
  getLatestSnapshot(tokenId: number): LearningSnapshot | null {
    const stmt = this.db.prepare(`
      SELECT * FROM learning_snapshots
      WHERE token_id = ?
      ORDER BY version DESC
      LIMIT 1
    `);
    const row = stmt.get(tokenId) as any;
    if (!row) return null;

    return this.rowToSnapshot(row);
  }

  /**
   * Get snapshot by version
   */
  getSnapshot(tokenId: number, version: number): LearningSnapshot | null {
    const stmt = this.db.prepare(`
      SELECT * FROM learning_snapshots
      WHERE token_id = ? AND version = ?
    `);
    const row = stmt.get(tokenId, version) as any;
    if (!row) return null;

    return this.rowToSnapshot(row);
  }

  /**
   * Get learning history for a token
   */
  getHistory(tokenId: number): LearningHistory {
    const stmt = this.db.prepare(`
      SELECT * FROM learning_snapshots
      WHERE token_id = ?
      ORDER BY version DESC
    `);
    const rows = stmt.all(tokenId) as any[];

    const snapshots = rows.map(this.rowToSnapshot);
    const latest = snapshots[0];

    // Get current persona
    let currentPersona = { ...DEFAULT_PERSONA };
    if (latest) {
      try {
        const delta = typeof latest.personaDelta === 'string'
          ? JSON.parse(latest.personaDelta)
          : latest.personaDelta;
        for (const key of Object.keys(currentPersona) as (keyof PersonaVector)[]) {
          currentPersona[key] = Math.max(-1, Math.min(1, (delta[key] || 0)));
        }
      } catch (e) {
        // Use default
      }
    }

    return {
      tokenId,
      currentVersion: latest?.version || 0,
      totalMemories: this.memoryService.getCount(tokenId),
      currentPersona,
      snapshots,
    };
  }

  /**
   * Sync learning root to blockchain
   */
  async syncToChain(tokenId: number, version: number, privateKey?: string): Promise<string> {
    const snapshot = this.getSnapshot(tokenId, version);
    if (!snapshot) {
      throw new Error(`Snapshot not found: tokenId=${tokenId}, version=${version}`);
    }

    if (snapshot.syncedToChain) {
      throw new Error('Snapshot already synced to chain');
    }

    // Get signer
    const rpcUrl = process.env.RPC_URL || 'https://bsc-dataseed1.binance.org';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    let signer: ethers.Wallet;
    if (privateKey) {
      signer = new ethers.Wallet(privateKey, provider);
    } else if (process.env.SERVER_PRIVATE_KEY) {
      signer = new ethers.Wallet(process.env.SERVER_PRIVATE_KEY, provider);
    } else {
      throw new Error('No private key provided for chain sync');
    }

    // Get contract
    const agentAddress = process.env.HOUSEFORGE_AGENT_ADDRESS;
    if (!agentAddress) {
      throw new Error('HOUSEFORGE_AGENT_ADDRESS not configured');
    }

    const contract = new ethers.Contract(agentAddress, AGENT_ABI, signer);

    // Call updateLearning
    const tx = await contract.updateLearning(
      tokenId,
      snapshot.learningRoot,
      version
    );

    const receipt = await tx.wait();

    // Update snapshot as synced
    const updateStmt = this.db.prepare(`
      UPDATE learning_snapshots SET synced_to_chain = 1 WHERE id = ?
    `);
    updateStmt.run(snapshot.id);

    return receipt.hash;
  }

  /**
   * Check if snapshot should be created (based on new memories threshold)
   */
  shouldCreateSnapshot(tokenId: number): boolean {
    const lastSnapshot = this.getLatestSnapshot(tokenId);
    const lastCreatedAt = lastSnapshot?.createdAt;

    // Count memories since last snapshot
    const memoryCount = this.memoryService.getCount(tokenId);

    // Get memories created after last snapshot
    if (lastCreatedAt) {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM agent_memories
        WHERE token_id = ? AND created_at > ?
      `);
      const result = stmt.get(tokenId, lastCreatedAt) as { count: number };
      return result.count >= this.syncThreshold;
    }

    // First snapshot if has enough memories
    return memoryCount >= this.syncThreshold;
  }

  /**
   * Maybe create snapshot if threshold met
   */
  maybeCreateSnapshot(tokenId: number): LearningSnapshot | null {
    if (this.shouldCreateSnapshot(tokenId)) {
      return this.createSnapshot(tokenId);
    }
    return null;
  }

  /**
   * Convert database row to LearningSnapshot
   */
  private rowToSnapshot(row: any): LearningSnapshot {
    let personaDelta: PersonaVector;
    try {
      personaDelta = typeof row.persona_delta === 'string'
        ? JSON.parse(row.persona_delta)
        : row.persona_delta;
    } catch (e) {
      personaDelta = { ...DEFAULT_PERSONA };
    }

    return {
      id: row.id,
      tokenId: row.token_id,
      version: row.version,
      personaDelta,
      memoriesHash: row.memories_hash,
      summary: row.summary,
      learningRoot: row.learning_root,
      createdAt: row.created_at,
      syncedToChain: Boolean(row.synced_to_chain),
    };
  }
}

// Singleton instance
let learningServiceInstance: LearningService | null = null;

export function getLearningService(): LearningService {
  if (!learningServiceInstance) {
    learningServiceInstance = new LearningService();
  }
  return learningServiceInstance;
}
