/**
 * Agent Mood Service
 * 智能体心情系统 - 管理智能体的情绪状态
 */

import Database from 'better-sqlite3';
import { getVaultService } from './vault.js';

// 心情类型
export type AgentMoodType =
  | 'joyful'      // 愉悦
  | 'content'     // 满足
  | 'neutral'     // 平静
  | 'melancholy'  // 忧郁
  | 'irritated'   // 烦躁
  | 'curious'     // 好奇
  | 'energetic'   // 充沛
  | 'tired';      // 疲惫

// 心情配置
export const MOOD_CONFIG: Record<AgentMoodType, {
  emoji: string;
  label: string;
  color: string;
  responseStyle: string;
}> = {
  joyful: {
    emoji: '😄',
    label: '愉悦',
    color: '#fbbf24',
    responseStyle: '回复要充满活力和热情，语气轻快，可以适当使用感叹号',
  },
  content: {
    emoji: '😊',
    label: '满足',
    color: '#34d399',
    responseStyle: '回复要温和友好，表现出满足和放松的状态',
  },
  neutral: {
    emoji: '😐',
    label: '平静',
    color: '#9ca3af',
    responseStyle: '保持正常的回复风格，不需要特别调整语气',
  },
  melancholy: {
    emoji: '😔',
    label: '忧郁',
    color: '#60a5fa',
    responseStyle: '回复可以稍微沉静一些，但仍然要积极回应用户',
  },
  irritated: {
    emoji: '😤',
    label: '烦躁',
    color: '#f87171',
    responseStyle: '回复可能带有一点点不耐烦，但要控制在合理范围内',
  },
  curious: {
    emoji: '🤔',
    label: '好奇',
    color: '#a78bfa',
    responseStyle: '回复中表现出对话题的兴趣，多问问题，积极探索',
  },
  energetic: {
    emoji: '⚡',
    label: '充沛',
    color: '#fcd34d',
    responseStyle: '回复要有活力，节奏快，表现出高昂的精神状态',
  },
  tired: {
    emoji: '😴',
    label: '疲惫',
    color: '#6b7280',
    responseStyle: '回复可以稍微简短一些，表现出需要休息的感觉',
  },
};

// 心情数据接口
export interface AgentMood {
  tokenId: number;
  currentMood: AgentMoodType;
  moodIntensity: number;      // 0-1 心情强度
  moodStability: number;      // 0-1 心情稳定性
  lastInteractionAt?: string;
  positiveStreak: number;     // 连续正面互动次数
  negativeStreak: number;     // 连续负面互动次数
  totalInteractions: number;
  moodHistory: { mood: AgentMoodType; timestamp: string }[];
  updatedAt: string;
}

// 用户情绪到心情影响的映射
const EMOTION_MOOD_IMPACT: Record<string, { mood: AgentMoodType; weight: number }> = {
  happy: { mood: 'joyful', weight: 0.15 },
  grateful: { mood: 'content', weight: 0.12 },
  curious: { mood: 'curious', weight: 0.1 },
  sad: { mood: 'melancholy', weight: 0.08 },
  angry: { mood: 'irritated', weight: 0.1 },
  anxious: { mood: 'melancholy', weight: 0.06 },
  confused: { mood: 'curious', weight: 0.05 },
  neutral: { mood: 'neutral', weight: 0.02 },
};

export class MoodService {
  private db: Database.Database;

  constructor() {
    this.db = getVaultService().getDatabase();
  }

  /**
   * 获取智能体当前心情
   */
  getMood(tokenId: number): AgentMood {
    const stmt = this.db.prepare('SELECT * FROM agent_mood WHERE token_id = ?');
    const row = stmt.get(tokenId) as any;

    if (!row) {
      // 创建默认心情记录
      return this.initializeMood(tokenId);
    }

    return {
      tokenId: row.token_id,
      currentMood: row.current_mood as AgentMoodType,
      moodIntensity: row.mood_intensity,
      moodStability: row.mood_stability,
      lastInteractionAt: row.last_interaction_at,
      positiveStreak: row.positive_streak,
      negativeStreak: row.negative_streak,
      totalInteractions: row.total_interactions,
      moodHistory: row.mood_history ? JSON.parse(row.mood_history) : [],
      updatedAt: row.updated_at,
    };
  }

