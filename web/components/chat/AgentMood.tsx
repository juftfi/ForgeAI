'use client';

import { useState, useEffect } from 'react';

interface MoodHistory {
  mood: string;
  timestamp: string;
}

interface AgentMoodData {
  tokenId: number;
  currentMood: string;
  moodLabel: string;
  moodEmoji: string;
  moodColor: string;
  moodIntensity: number;
  moodStability: number;
  positiveStreak: number;
  negativeStreak: number;
  totalInteractions: number;
  lastInteractionAt?: string;
  recentMoodHistory: MoodHistory[];
}

interface AgentMoodProps {
  tokenId: number;
  compact?: boolean;  // 紧凑模式，只显示emoji和标签
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// 心情配置
const moodConfig: Record<string, { emoji: string; label: string; bgClass: string; description: string }> = {
  joyful: {
    emoji: '😄',
    label: '愉悦',
    bgClass: 'bg-yellow-500/20 border-yellow-500/30',
    description: '心情很好，充满活力',
  },
  content: {
    emoji: '😊',
    label: '满足',
    bgClass: 'bg-green-500/20 border-green-500/30',
    description: '感到平和满足',
  },
  neutral: {
    emoji: '😐',
    label: '平静',
    bgClass: 'bg-gray-500/20 border-gray-500/30',
    description: '心情平稳',
  },
  melancholy: {
    emoji: '😔',
    label: '忧郁',
    bgClass: 'bg-blue-500/20 border-blue-500/30',
    description: '有些低落',
  },
  irritated: {
    emoji: '😤',
    label: '烦躁',
    bgClass: 'bg-red-500/20 border-red-500/30',
    description: '有点不耐烦',
  },
  curious: {
    emoji: '🤔',
    label: '好奇',
    bgClass: 'bg-purple-500/20 border-purple-500/30',
    description: '对一切充满兴趣',
  },
  energetic: {
    emoji: '⚡',
    label: '充沛',
    bgClass: 'bg-amber-500/20 border-amber-500/30',
    description: '精力充沛',
  },
  tired: {
    emoji: '😴',
    label: '疲惫',
    bgClass: 'bg-gray-600/20 border-gray-600/30',
    description: '需要休息',
  },
};

export default function AgentMood({ tokenId, compact = false }: AgentMoodProps) {
  const [mood, setMood] = useState<AgentMoodData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMood = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`${API_BASE}/agent/${tokenId}/mood`);
        if (!res.ok) throw new Error('获取心情失败');
        const data = await res.json();
        setMood(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMood();

    // 每30秒刷新一次心情
    const interval = setInterval(fetchMood, 30000);
    return () => clearInterval(interval);
  }, [tokenId]);

  if (isLoading) {
    return compact ? (
      <span className="inline-flex items-center gap-1 text-gray-500">
        <span className="animate-pulse">💭</span>
      </span>
    ) : (
      <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-4 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-24"></div>
      </div>
    );
  }

  if (error || !mood) {
    return compact ? null : (
      <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-4 text-gray-500 text-sm">
        无法获取心情状态
      </div>
    );
  }

  const config = moodConfig[mood.currentMood] || moodConfig.neutral;

  // 紧凑模式
  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm ${config.bgClass} border`}
        title={config.description}
      >
        <span>{config.emoji}</span>
        <span className="text-white/80">{config.label}</span>
      </span>
    );
  }

  // 完整模式
  return (
    <div className={`rounded-lg border p-4 ${config.bgClass}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>💭</span>
          <span>智能体心情</span>
        </h3>
        <span className="text-3xl">{config.emoji}</span>
      </div>

      {/* 当前心情 */}
      <div className="mb-4">
        <div className="text-2xl font-bold text-white mb-1">{config.label}</div>
        <div className="text-sm text-gray-400">{config.description}</div>
      </div>

      {/* 心情指标 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-black/30 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">心情强度</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gray-500 to-white transition-all"
                style={{ width: `${mood.moodIntensity * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">{Math.round(mood.moodIntensity * 100)}%</span>
          </div>
        </div>
        <div className="bg-black/30 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">情绪稳定度</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all"
                style={{ width: `${mood.moodStability * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">{Math.round(mood.moodStability * 100)}%</span>
          </div>
        </div>
      </div>

      {/* 互动统计 */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          {mood.positiveStreak > 0 && (
            <span className="text-green-400 flex items-center gap-1">
              <span>😊</span>
              <span>连续 {mood.positiveStreak} 次正面互动</span>
            </span>
          )}
          {mood.negativeStreak > 0 && (
            <span className="text-orange-400 flex items-center gap-1">
              <span>😕</span>
              <span>连续 {mood.negativeStreak} 次消极互动</span>
            </span>
          )}
        </div>
        <span className="text-gray-500">
          共 {mood.totalInteractions} 次互动
        </span>
      </div>

      {/* 最近心情变化 */}
      {mood.recentMoodHistory.length > 1 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="text-xs text-gray-500 mb-2">最近心情变化</div>
          <div className="flex items-center gap-1">
            {mood.recentMoodHistory.slice().reverse().map((item, idx) => {
              const itemConfig = moodConfig[item.mood] || moodConfig.neutral;
              return (
                <span
                  key={idx}
                  className="text-lg transition-all hover:scale-125"
                  title={`${itemConfig.label} - ${new Date(item.timestamp).toLocaleString('zh-CN')}`}
                >
                  {itemConfig.emoji}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 最后互动时间 */}
      {mood.lastInteractionAt && (
        <div className="mt-3 text-xs text-gray-500">
          最后互动: {new Date(mood.lastInteractionAt).toLocaleString('zh-CN')}
        </div>
      )}
    </div>
  );
}
