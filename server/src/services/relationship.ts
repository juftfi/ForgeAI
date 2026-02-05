/**
 * Relationship Service
 * 关系等级系统 - 管理用户与智能体之间的亲密度
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { getVaultService } from './vault.js';

// 关系等级定义
export interface RelationshipLevel {
  level: number;
  title: string;
  titleEn: string;
  minExp: number;
  maxExp: number;
  color: string;
  benefits: string[];
}

// 关系等级配置
export const RELATIONSHIP_LEVELS: RelationshipLevel[] = [
  {
    level: 1,
    title: '初识',
    titleEn: 'Stranger',
    minExp: 0,
    maxExp: 100,
    color: '#9ca3af',
    benefits: ['基础对话'],
  },
  {
    level: 2,
    title: '相识',
    titleEn: 'Acquaintance',
    minExp: 100,
    maxExp: 300,
    color: '#60a5fa',
    benefits: ['记忆功能', '情绪识别'],
  },
  {
    level: 3,
    title: '朋友',
    titleEn: 'Friend',
    minExp: 300,
    maxExp: 600,
    color: '#34d399',
    benefits: ['更丰富的回复', '专属称呼'],
  },
  {
    level: 4,
    title: '挚友',
    titleEn: 'Close Friend',
    minExp: 600,
    maxExp: 1000,
    color: '#a78bfa',
    benefits: ['深度对话', '个性化建议'],
  },
  {
    level: 5,
    title: '知己',
    titleEn: 'Soulmate',
    minExp: 1000,
    maxExp: 1500,
    color: '#f472b6',
    benefits: ['情感共鸣', '隐藏特性解锁'],
  },
  {
    level: 6,
    title: '羁绊',
    titleEn: 'Bonded',
    minExp: 1500,
    maxExp: 2500,
    color: '#fbbf24',
    benefits: ['最高亲密度', '专属互动'],
  },
  {
    level: 7,
    title: '灵魂伴侣',
    titleEn: 'Soul Partner',
    minExp: 2500,
    maxExp: Infinity,
    color: '#ef4444',
    benefits: ['永恒羁绊', '传说称号'],
  },
];

// 经验值获取配置
export const EXP_CONFIG = {
  messageSent: 2,              // 发送消息
  sessionCompleted: 10,        // 完成一次对话
  positiveEmotion: 5,          // 正面情绪
  memoryExtracted: 3,          // 记忆提取
  longSession: 15,             // 长对话奖励（>10条消息）
  dailyBonus: 20,              // 每日首次对话奖励
  consecutiveDay: 5,           // 连续登录加成
};

// 关系数据接口
export interface Relationship {
  id: string;
  tokenId: number;
  userAddress: string;
  relationshipLevel: number;
  experiencePoints: number;
  totalSessions: number;
  totalMessages: number;
  positiveInteractions: number;
  lastInteractionAt?: string;
  firstInteractionAt: string;
  relationshipTitle?: string;
  createdAt: string;
  updatedAt: string;
}

export class RelationshipService {
  private db: Database.Database;

  constructor() {
    this.db = getVaultService().getDatabase();
  }

  /**
   * 获取用户与智能体的关系
   */
  getRelationship(tokenId: number, userAddress: string): Relationship {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_relationships
      WHERE token_id = ? AND user_address = ?
    `);
    const row = stmt.get(tokenId, userAddress.toLowerCase()) as any;

    if (!row) {
      return this.initializeRelationship(tokenId, userAddress);
    }

    return this.rowToRelationship(row);
  }

  /**
   * 初始化关系
   */
  private initializeRelationship(tokenId: number, userAddress: string): Relationship {
    const now = new Date().toISOString();
    const id = uuidv4();

    const relationship: Relationship = {
      id,
      tokenId,
      userAddress: userAddress.toLowerCase(),
      relationshipLevel: 1,
      experiencePoints: 0,
      totalSessions: 0,
      totalMessages: 0,
      positiveInteractions: 0,
      firstInteractionAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO agent_relationships (
        id, token_id, user_address, relationship_level, experience_points,
        total_sessions, total_messages, positive_interactions,
        first_interaction_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      tokenId,
      userAddress.toLowerCase(),
      relationship.relationshipLevel,
      relationship.experiencePoints,
      relationship.totalSessions,
      relationship.totalMessages,
      relationship.positiveInteractions,
      now,
      now,
      now
    );

    return relationship;
  }

  /**
   * 添加经验值
   */
  addExperience(
    tokenId: number,
    userAddress: string,
    expType: keyof typeof EXP_CONFIG,
    multiplier: number = 1
  ): { newExp: number; levelUp: boolean; newLevel: number } {
    const relationship = this.getRelationship(tokenId, userAddress);
    const expGain = Math.round(EXP_CONFIG[expType] * multiplier);

    const newExp = relationship.experiencePoints + expGain;
    const currentLevel = this.calculateLevel(relationship.experiencePoints);
    const newLevel = this.calculateLevel(newExp);
    const levelUp = newLevel > currentLevel;

    // 更新等级称号
    const newTitle = levelUp ? RELATIONSHIP_LEVELS[newLevel - 1]?.title : relationship.relationshipTitle;

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE agent_relationships SET
        experience_points = ?,
        relationship_level = ?,
        relationship_title = ?,
        last_interaction_at = ?,
        updated_at = ?
      WHERE token_id = ? AND user_address = ?
    `);

    stmt.run(newExp, newLevel, newTitle, now, now, tokenId, userAddress.toLowerCase());

    return { newExp, levelUp, newLevel };
  }

  /**
   * 更新会话统计
   */
  updateSessionStats(
    tokenId: number,
    userAddress: string,
    messageCount: number,
    positiveCount: number
  ): void {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE agent_relationships SET
        total_sessions = total_sessions + 1,
        total_messages = total_messages + ?,
        positive_interactions = positive_interactions + ?,
        last_interaction_at = ?,
        updated_at = ?
      WHERE token_id = ? AND user_address = ?
    `);

    stmt.run(messageCount, positiveCount, now, now, tokenId, userAddress.toLowerCase());
  }

  /**
   * 计算等级
   */
  calculateLevel(exp: number): number {
    for (let i = RELATIONSHIP_LEVELS.length - 1; i >= 0; i--) {
      if (exp >= RELATIONSHIP_LEVELS[i].minExp) {
        return RELATIONSHIP_LEVELS[i].level;
      }
    }
    return 1;
  }

  /**
   * 获取等级配置
   */
  getLevelConfig(level: number): RelationshipLevel {
    return RELATIONSHIP_LEVELS[Math.min(level - 1, RELATIONSHIP_LEVELS.length - 1)];
  }

  /**
   * 获取下一等级所需经验
   */
  getExpToNextLevel(exp: number): { current: number; required: number; progress: number } {
    const currentLevel = this.calculateLevel(exp);
    const currentConfig = this.getLevelConfig(currentLevel);
    const nextConfig = this.getLevelConfig(currentLevel + 1);

    if (currentLevel >= RELATIONSHIP_LEVELS.length) {
      return { current: exp, required: currentConfig.minExp, progress: 100 };
    }

    const current = exp - currentConfig.minExp;
    const required = nextConfig.minExp - currentConfig.minExp;
    const progress = Math.min(100, Math.round((current / required) * 100));

    return { current, required, progress };
  }

  /**
   * 获取智能体的所有关系（排行榜）
   */
  getAgentRelationships(tokenId: number, limit: number = 10): Relationship[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_relationships
      WHERE token_id = ?
      ORDER BY experience_points DESC
      LIMIT ?
    `);
    const rows = stmt.all(tokenId, limit) as any[];
    return rows.map(row => this.rowToRelationship(row));
  }

  /**
   * 获取用户的所有关系
   */
  getUserRelationships(userAddress: string, limit: number = 20): Relationship[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_relationships
      WHERE user_address = ?
      ORDER BY experience_points DESC
      LIMIT ?
    `);
    const rows = stmt.all(userAddress.toLowerCase(), limit) as any[];
    return rows.map(row => this.rowToRelationship(row));
  }

  /**
   * 生成关系提示词补充
   */
  getRelationshipPromptAddition(relationship: Relationship): string {
    const level = this.getLevelConfig(relationship.relationshipLevel);

    let prompt = `\n\n【用户关系】你与这位用户的关系等级是"${level.title}"（${level.level}级）。`;

    if (relationship.relationshipLevel >= 3) {
      prompt += `\n你们已经是朋友了，可以用更亲切的语气交流。`;
    }

    if (relationship.relationshipLevel >= 5) {
      prompt += `\n你们是知己，你很了解这位用户，可以主动关心对方。`;
    }

    if (relationship.totalSessions > 10) {
      prompt += `\n你们已经聊过 ${relationship.totalSessions} 次了。`;
    }

    return prompt;
  }

  /**
   * 数据库行转对象
   */
  private rowToRelationship(row: any): Relationship {
    return {
      id: row.id,
      tokenId: row.token_id,
      userAddress: row.user_address,
      relationshipLevel: row.relationship_level,
      experiencePoints: row.experience_points,
      totalSessions: row.total_sessions,
      totalMessages: row.total_messages,
      positiveInteractions: row.positive_interactions,
      lastInteractionAt: row.last_interaction_at,
      firstInteractionAt: row.first_interaction_at,
      relationshipTitle: row.relationship_title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// Singleton instance
let relationshipServiceInstance: RelationshipService | null = null;

export function getRelationshipService(): RelationshipService {
  if (!relationshipServiceInstance) {
    relationshipServiceInstance = new RelationshipService();
  }
  return relationshipServiceInstance;
}
