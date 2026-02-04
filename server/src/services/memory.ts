/**
 * Memory Service
 * Manages Agent memories with storage, retrieval, and consolidation
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { Memory, MemoryInput, MemoryType } from '../types/chat.js';
import { getVaultService } from './vault.js';
import { hashString } from '../utils/hash.js';

export class MemoryService {
  private db: Database.Database;
  private maxMemoriesPerAgent: number;

  constructor(db?: Database.Database) {
    this.db = db || getVaultService().getDatabase();
    this.maxMemoriesPerAgent = parseInt(process.env.MEMORY_MAX_COUNT || '1000', 10);
  }

  /**
   * Store a new memory
   */
  store(tokenId: number, input: MemoryInput): Memory {
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO agent_memories (
        id, token_id, memory_type, content, importance,
        created_at, last_accessed, access_count, source_session_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      tokenId,
      input.memoryType,
      input.content,
      input.importance ?? 0.5,
      now,
      now,
      0,
      input.sourceSessionId || null
    );

    // Check if we need to consolidate
    this.maybeConsolidate(tokenId);

    return {
      id,
      tokenId,
      memoryType: input.memoryType,
      content: input.content,
      importance: input.importance ?? 0.5,
      createdAt: now,
      lastAccessed: now,
      accessCount: 0,
      sourceSessionId: input.sourceSessionId,
    };
  }

  /**
   * Store multiple memories at once
   */
  storeBatch(tokenId: number, inputs: MemoryInput[]): Memory[] {
    const memories: Memory[] = [];

    const insertStmt = this.db.prepare(`
      INSERT INTO agent_memories (
        id, token_id, memory_type, content, importance,
        created_at, last_accessed, access_count, source_session_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items: MemoryInput[]) => {
      const now = new Date().toISOString();

      for (const input of items) {
        const id = uuidv4();
        insertStmt.run(
          id,
          tokenId,
          input.memoryType,
          input.content,
          input.importance ?? 0.5,
          now,
          now,
          0,
          input.sourceSessionId || null
        );

        memories.push({
          id,
          tokenId,
          memoryType: input.memoryType,
          content: input.content,
          importance: input.importance ?? 0.5,
          createdAt: now,
          lastAccessed: now,
          accessCount: 0,
          sourceSessionId: input.sourceSessionId,
        });
      }
    });

    insertMany(inputs);

    // Check if we need to consolidate
    this.maybeConsolidate(tokenId);

    return memories;
  }

  /**
   * Retrieve memories by token ID
   */
  getByTokenId(tokenId: number, limit: number = 50): Memory[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_memories
      WHERE token_id = ?
      ORDER BY importance DESC, created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(tokenId, limit) as any[];
    return rows.map(this.rowToMemory);
  }

  /**
   * Retrieve memories by type
   */
  getByType(tokenId: number, memoryType: MemoryType, limit: number = 20): Memory[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_memories
      WHERE token_id = ? AND memory_type = ?
      ORDER BY importance DESC, created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(tokenId, memoryType, limit) as any[];
    return rows.map(this.rowToMemory);
  }

  /**
   * Search memories by keyword (simple text match)
   */
  search(tokenId: number, query: string, limit: number = 10): Memory[] {
    // Update access count and last accessed for matching memories
    const searchPattern = `%${query}%`;

    const stmt = this.db.prepare(`
      SELECT * FROM agent_memories
      WHERE token_id = ? AND content LIKE ?
      ORDER BY importance DESC, created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(tokenId, searchPattern, limit) as any[];
    const memories = rows.map(this.rowToMemory);

    // Update access tracking
    if (memories.length > 0) {
      const updateStmt = this.db.prepare(`
        UPDATE agent_memories
        SET access_count = access_count + 1, last_accessed = ?
        WHERE id = ?
      `);
      const now = new Date().toISOString();
      for (const m of memories) {
        updateStmt.run(now, m.id);
      }
    }

    return memories;
  }

  /**
   * Retrieve relevant memories for a conversation context
   * Combines keyword matching and importance-based selection
   */
  retrieve(tokenId: number, context: string, limit: number = 10): Memory[] {
    // Extract keywords from context
    const keywords = this.extractKeywords(context);
    const memories: Memory[] = [];
    const seenIds = new Set<string>();

    // Get memories matching keywords
    for (const keyword of keywords.slice(0, 5)) {
      const matched = this.search(tokenId, keyword, 3);
      for (const m of matched) {
        if (!seenIds.has(m.id)) {
          seenIds.add(m.id);
          memories.push(m);
        }
      }
    }

    // Fill with high-importance memories if needed
    if (memories.length < limit) {
      const topMemories = this.getByTokenId(tokenId, limit - memories.length + 5);
      for (const m of topMemories) {
        if (!seenIds.has(m.id) && memories.length < limit) {
          seenIds.add(m.id);
          memories.push(m);
        }
      }
    }

    // Sort by importance
    memories.sort((a, b) => b.importance - a.importance);

    return memories.slice(0, limit);
  }

  /**
   * Update memory importance
   */
  updateImportance(memoryId: string, importance: number): void {
    const stmt = this.db.prepare(`
      UPDATE agent_memories
      SET importance = ?
      WHERE id = ?
    `);
    stmt.run(Math.max(0, Math.min(1, importance)), memoryId);
  }

  /**
   * Delete a memory
   */
  delete(memoryId: string): void {
    const stmt = this.db.prepare('DELETE FROM agent_memories WHERE id = ?');
    stmt.run(memoryId);
  }

  /**
   * Get memory count for a token
   */
  getCount(tokenId: number): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM agent_memories WHERE token_id = ?');
    const result = stmt.get(tokenId) as { count: number };
    return result.count;
  }

  /**
   * Get all memories for a token (for hash computation)
   */
  getAllForHash(tokenId: number): Memory[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_memories
      WHERE token_id = ?
      ORDER BY created_at ASC
    `);

    const rows = stmt.all(tokenId) as any[];
    return rows.map(this.rowToMemory);
  }

  /**
   * Compute Merkle root of all memories for a token
   */
  computeMemoriesHash(tokenId: number): string {
    const memories = this.getAllForHash(tokenId);

    if (memories.length === 0) {
      return hashString('empty');
    }

    // Hash each memory
    const hashes = memories.map(m => hashString(JSON.stringify({
      type: m.memoryType,
      content: m.content,
      importance: m.importance,
    })));

    // Simple Merkle root (concat and hash pairs)
    let currentLevel = hashes;
    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          nextLevel.push(hashString(currentLevel[i] + currentLevel[i + 1]));
        } else {
          nextLevel.push(currentLevel[i]);
        }
      }
      currentLevel = nextLevel;
    }

    return currentLevel[0];
  }

  /**
   * Consolidate memories (remove low-importance, rarely accessed ones)
   */
  consolidate(tokenId: number): number {
    const count = this.getCount(tokenId);
    if (count <= this.maxMemoriesPerAgent) return 0;

    const toRemove = count - Math.floor(this.maxMemoriesPerAgent * 0.8);

    // Calculate score for each memory: importance * 0.6 + access_frequency * 0.4
    // Remove lowest scoring ones
    const stmt = this.db.prepare(`
      DELETE FROM agent_memories
      WHERE id IN (
        SELECT id FROM agent_memories
        WHERE token_id = ?
        ORDER BY (importance * 0.6 + (access_count * 1.0 / (julianday('now') - julianday(created_at) + 1)) * 0.4) ASC
        LIMIT ?
      )
    `);

    const result = stmt.run(tokenId, toRemove);
    return result.changes;
  }

  /**
   * Maybe consolidate if over limit
   */
  private maybeConsolidate(tokenId: number): void {
    const count = this.getCount(tokenId);
    if (count > this.maxMemoriesPerAgent * 1.1) {
      this.consolidate(tokenId);
    }
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    // Remove common Chinese particles and punctuation
    const cleaned = text
      .replace(/[的是了在有和与或但如果那么这个那个我你他她它们]/g, ' ')
      .replace(/[，。！？、：；""''（）【】《》\s]+/g, ' ');

    // Split and filter
    const words = cleaned.split(' ').filter(w => w.length >= 2);

    // Dedupe and limit
    return [...new Set(words)].slice(0, 10);
  }

  /**
   * Convert database row to Memory
   */
  private rowToMemory(row: any): Memory {
    return {
      id: row.id,
      tokenId: row.token_id,
      memoryType: row.memory_type as MemoryType,
      content: row.content,
      importance: row.importance,
      createdAt: row.created_at,
      lastAccessed: row.last_accessed,
      accessCount: row.access_count,
      sourceSessionId: row.source_session_id,
    };
  }
}

// Singleton instance
let memoryServiceInstance: MemoryService | null = null;

export function getMemoryService(): MemoryService {
  if (!memoryServiceInstance) {
    memoryServiceInstance = new MemoryService();
  }
  return memoryServiceInstance;
}
