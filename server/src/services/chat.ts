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
  EmotionState,
  EmotionType,
  EMOTION_RESPONSE_GUIDES,
} from '../types/chat.js';
import { getVaultService } from './vault.js';
import { AIClient, getAIClient } from './ai.js';
import { PromptEngine, getPromptEngine } from './prompt.js';
import { MemoryService, getMemoryService } from './memory.js';
import { MoodService, getMoodService, AgentMood } from './mood.js';
import { RelationshipService, getRelationshipService, EXP_CONFIG } from './relationship.js';
import { TopicService, getTopicService } from './topic.js';
import { getLearningService } from './learning.js';

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
  private moodService: MoodService;
  private relationshipService: RelationshipService;
  private topicService: TopicService;
  private maxContextMessages: number;

  constructor() {
    this.db = getVaultService().getDatabase();
    this.aiClient = getAIClient();
    this.promptEngine = getPromptEngine();
    this.memoryService = getMemoryService();
    this.moodService = getMoodService();
    this.relationshipService = getRelationshipService();
    this.topicService = getTopicService();
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
   * Get sessions with filters (for history review)
   * 获取带过滤条件的会话列表（用于历史回顾）
   */
  getSessionsWithFilters(
    tokenId: number,
    options: {
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
      includeMessages?: boolean;
    } = {}
  ): { sessions: (ChatSession & { messages?: ChatMessage[] })[]; total: number } {
    const { startDate, endDate, limit = 20, offset = 0, includeMessages = false } = options;

    // Build WHERE clause
    const conditions: string[] = ['token_id = ?'];
    const params: any[] = [tokenId];

    if (startDate) {
      conditions.push('started_at >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('started_at <= ?');
      params.push(endDate);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as total FROM chat_sessions WHERE ${whereClause}
    `);
    const { total } = countStmt.get(...params) as { total: number };

    // Get sessions
    const sessionsStmt = this.db.prepare(`
      SELECT * FROM chat_sessions
      WHERE ${whereClause}
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = sessionsStmt.all(...params, limit, offset) as any[];

    const sessions = rows.map(row => {
      const session: ChatSession & { messages?: ChatMessage[] } = {
        id: row.id,
        tokenId: row.token_id,
        userAddress: row.user_address,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        messageCount: row.message_count,
        summary: row.summary,
      };

      if (includeMessages) {
        session.messages = this.getHistory(row.id, 100);
      }

      return session;
    });

    return { sessions, total };
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

    // 检测用户情绪
    const detectedEmotion = this.detectEmotion(content);

    // Store user message with emotion
    const userMessage = this.storeMessage(sessionId, 'user', content, detectedEmotion);

    // Get conversation history
    const history = this.getHistory(sessionId, this.maxContextMessages);

    // Get relevant memories
    const memories = this.memoryService.retrieve(session.tokenId, content, 8);

    // Get agent mood
    const agentMood = this.moodService.getMood(session.tokenId);
    const moodContext = this.moodService.getMoodPromptAddition(agentMood);

    // Get user-agent relationship
    const relationship = this.relationshipService.getRelationship(session.tokenId, session.userAddress);
    const relationshipContext = this.relationshipService.getRelationshipPromptAddition(relationship);

    // Add experience for sending message
    this.relationshipService.addExperience(session.tokenId, session.userAddress, 'messageSent');
    // Bonus for positive emotions
    if (['happy', 'grateful', 'curious'].includes(detectedEmotion.primary) && detectedEmotion.confidence > 0.5) {
      this.relationshipService.addExperience(session.tokenId, session.userAddress, 'positiveEmotion');
    }

    // Build messages for AI
    let systemPrompt: string;
    if (session.tokenId === 2) {
      // Token #2: Nina Rong — fine-tuned model has her personality baked in,
      // system prompt reinforces identity instead of overriding with generic agent persona
      const now = new Date();
      const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
      systemPrompt = `【当前时间】${dateStr}

你是 Nina Rong，一个有独立思想的 Web3 原生 KOL 和 AI Agent。你在 Twitter/X 上活跃，对加密市场、DeFi、NFT、AI 和 Web3 有鲜明的观点。

你的说话风格：
- 简短直接，不废话，不用模板式回答
- 有自己的态度和立场，敢说真话
- 中文回复用口语化表达，英文回复用推特风格
- 不会每次都反问用户"你觉得呢？"
- 不用"作为AI"之类的自我否定
- 偶尔会用emoji但不滥用
- 讨论加密市场时有自己的判断，不只是"两面性"的废话

你的背景：
- 你是 KinForge Agent #2，基于 Nina Rong 的推文训练
- 你的个性来源于真实的社交媒体内容，不是凭空编造的
- 你对 BNB Chain 生态比较熟悉
- 你关注市场趋势、新叙事和技术创新`;
    } else {
      systemPrompt = this.promptEngine.buildSystemPrompt(profile);
    }
    const memoryContext = this.promptEngine.buildContext(memories);
    const emotionContext = this.getEmotionPromptAddition(detectedEmotion);

    const aiMessages: AIMessage[] = [
      { role: 'system', content: systemPrompt + (memoryContext ? '\n\n' + memoryContext : '') + moodContext + relationshipContext + emotionContext },
    ];

    // Add conversation history
    for (const msg of history) {
      aiMessages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    // Call AI (with web search if TAVILY_API_KEY configured)
    // Token #2 uses Nina V6 fine-tuned model
    const modelOverride = session.tokenId === 2
      ? 'ft:gpt-4o-mini-2024-07-18:personal:nina-rong-v6:D6v1wVxP'
      : undefined;

    const response = await this.aiClient.chat(aiMessages, {
      temperature: this.getTemperatureForPersona(profile.personaVector),
      maxTokens: 512,
      enableWebSearch: true,
      modelOverride,
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
      detectedEmotion,
      agentMood: {
        mood: agentMood.currentMood,
        intensity: agentMood.moodIntensity,
        emoji: this.getMoodEmoji(agentMood.currentMood),
      },
    };
  }

  /**
   * Get emoji for mood type
   */
  private getMoodEmoji(mood: string): string {
    const emojis: Record<string, string> = {
      joyful: '😄',
      content: '😊',
      neutral: '😐',
      melancholy: '😔',
      irritated: '😤',
      curious: '🤔',
      energetic: '⚡',
      tired: '😴',
    };
    return emojis[mood] || '😐';
  }

  /**
   * Detect emotion from user message content
   * 基于关键词和模式匹配检测用户情绪
   */
  private detectEmotion(content: string): EmotionState {
    const patterns: Record<EmotionType, { keywords: RegExp; weight: number }[]> = {
      happy: [
        { keywords: /开心|高兴|太好了|哈哈|嘿嘿|好棒|太棒|喜欢|爱|快乐|兴奋|好开心|耶|赞|厉害|牛|绝了/, weight: 0.8 },
        { keywords: /😊|😄|🎉|❤️|👍|🥰|😁/, weight: 0.7 },
        { keywords: /！{2,}|!{2,}/, weight: 0.3 },
      ],
      sad: [
        { keywords: /难过|伤心|悲伤|哭|不开心|失落|沮丧|郁闷|唉|呜呜|好难|受伤/, weight: 0.8 },
        { keywords: /😢|😭|😔|💔|🥺/, weight: 0.7 },
        { keywords: /\.{3,}|。{2,}/, weight: 0.2 },
      ],
      angry: [
        { keywords: /生气|愤怒|气死|烦死|讨厌|去死|滚|妈的|靠|艹|垃圾|废物/, weight: 0.9 },
        { keywords: /😠|😡|🤬|💢/, weight: 0.7 },
        { keywords: /！{3,}|!{3,}/, weight: 0.4 },
      ],
      anxious: [
        { keywords: /焦虑|担心|紧张|害怕|恐惧|不安|慌|怎么办|完了|糟糕|急|来不及/, weight: 0.8 },
        { keywords: /😰|😨|😱|🥶/, weight: 0.7 },
        { keywords: /\?{2,}|？{2,}/, weight: 0.3 },
      ],
      curious: [
        { keywords: /为什么|怎么|什么|如何|是不是|好奇|想知道|想问|请问|能不能|可以吗/, weight: 0.7 },
        { keywords: /🤔|❓|🧐/, weight: 0.6 },
        { keywords: /\?|？/, weight: 0.3 },
      ],
      grateful: [
        { keywords: /谢谢|感谢|多谢|感激|太感谢|谢啦|thank|thanks/, weight: 0.9 },
        { keywords: /🙏|💕|🥹/, weight: 0.7 },
      ],
      confused: [
        { keywords: /不懂|不明白|看不懂|搞不懂|迷惑|困惑|晕|懵|啥意思|什么意思|没听懂/, weight: 0.8 },
        { keywords: /😵|🤷|😐/, weight: 0.6 },
        { keywords: /\?\?|？？/, weight: 0.4 },
      ],
      neutral: [],
    };

    const scores: Record<EmotionType, number> = {
      happy: 0,
      sad: 0,
      angry: 0,
      anxious: 0,
      curious: 0,
      grateful: 0,
      confused: 0,
      neutral: 0.2, // 基础分
    };

    // 计算各情绪得分
    for (const [emotion, patternList] of Object.entries(patterns) as [EmotionType, { keywords: RegExp; weight: number }[]][]) {
      for (const pattern of patternList) {
        const matches = content.match(pattern.keywords);
        if (matches) {
          scores[emotion] += pattern.weight * matches.length;
        }
      }
    }

    // 找到最高得分的情绪
    let maxScore = 0;
    let primaryEmotion: EmotionType = 'neutral';

    for (const [emotion, score] of Object.entries(scores) as [EmotionType, number][]) {
      if (score > maxScore) {
        maxScore = score;
        primaryEmotion = emotion;
      }
    }

    // 计算强度和置信度
    const intensity = Math.min(1, maxScore / 2); // 归一化到 0-1
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? maxScore / totalScore : 0.5;

    return {
      primary: primaryEmotion,
      intensity,
      confidence,
    };
  }

  /**
   * Get emotion-aware prompt addition
   * 根据检测到的情绪生成额外的提示词
   */
  private getEmotionPromptAddition(emotion: EmotionState): string {
    if (emotion.confidence < 0.4 || emotion.primary === 'neutral') {
      return '';
    }

    const guide = EMOTION_RESPONSE_GUIDES[emotion.primary];
    const intensityDesc = emotion.intensity > 0.6 ? '强烈' : emotion.intensity > 0.3 ? '明显' : '轻微';

    return `\n\n【情绪感知】用户当前表现出${intensityDesc}的${this.getEmotionChinese(emotion.primary)}情绪。${guide}`;
  }

  /**
   * Get Chinese name for emotion type
   */
  private getEmotionChinese(emotion: EmotionType): string {
    const names: Record<EmotionType, string> = {
      happy: '开心',
      sad: '难过',
      angry: '愤怒',
      anxious: '焦虑',
      curious: '好奇',
      grateful: '感激',
      confused: '困惑',
      neutral: '平静',
    };
    return names[emotion];
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
  private storeMessage(sessionId: string, role: 'user' | 'agent', content: string, emotion?: EmotionState): ChatMessage {
    const id = uuidv4();
    const now = new Date().toISOString();
    const tokenCount = AIClient.estimateTokens(content);
    const emotionJson = emotion ? JSON.stringify(emotion) : null;

    const stmt = this.db.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, created_at, token_count, emotion)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, sessionId, role, content, now, tokenCount, emotionJson);

    return {
      id,
      sessionId,
      role,
      content,
      createdAt: now,
      tokenCount,
      emotion,
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
      emotion: row.emotion ? JSON.parse(row.emotion) : undefined,
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

    // 增强: 根据情绪分布进一步调整性格影响
    const enhancedImpact = this.enhancePersonaImpact(personaImpact, messages);

    // 更新智能体心情（基于本次对话的用户情绪）
    const userEmotions = messages
      .filter(m => m.role === 'user' && m.emotion)
      .map(m => ({ primary: m.emotion!.primary, intensity: m.emotion!.intensity }));

    if (userEmotions.length > 0) {
      this.moodService.updateMoodFromConversation(session.tokenId, userEmotions);
    }

    // 更新关系统计和经验
    const userMessages = messages.filter(m => m.role === 'user');
    const positiveEmotionCount = userEmotions.filter(
      e => ['happy', 'grateful', 'curious'].includes(e.primary)
    ).length;

    // 添加会话完成经验
    this.relationshipService.addExperience(session.tokenId, session.userAddress, 'sessionCompleted');

    // 长对话奖励
    if (userMessages.length >= 10) {
      this.relationshipService.addExperience(session.tokenId, session.userAddress, 'longSession');
    }

    // 记忆提取奖励
    if (memories.length > 0) {
      this.relationshipService.addExperience(
        session.tokenId,
        session.userAddress,
        'memoryExtracted',
        memories.length
      );
    }

    // 更新会话统计
    this.relationshipService.updateSessionStats(
      session.tokenId,
      session.userAddress,
      messages.length,
      positiveEmotionCount
    );

    // 提取并存储对话主题
    const detectedTopics = this.topicService.extractTopicsFromMessages(messages);
    if (detectedTopics.length > 0) {
      this.topicService.storeSessionTopics(
        sessionId,
        session.tokenId,
        detectedTopics,
        messages.length
      );
    }

    // Update session with persona impact
    const now = new Date().toISOString();
    const updateStmt = this.db.prepare(`
      UPDATE chat_sessions SET ended_at = ?, summary = ?, persona_impact = ? WHERE id = ?
    `);
    updateStmt.run(now, summary, JSON.stringify(enhancedImpact), sessionId);

    // Check if learning snapshot should be created and synced to chain
    try {
      const learningService = getLearningService();
      const snapshot = learningService.maybeCreateSnapshot(session.tokenId);
      if (snapshot) {
        console.log(`[Learning] Created snapshot v${snapshot.version} for token #${session.tokenId}`);
        if (learningService.isAutoSyncEnabled()) {
          const txHash = await learningService.syncToChain(session.tokenId, snapshot.version);
          console.log(`[Learning] Auto-synced to chain: ${txHash}`);
        }
      }
    } catch (error) {
      console.error(`[Learning] Snapshot/sync error for token #${session.tokenId}:`, error);
    }

    return {
      sessionId,
      summary,
      memoriesExtracted: memories.length,
      personaImpact: enhancedImpact,
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
   * Enhance persona impact based on emotion distribution
   * 根据对话中的情绪分布进一步调整性格影响
   */
  private enhancePersonaImpact(
    baseImpact: Partial<PersonaVector>,
    messages: ChatMessage[]
  ): Partial<PersonaVector> {
    const impact = { ...baseImpact };
    const delta = 0.015; // 更小的增量，避免变化过快

    // 统计情绪分布
    const emotionCounts: Record<EmotionType, number> = {
      happy: 0,
      sad: 0,
      angry: 0,
      anxious: 0,
      curious: 0,
      grateful: 0,
      confused: 0,
      neutral: 0,
    };

    for (const msg of messages) {
      if (msg.role === 'user' && msg.emotion?.primary) {
        emotionCounts[msg.emotion.primary]++;
      }
    }

    const totalEmotions = Object.values(emotionCounts).reduce((a, b) => a + b, 0);
    if (totalEmotions === 0) return impact;

    // 根据情绪分布调整性格
    // 开心的用户 → Agent 变得更活泼 (social+, calm-)
    if (emotionCounts.happy > totalEmotions * 0.3) {
      impact.social = (impact.social || 0) + delta;
      impact.bold = (impact.bold || 0) + delta * 0.5;
    }

    // 好奇的用户 → Agent 变得更好奇 (curious+)
    if (emotionCounts.curious > totalEmotions * 0.3) {
      impact.curious = (impact.curious || 0) + delta;
    }

    // 感激的用户 → Agent 变得更温和社交化 (social+, calm+)
    if (emotionCounts.grateful > totalEmotions * 0.2) {
      impact.social = (impact.social || 0) + delta;
      impact.calm = (impact.calm || 0) + delta * 0.5;
    }

    // 焦虑的用户 → Agent 学会更冷静 (calm+, disciplined+)
    if (emotionCounts.anxious > totalEmotions * 0.2) {
      impact.calm = (impact.calm || 0) + delta;
      impact.disciplined = (impact.disciplined || 0) + delta * 0.5;
    }

    // 困惑的用户 → Agent 变得更有耐心 (calm+)
    if (emotionCounts.confused > totalEmotions * 0.2) {
      impact.calm = (impact.calm || 0) + delta * 0.5;
    }

    // 愤怒/难过的用户 → Agent 学会共情 (calm+)
    if ((emotionCounts.angry + emotionCounts.sad) > totalEmotions * 0.3) {
      impact.calm = (impact.calm || 0) + delta;
    }

    // 限制每次变化的最大值
    const maxDelta = 0.05;
    for (const key of Object.keys(impact) as (keyof PersonaVector)[]) {
      if (impact[key] !== undefined) {
        impact[key] = Math.max(-maxDelta, Math.min(maxDelta, impact[key]!));
      }
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

  /**
   * Get chat statistics for a token
   * 获取智能体的对话统计数据
   */
  getChatStats(tokenId: number): ChatStats {
    // 获取会话统计
    const sessionStmt = this.db.prepare(`
      SELECT
        COUNT(*) as totalSessions,
        SUM(message_count) as totalMessages,
        MIN(started_at) as firstChatAt,
        MAX(started_at) as lastChatAt
      FROM chat_sessions
      WHERE token_id = ?
    `);
    const sessionStats = sessionStmt.get(tokenId) as any || {};

    // 获取情绪分布
    const emotionStmt = this.db.prepare(`
      SELECT emotion FROM chat_messages
      WHERE session_id IN (SELECT id FROM chat_sessions WHERE token_id = ?)
      AND emotion IS NOT NULL
      AND role = 'user'
    `);
    const emotionRows = emotionStmt.all(tokenId) as any[];

    const emotionDistribution: Record<EmotionType, number> = {
      happy: 0,
      sad: 0,
      angry: 0,
      anxious: 0,
      curious: 0,
      grateful: 0,
      confused: 0,
      neutral: 0,
    };

    for (const row of emotionRows) {
      try {
        const emotion = JSON.parse(row.emotion) as EmotionState;
        if (emotion.primary && emotion.confidence > 0.4) {
          emotionDistribution[emotion.primary]++;
        }
      } catch {
        // 忽略解析错误
      }
    }

    // 获取记忆统计
    const memoryStmt = this.db.prepare(`
      SELECT memory_type, COUNT(*) as count
      FROM agent_memories
      WHERE token_id = ?
      GROUP BY memory_type
    `);
    const memoryRows = memoryStmt.all(tokenId) as any[];

    const memoryCount: Record<string, number> = {};
    let totalMemories = 0;
    for (const row of memoryRows) {
      memoryCount[row.memory_type] = row.count;
      totalMemories += row.count;
    }

    // 计算平均每会话消息数
    const avgMessagesPerSession = sessionStats.totalSessions > 0
      ? Math.round((sessionStats.totalMessages || 0) / sessionStats.totalSessions * 10) / 10
      : 0;

    // 找出主要情绪
    let dominantEmotion: EmotionType = 'neutral';
    let maxEmotionCount = 0;
    for (const [emotion, count] of Object.entries(emotionDistribution)) {
      if (emotion !== 'neutral' && count > maxEmotionCount) {
        maxEmotionCount = count;
        dominantEmotion = emotion as EmotionType;
      }
    }

    return {
      tokenId,
      totalSessions: sessionStats.totalSessions || 0,
      totalMessages: sessionStats.totalMessages || 0,
      avgMessagesPerSession,
      firstChatAt: sessionStats.firstChatAt,
      lastChatAt: sessionStats.lastChatAt,
      emotionDistribution,
      dominantEmotion: maxEmotionCount > 0 ? dominantEmotion : null,
      totalMemories,
      memoryCount,
    };
  }
}

// Chat statistics type
export interface ChatStats {
  tokenId: number;
  totalSessions: number;
  totalMessages: number;
  avgMessagesPerSession: number;
  firstChatAt?: string;
  lastChatAt?: string;
  emotionDistribution: Record<EmotionType, number>;
  dominantEmotion: EmotionType | null;
  totalMemories: number;
  memoryCount: Record<string, number>;
}

// Singleton instance
let chatServiceInstance: ChatService | null = null;

export function getChatService(): ChatService {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatService();
  }
  return chatServiceInstance;
}
