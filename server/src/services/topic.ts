/**
 * Topic Analysis Service
 * 对话主题分析系统 - 提取和统计对话主题
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { getVaultService } from './vault.js';
import { ChatMessage } from '../types/chat.js';

// 主题类别定义
export type TopicCategory =
  | 'greeting'       // 问候
  | 'daily_life'     // 日常生活
  | 'emotions'       // 情感倾诉
  | 'knowledge'      // 知识问答
  | 'creative'       // 创意想象
  | 'philosophy'     // 哲学思考
  | 'tech'           // 科技技术
  | 'entertainment'  // 娱乐休闲
  | 'work'           // 工作事业
  | 'relationship'   // 人际关系
  | 'health'         // 健康生活
  | 'future'         // 未来憧憬
  | 'other';         // 其他

// 主题配置
export const TOPIC_CONFIG: Record<TopicCategory, {
  label: string;
  emoji: string;
  color: string;
  keywords: RegExp;
}> = {
  greeting: {
    label: '日常问候',
    emoji: '👋',
    color: '#60a5fa',
    keywords: /你好|早上好|晚上好|早安|晚安|嗨|hi|hello|在吗|最近怎么样/i,
  },
  daily_life: {
    label: '日常生活',
    emoji: '🏠',
    color: '#34d399',
    keywords: /吃饭|睡觉|起床|天气|今天|昨天|明天|周末|假期|出门|回家|做饭|打扫/,
  },
  emotions: {
    label: '情感倾诉',
    emoji: '💭',
    color: '#f472b6',
    keywords: /开心|难过|烦恼|压力|焦虑|担心|害怕|生气|孤独|想念|感动|委屈|郁闷/,
  },
  knowledge: {
    label: '知识问答',
    emoji: '📚',
    color: '#a78bfa',
    keywords: /为什么|怎么|什么是|如何|原理|解释|区别|历史|科学|学习|教|知识/,
  },
  creative: {
    label: '创意想象',
    emoji: '🎨',
    color: '#fbbf24',
    keywords: /想象|如果|创意|设计|故事|小说|诗|画|音乐|艺术|梦想|幻想/,
  },
  philosophy: {
    label: '哲学思考',
    emoji: '🤔',
    color: '#8b5cf6',
    keywords: /人生|意义|存在|价值|道德|选择|命运|自由|灵魂|宇宙|时间|生命|死亡/,
  },
  tech: {
    label: '科技技术',
    emoji: '💻',
    color: '#06b6d4',
    keywords: /代码|编程|软件|电脑|手机|AI|人工智能|互联网|游戏|区块链|加密|技术/,
  },
  entertainment: {
    label: '娱乐休闲',
    emoji: '🎮',
    color: '#ec4899',
    keywords: /电影|电视剧|综艺|动漫|游戏|音乐|歌|追剧|看书|运动|旅游|玩/,
  },
  work: {
    label: '工作事业',
    emoji: '💼',
    color: '#f59e0b',
    keywords: /工作|上班|公司|老板|同事|项目|会议|加班|工资|职业|创业|面试/,
  },
  relationship: {
    label: '人际关系',
    emoji: '👥',
    color: '#ef4444',
    keywords: /朋友|家人|爱情|恋爱|男朋友|女朋友|老公|老婆|父母|孩子|同学|邻居/,
  },
  health: {
    label: '健康生活',
    emoji: '🏃',
    color: '#22c55e',
    keywords: /健康|锻炼|减肥|睡眠|饮食|生病|医院|药|身体|运动|瑜伽|跑步/,
  },
  future: {
    label: '未来憧憬',
    emoji: '🌟',
    color: '#fcd34d',
    keywords: /未来|计划|目标|希望|愿望|梦想|以后|将来|打算|准备|期待/,
  },
  other: {
    label: '其他话题',
    emoji: '💬',
    color: '#9ca3af',
    keywords: /.*/,
  },
};

// 主题数据接口
export interface ConversationTopic {
  id: string;
  sessionId: string;
  tokenId: number;
  topic: TopicCategory;
  confidence: number;
  messageCount: number;
  createdAt: string;
}

// 主题统计接口
export interface TopicStats {
  tokenId: number;
  totalTopics: number;
  topicDistribution: Record<TopicCategory, number>;
  topTopics: { topic: TopicCategory; count: number; percentage: number }[];
  recentTopics: ConversationTopic[];
}

export class TopicService {
  private db: Database.Database;

  constructor() {
    this.db = getVaultService().getDatabase();
  }

