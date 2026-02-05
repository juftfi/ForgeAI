'use client';

import { useState, useEffect } from 'react';

// 情绪类型
type EmotionType = 'happy' | 'sad' | 'angry' | 'anxious' | 'curious' | 'grateful' | 'confused' | 'neutral';

interface ChatStatsData {
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

interface ChatStatsProps {
  tokenId: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// 情绪配置
const emotionConfig: Record<EmotionType, { emoji: string; label: string; color: string; bgColor: string }> = {
  happy: { emoji: '😊', label: '开心', color: 'text-yellow-400', bgColor: 'bg-yellow-400' },
  sad: { emoji: '😢', label: '难过', color: 'text-blue-400', bgColor: 'bg-blue-400' },
  angry: { emoji: '😠', label: '愤怒', color: 'text-red-400', bgColor: 'bg-red-400' },
  anxious: { emoji: '😰', label: '焦虑', color: 'text-orange-400', bgColor: 'bg-orange-400' },
  curious: { emoji: '🤔', label: '好奇', color: 'text-purple-400', bgColor: 'bg-purple-400' },
  grateful: { emoji: '🙏', label: '感激', color: 'text-pink-400', bgColor: 'bg-pink-400' },
  confused: { emoji: '😵', label: '困惑', color: 'text-gray-400', bgColor: 'bg-gray-400' },
  neutral: { emoji: '😐', label: '平静', color: 'text-gray-300', bgColor: 'bg-gray-300' },
};

// 记忆类型配置
const memoryTypeConfig: Record<string, { label: string; icon: string }> = {
  fact: { label: '事实', icon: '📋' },
  preference: { label: '偏好', icon: '❤️' },
  experience: { label: '经历', icon: '🎯' },
  relationship: { label: '关系', icon: '🤝' },
};

export default function ChatStats({ tokenId }: ChatStatsProps) {
  const [stats, setStats] = useState<ChatStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`${API_BASE}/chat/stats/${tokenId}`);
        if (!res.ok) {
          throw new Error('获取统计数据失败');
        }
        const data = await res.json();
        setStats(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [tokenId]);

  if (isLoading) {
    return (
      <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-20 bg-gray-700 rounded"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-6">
        <p className="text-red-400 text-center">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  // 计算情绪分布总数
  const totalEmotions = Object.values(stats.emotionDistribution).reduce((a, b) => a + b, 0);

  // 获取情绪条形图数据（排除 neutral，按数量排序）
  const emotionBars = Object.entries(stats.emotionDistribution)
    .filter(([type]) => type !== 'neutral')
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const maxEmotionCount = emotionBars.length > 0 ? emotionBars[0][1] : 0;

  return (
    <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-6 space-y-6">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <span>📊</span>
        <span>对话统计</span>
      </h3>

      {/* 基础统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon="💬"
          label="总会话"
          value={stats.totalSessions}
        />
        <StatCard
          icon="✉️"
          label="总消息"
          value={stats.totalMessages}
        />
        <StatCard
          icon="📝"
          label="平均消息/会话"
          value={stats.avgMessagesPerSession}
        />
        <StatCard
          icon="🧠"
          label="记忆数量"
          value={stats.totalMemories}
        />
      </div>

      {/* 情绪分布 */}
      {totalEmotions > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <span>情绪分布</span>
            {stats.dominantEmotion && (
              <span className={`text-xs px-2 py-0.5 rounded ${emotionConfig[stats.dominantEmotion].color} bg-gray-800`}>
                主要: {emotionConfig[stats.dominantEmotion].emoji} {emotionConfig[stats.dominantEmotion].label}
              </span>
            )}
          </h4>
          <div className="space-y-2">
            {emotionBars.map(([type, count]) => {
              const config = emotionConfig[type as EmotionType];
              const percentage = maxEmotionCount > 0 ? (count / maxEmotionCount) * 100 : 0;
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="w-8 text-center">{config.emoji}</span>
                  <span className="w-12 text-xs text-gray-400">{config.label}</span>
                  <div className="flex-1 h-4 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${config.bgColor} transition-all duration-500`}
                      style={{ width: `${percentage}%`, opacity: 0.7 }}
                    />
                  </div>
                  <span className="w-8 text-xs text-gray-500 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 记忆分布 */}
      {stats.totalMemories > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-400">记忆类型</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.memoryCount).map(([type, count]) => {
              const config = memoryTypeConfig[type] || { label: type, icon: '📌' };
              return (
                <span
                  key={type}
                  className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300 flex items-center gap-1"
                >
                  <span>{config.icon}</span>
                  <span>{config.label}</span>
                  <span className="text-gray-500">({count})</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 时间信息 */}
      {(stats.firstChatAt || stats.lastChatAt) && (
        <div className="text-xs text-gray-500 flex flex-wrap gap-4">
          {stats.firstChatAt && (
            <span>
              首次对话: {new Date(stats.firstChatAt).toLocaleDateString('zh-CN')}
            </span>
          )}
          {stats.lastChatAt && (
            <span>
              最近对话: {new Date(stats.lastChatAt).toLocaleDateString('zh-CN')}
            </span>
          )}
        </div>
      )}

      {/* 空状态 */}
      {stats.totalSessions === 0 && (
        <div className="text-center py-8 text-gray-500">
          <span className="text-4xl mb-2 block">🤖</span>
          <p>还没有对话记录</p>
          <p className="text-xs mt-1">开始与智能体聊天，这里将显示互动统计</p>
        </div>
      )}
    </div>
  );
}

// 统计卡片组件
function StatCard({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}
