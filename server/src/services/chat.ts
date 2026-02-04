/**
 * Chat Service
 * Orchestrates AI conversations with personality and memory integration
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  ChatSession,
  ChatMessage,
  ChatResponse,
  SessionSummary,
  AgentProfile,
  AIMessage,
  PersonaVector,
  DEFAULT_PERSONA,
  HOUSE_PERSONALITIES,
} from '../types/chat.js';
import { getVaultService, VaultData } from './vault.js';
import { AIClient, getAIClient } from './ai.js';
import { PromptEngine, getPromptEngine } from './prompt.js';
import { MemoryService, getMemoryService } from './memory.js';

// House ID to name mapping
const HOUSE_NAMES: Record<number, string> = {
  1: 'SOLARA',
  2: 'TEMPEST',
  3: 'MISTRAL',
  4: 'GLACIUS',
  5: 'NIMBUS',
  6: 'TERRUS',
  7: 'AQUORA',
};

export class ChatService {
  private db: Database.Database;
  private aiClient: AIClient;
  private promptEngine: PromptEngine;
  private memoryService: MemoryService;
  private maxContextMessages: number;

  constructor() {
    this.db = getVaultService().getDatabase();
    this.aiClient = getAIClient();
    this.promptEngine = getPromptEngine();
    this.memoryService = getMemoryService();
    this.maxContextMessages = 20;
  }

  /**
   * Create a new chat session
   */
  createSession(tokenId: number, userAddress: string): ChatSession {
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO chat_sessions (id, token_id, user_address, started_at, message_count)
      VALUES (?, ?, ?, ?, 0)
    `);
    stmt.run(id, tokenId, userAddress, now);

    return {
      id,
      tokenId,
      userAddress,
      startedAt: now,
      messageCount: 0,
    };
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ChatSession | null {
    const stmt = this.db.prepare('SELECT * FROM chat_sessions WHERE id = ?');
    const row = stmt.get(sessionId) as any;
    if (!row) return null;

    return {
      id: row.id,
      tokenId: row.token_id,
      userAddress: row.user_address,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      messageCount: row.message_count,
      summary: row.summary,
    };
  }

  /**
   * Get sessions for a token
   */
  getSessionsByToken(tokenId: number, limit: number = 20): ChatSession[] {
    const stmt = this.db.prepare(`
      SELECT * FROM chat_sessions
      WHERE token_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(tokenId, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      tokenId: row.token_id,
      userAddress: row.user_address,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      messageCount: row.message_count,
      summary: row.summary,
    }));
  }

  /**
   * Send a message and get AI response
   */
  async sendMessage(sessionId: string, content: string): Promise<ChatResponse> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.endedAt) {
      throw new Error('Session has ended');
    }

    // Get agent profile
    const profile = await this.getAgentProfile(session.tokenId);

    // Store user message
    const userMessage = this.storeMessage(sessionId, 'user', content);

    // Get conversation history
    const history = this.getHistory(sessionId, this.maxContextMessages);

    // Get relevant memories
    const memories = this.memoryService.retrieve(session.tokenId, content, 8);

    // Build messages for AI
    const systemPrompt = this.promptEngine.buildSystemPrompt(profile);
    const memoryContext = this.promptEngine.buildContext(memories);

    const aiMessages: AIMessage[] = [
      { role: 'system', content: systemPrompt + (memoryContext ? '\n\n' + memoryContext : '') },
    ];

    // Add conversation history
    for (const msg of history) {
      aiMessages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    // Call AI
    const response = await this.aiClient.chat(aiMessages, {
      temperature: this.getTemperatureForPersona(profile.personaVector),
      maxTokens: 512,
    });

    // Store agent response
    const agentMessage = this.storeMessage(sessionId, 'agent', response);

    // Update session message count
    const updateStmt = this.db.prepare(`
      UPDATE chat_sessions SET message_count = message_count + 2 WHERE id = ?
    `);
    updateStmt.run(sessionId);

    return {
      message: agentMessage,
      sessionId,
    };
  }

  /**
   * Get temperature based on persona (more calm = lower temp, more bold = higher temp)
   */
  private getTemperatureForPersona(persona: PersonaVector): number {
    const baseTemp = 0.7;
    const calmAdjust = persona.calm * -0.1;  // Calm reduces randomness
    const boldAdjust = persona.bold * 0.1;   // Bold increases randomness
    const curiousAdjust = persona.curious * 0.05;

    return Math.max(0.3, Math.min(1.0, baseTemp + calmAdjust + boldAdjust + curiousAdjust));
  }

  /**
   * Store a chat message
   */
  private storeMessage(sessionId: string, role: 'user' | 'agent', content: string): ChatMessage {
    const id = uuidv4();
    const now = new Date().toISOString();
    const tokenCount = AIClient.estimateTokens(content);

    const stmt = this.db.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, created_at, token_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, sessionId, role, content, now, tokenCount);

    return {
      id,
      sessionId,
      role,
      content,
      createdAt: now,
      tokenCount,
    };
  }

  /**
   * Get conversation history
   */
  getHistory(sessionId: string, limit: number = 50): ChatMessage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM chat_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
      LIMIT ?
    `);
    const rows = stmt.all(sessionId, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
      tokenCount: row.token_count,
    }));
  }

  /**
   * End a session and extract memories
   */
  async endSession(sessionId: string): Promise<SessionSummary> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Get all messages
    const messages = this.getHistory(sessionId, 100);

    // Extract memories
    const memoryInputs = this.promptEngine.extractMemories(messages);

    // Store memories with session reference
    const memories = this.memoryService.storeBatch(
      session.tokenId,
      memoryInputs.map(m => ({ ...m, sourceSessionId: sessionId }))
    );

    // Generate session summary
    const summary = this.generateSessionSummary(messages);

    // Calculate persona impact (very small changes per session)
    const personaImpact = this.calculatePersonaImpact(messages);

    // Update session
    const now = new Date().toISOString();
    const updateStmt = this.db.prepare(`
      UPDATE chat_sessions SET ended_at = ?, summary = ? WHERE id = ?
    `);
    updateStmt.run(now, summary, sessionId);

    return {
      sessionId,
      summary,
      memoriesExtracted: memories.length,
      personaImpact,
    };
  }

  /**
   * Generate a summary of the conversation
   */
  private generateSessionSummary(messages: ChatMessage[]): string {
    if (messages.length === 0) return '空对话';
    if (messages.length <= 4) return `简短对话 (${messages.length} 条消息)`;

    // Extract topics from user messages
    const userMessages = messages.filter(m => m.role === 'user');
    const topics: string[] = [];

    for (const msg of userMessages.slice(0, 5)) {
      const firstSentence = msg.content.split(/[。！？\n]/)[0];
      if (firstSentence && firstSentence.length <= 30) {
        topics.push(firstSentence);
      }
    }

    if (topics.length > 0) {
      return `讨论了: ${topics.slice(0, 3).join(', ')} 等话题 (${messages.length} 条消息)`;
    }

    return `对话 (${messages.length} 条消息)`;
  }

  /**
   * Calculate persona impact from conversation
   * Returns very small deltas to allow gradual personality evolution
   */
  private calculatePersonaImpact(messages: ChatMessage[]): Partial<PersonaVector> {
    const impact: Partial<PersonaVector> = {};
    const userMessages = messages.filter(m => m.role === 'user');

    if (userMessages.length < 3) return impact;

    // Analyze conversation sentiment and patterns
    let positiveCount = 0;
    let negativeCount = 0;
    let questionCount = 0;
    let deepCount = 0;

    for (const msg of userMessages) {
      const content = msg.content;

      // Positive indicators
      if (content.match(/谢谢|太好了|很棒|喜欢|开心|感谢|厉害/)) {
        positiveCount++;
      }

      // Negative indicators
      if (content.match(/不好|糟糕|讨厌|烦|难过|失望/)) {
        negativeCount++;
      }

      // Questions indicate curiosity engagement
      if (content.match(/[？?]|为什么|怎么|什么|如何/)) {
        questionCount++;
      }

      // Deep/philosophical topics
      if (content.match(/人生|意义|世界|未来|思考|理解|感受/)) {
        deepCount++;
      }
    }

    // Small adjustments based on interaction patterns
    const delta = 0.02;

    // Positive interactions make agent more social
    if (positiveCount > negativeCount + 2) {
      impact.social = delta;
    }

    // Questions increase curiosity slightly
    if (questionCount > userMessages.length * 0.5) {
      impact.curious = delta;
    }

    // Deep conversations increase calm
    if (deepCount > 2) {
      impact.calm = delta;
    }

    return impact;
  }

  /**
   * Get agent profile from vault and chain data
   */
  async getAgentProfile(tokenId: number): Promise<AgentProfile> {
    // Try to get from vault first
    const vault = getVaultService().getByTokenId(tokenId);

    // Default values
    let houseId = 1;
    let houseName = 'SOLARA';
    let generation = 0;
    let traits: Record<string, string> = {};

    if (vault) {
      traits = vault.traits || {};
      // Extract house from traits
      const houseFromTraits = traits.House;
      if (houseFromTraits) {
        houseName = houseFromTraits;
        houseId = Object.entries(HOUSE_NAMES).find(([_, v]) => v === houseFromTraits)?.[0]
          ? parseInt(Object.entries(HOUSE_NAMES).find(([_, v]) => v === houseFromTraits)![0])
          : 1;
      }

      // Calculate generation from parent info
      if (vault.parentAId && vault.parentBId) {
        generation = 1; // At least gen 1 if has parents
        // Could query chain for actual generation
      }
    }

    // Build persona from house + traits + learned adjustments
    let personaVector = this.promptEngine.getInitialPersona(houseName, traits);

    // Apply learned persona adjustments from snapshots
    const latestSnapshot = this.getLatestPersonaSnapshot(tokenId);
    if (latestSnapshot) {
      const delta = JSON.parse(latestSnapshot.persona_delta);
      for (const [key, value] of Object.entries(delta)) {
        if (key in personaVector && typeof value === 'number') {
          (personaVector as any)[key] = Math.max(-1, Math.min(1,
            (personaVector as any)[key] + value
          ));
        }
      }
    }

    return {
      tokenId,
      houseId,
      houseName,
      generation,
      traits,
      personaVector,
      vaultHash: vault?.seed,
    };
  }

  /**
   * Get latest persona snapshot
   */
  private getLatestPersonaSnapshot(tokenId: number): { persona_delta: string } | null {
    const stmt = this.db.prepare(`
      SELECT persona_delta FROM learning_snapshots
      WHERE token_id = ?
      ORDER BY version DESC
      LIMIT 1
    `);
    return stmt.get(tokenId) as { persona_delta: string } | null;
  }
}

// Singleton instance
let chatServiceInstance: ChatService | null = null;

export function getChatService(): ChatService {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatService();
  }
  return chatServiceInstance;
}