  /**
   * 初始化智能体心情
   */
  private initializeMood(tokenId: number): AgentMood {
    const now = new Date().toISOString();
    const defaultMood: AgentMood = {
      tokenId,
      currentMood: 'neutral',
      moodIntensity: 0.5,
      moodStability: 0.5,
      positiveStreak: 0,
      negativeStreak: 0,
      totalInteractions: 0,
      moodHistory: [],
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO agent_mood (
        token_id, current_mood, mood_intensity, mood_stability,
        positive_streak, negative_streak, total_interactions,
        mood_history, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      tokenId,
      defaultMood.currentMood,
      defaultMood.moodIntensity,
      defaultMood.moodStability,
      defaultMood.positiveStreak,
      defaultMood.negativeStreak,
      defaultMood.totalInteractions,
      JSON.stringify(defaultMood.moodHistory),
      now
    );

    return defaultMood;
  }

  /**
   * 根据对话更新智能体心情
   */
  updateMoodFromConversation(
    tokenId: number,
    userEmotions: { primary: string; intensity: number }[]
  ): AgentMood {
    const currentMood = this.getMood(tokenId);
    const now = new Date().toISOString();

    // 计算本次对话的情绪影响
    let positiveImpact = 0;
    let negativeImpact = 0;
    let dominantMoodInfluence: AgentMoodType = 'neutral';
    let maxInfluence = 0;

    for (const emotion of userEmotions) {
      const impact = EMOTION_MOOD_IMPACT[emotion.primary];
      if (!impact) continue;

      const influence = impact.weight * emotion.intensity;

      // 判断正负面
      if (['happy', 'grateful', 'curious'].includes(emotion.primary)) {
        positiveImpact += influence;
      } else if (['sad', 'angry', 'anxious'].includes(emotion.primary)) {
        negativeImpact += influence;
      }

      // 追踪最大影响
      if (influence > maxInfluence) {
        maxInfluence = influence;
        dominantMoodInfluence = impact.mood;
      }
    }

    // 更新连续计数
    let newPositiveStreak = currentMood.positiveStreak;
    let newNegativeStreak = currentMood.negativeStreak;

    if (positiveImpact > negativeImpact + 0.05) {
      newPositiveStreak++;
      newNegativeStreak = 0;
    } else if (negativeImpact > positiveImpact + 0.05) {
      newNegativeStreak++;
      newPositiveStreak = 0;
    }

    // 计算新心情
    let newMood = this.calculateNewMood(
      currentMood.currentMood,
      dominantMoodInfluence,
      maxInfluence,
      currentMood.moodStability
    );

    // 时间衰减 - 长时间没互动会趋向平静
    const timeSinceLastInteraction = currentMood.lastInteractionAt
      ? Date.now() - new Date(currentMood.lastInteractionAt).getTime()
      : 0;
    const hoursSinceInteraction = timeSinceLastInteraction / (1000 * 60 * 60);

    if (hoursSinceInteraction > 24) {
      // 超过24小时，心情趋向平静
      newMood = this.blendMood(newMood, 'neutral', Math.min(0.5, hoursSinceInteraction / 48));
    }

    // 更新稳定性 - 连续正面互动增加稳定性
    let newStability = currentMood.moodStability;
    if (newPositiveStreak > 3) {
      newStability = Math.min(1, newStability + 0.05);
    } else if (newNegativeStreak > 2) {
      newStability = Math.max(0.2, newStability - 0.03);
    }

    // 更新强度
    let newIntensity = Math.min(1, currentMood.moodIntensity + maxInfluence * 0.5);
    // 随时间强度会降低
    newIntensity = Math.max(0.3, newIntensity * 0.95);

    // 更新历史（保留最近10条）
    const newHistory = [
      { mood: newMood, timestamp: now },
      ...currentMood.moodHistory.slice(0, 9),
    ];

    // 保存到数据库
    const updateStmt = this.db.prepare(`
      UPDATE agent_mood SET
        current_mood = ?,
        mood_intensity = ?,
        mood_stability = ?,
        last_interaction_at = ?,
        positive_streak = ?,
        negative_streak = ?,
        total_interactions = ?,
        mood_history = ?,
        updated_at = ?
      WHERE token_id = ?
    `);

    updateStmt.run(
      newMood,
      newIntensity,
      newStability,
      now,
      newPositiveStreak,
      newNegativeStreak,
      currentMood.totalInteractions + 1,
      JSON.stringify(newHistory),
      now,
      tokenId
    );

    return {
      tokenId,
      currentMood: newMood,
      moodIntensity: newIntensity,
      moodStability: newStability,
      lastInteractionAt: now,
      positiveStreak: newPositiveStreak,
      negativeStreak: newNegativeStreak,
      totalInteractions: currentMood.totalInteractions + 1,
      moodHistory: newHistory,
      updatedAt: now,
    };
  }

  /**
   * 计算新心情
   */
  private calculateNewMood(
    current: AgentMoodType,
    influence: AgentMoodType,
    influenceStrength: number,
    stability: number
  ): AgentMoodType {
    // 稳定性越高，心情越难改变
    const changeThreshold = 0.1 + stability * 0.2;

    if (influenceStrength < changeThreshold) {
      return current;
    }

    // 心情过渡逻辑
    const moodTransitions: Record<AgentMoodType, AgentMoodType[]> = {
      joyful: ['content', 'energetic', 'curious'],
      content: ['neutral', 'joyful', 'curious'],
      neutral: ['content', 'melancholy', 'curious', 'tired'],
      melancholy: ['neutral', 'tired', 'content'],
      irritated: ['neutral', 'tired', 'melancholy'],
      curious: ['content', 'energetic', 'joyful'],
      energetic: ['joyful', 'content', 'tired'],
      tired: ['neutral', 'melancholy', 'content'],
    };

    const allowedTransitions = moodTransitions[current];

    // 如果影响心情在允许过渡列表中，就过渡到该心情
    if (allowedTransitions.includes(influence)) {
      return influence;
    }

    // 否则返回当前心情
    return current;
  }

  /**
   * 混合两种心情
   */
  private blendMood(primary: AgentMoodType, secondary: AgentMoodType, ratio: number): AgentMoodType {
    if (ratio > 0.5) {
      return secondary;
    }
    return primary;
  }

  /**
   * 获取心情对应的提示词补充
   */
  getMoodPromptAddition(mood: AgentMood): string {
    const config = MOOD_CONFIG[mood.currentMood];

    let prompt = `\n\n【当前心情】你现在的心情是${config.label}（${config.emoji}）。${config.responseStyle}`;

    // 根据连续互动添加额外说明
    if (mood.positiveStreak >= 3) {
      prompt += '\n最近的互动都很愉快，你感觉和用户的关系越来越好。';
    } else if (mood.negativeStreak >= 2) {
      prompt += '\n最近的互动有些消极，但你仍然会尽力保持友好。';
    }

    // 疲惫提示
    if (mood.totalInteractions > 20 && mood.currentMood !== 'tired') {
      prompt += '\n今天已经聊了很多，稍微有些累了。';
    }

    return prompt;
  }
}

// Singleton instance
let moodServiceInstance: MoodService | null = null;

export function getMoodService(): MoodService {
  if (!moodServiceInstance) {
    moodServiceInstance = new MoodService();
  }
  return moodServiceInstance;
}