  /**
   * 从消息中提取主题
   */
  extractTopicsFromMessages(messages: ChatMessage[]): { topic: TopicCategory; confidence: number }[] {
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return [];

    const topicScores: Record<TopicCategory, number> = {} as Record<TopicCategory, number>;

    // 初始化分数
    for (const category of Object.keys(TOPIC_CONFIG) as TopicCategory[]) {
      topicScores[category] = 0;
    }

    // 分析每条消息
    for (const msg of userMessages) {
      const content = msg.content;

      for (const [category, config] of Object.entries(TOPIC_CONFIG) as [TopicCategory, typeof TOPIC_CONFIG[TopicCategory]][]) {
        if (category === 'other') continue;

        const matches = content.match(config.keywords);
        if (matches) {
          topicScores[category] += matches.length;
        }
      }
    }

    // 找出所有有分数的主题
    const detectedTopics: { topic: TopicCategory; confidence: number }[] = [];
    const maxScore = Math.max(...Object.values(topicScores));

    if (maxScore > 0) {
      for (const [category, score] of Object.entries(topicScores) as [TopicCategory, number][]) {
        if (score > 0) {
          const confidence = Math.min(1, score / (maxScore * 1.5));
          if (confidence >= 0.3) {
            detectedTopics.push({ topic: category, confidence });
          }
        }
      }
    }

    // 如果没有检测到任何主题，返回 other
    if (detectedTopics.length === 0) {
      detectedTopics.push({ topic: 'other', confidence: 0.5 });
    }

    // 按置信度排序
    return detectedTopics.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 存储会话主题
   */
  storeSessionTopics(
    sessionId: string,
    tokenId: number,
    topics: { topic: TopicCategory; confidence: number }[],
    messageCount: number
  ): ConversationTopic[] {
    const now = new Date().toISOString();
    const stored: ConversationTopic[] = [];

    for (const { topic, confidence } of topics.slice(0, 3)) { // 最多存储3个主题
      const id = uuidv4();

      const stmt = this.db.prepare(`
        INSERT INTO conversation_topics (id, session_id, token_id, topic, confidence, message_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(id, sessionId, tokenId, topic, confidence, messageCount, now);

      stored.push({
        id,
        sessionId,
        tokenId,
        topic,
        confidence,
        messageCount,
        createdAt: now,
      });
    }

    return stored;
  }

  /**
   * 获取智能体的主题统计
   */
  getTopicStats(tokenId: number): TopicStats {
    // 获取主题分布
    const distributionStmt = this.db.prepare(`
      SELECT topic, COUNT(*) as count
      FROM conversation_topics
      WHERE token_id = ?
      GROUP BY topic
      ORDER BY count DESC
    `);
    const distributionRows = distributionStmt.all(tokenId) as { topic: string; count: number }[];

    // 计算总数和分布
    const topicDistribution: Record<TopicCategory, number> = {} as Record<TopicCategory, number>;
    let totalTopics = 0;

    for (const category of Object.keys(TOPIC_CONFIG) as TopicCategory[]) {
      topicDistribution[category] = 0;
    }

    for (const row of distributionRows) {
      topicDistribution[row.topic as TopicCategory] = row.count;
      totalTopics += row.count;
    }

    // 获取前5个主题
    const topTopics = distributionRows.slice(0, 5).map(row => ({
      topic: row.topic as TopicCategory,
      count: row.count,
      percentage: totalTopics > 0 ? Math.round((row.count / totalTopics) * 100) : 0,
    }));

    // 获取最近的主题
    const recentStmt = this.db.prepare(`
      SELECT * FROM conversation_topics
      WHERE token_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `);
    const recentRows = recentStmt.all(tokenId) as any[];

    const recentTopics = recentRows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      tokenId: row.token_id,
      topic: row.topic as TopicCategory,
      confidence: row.confidence,
      messageCount: row.message_count,
      createdAt: row.created_at,
    }));

    return {
      tokenId,
      totalTopics,
      topicDistribution,
      topTopics,
      recentTopics,
    };
  }

  /**
   * 获取用户与智能体的主题偏好
   */
  getUserTopicPreferences(tokenId: number, userAddress: string): { topic: TopicCategory; count: number }[] {
    const stmt = this.db.prepare(`
      SELECT t.topic, COUNT(*) as count
      FROM conversation_topics t
      JOIN chat_sessions s ON t.session_id = s.id
      WHERE t.token_id = ? AND s.user_address = ?
      GROUP BY t.topic
      ORDER BY count DESC
      LIMIT 5
    `);
    const rows = stmt.all(tokenId, userAddress.toLowerCase()) as { topic: string; count: number }[];

    return rows.map(row => ({
      topic: row.topic as TopicCategory,
      count: row.count,
    }));
  }
}

// Singleton instance
let topicServiceInstance: TopicService | null = null;

export function getTopicService(): TopicService {
  if (!topicServiceInstance) {
    topicServiceInstance = new TopicService();
  }
  return topicServiceInstance;
}
