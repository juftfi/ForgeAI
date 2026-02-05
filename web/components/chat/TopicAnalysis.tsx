'use client';

import { useState, useEffect } from 'react';

interface TopicInfo {
  topic: string;
  count: number;
  percentage?: number;
  label: string;
  emoji: string;
  color: string;
}

interface RecentTopic {
  id: string;
  sessionId: string;
  topic: string;
  confidence: number;
  messageCount: number;
  createdAt: string;
  label: string;
  emoji: string;
}

interface TopicStatsData {
  tokenId: number;
  totalTopics: number;
  topTopics: TopicInfo[];
  distribution: TopicInfo[];
  recentTopics: RecentTopic[];
}

interface TopicAnalysisProps {
  tokenId: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function TopicAnalysis({ tokenId }: TopicAnalysisProps) {
  const [data, setData] = useState<TopicStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`${API_BASE}/agent/${tokenId}/topics`);
        if (!res.ok) throw new Error('获取主题数据失败');
        const result = await res.json();
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopics();
  }, [tokenId]);

  if (isLoading) {
    return (
      <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-32 mb-4"></div>
        <div className="space-y-3">
          <div className="h-8 bg-gray-700 rounded"></div>
          <div className="h-8 bg-gray-700 rounded"></div>
          <div className="h-8 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-6 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (!data || data.totalTopics === 0) {
    return (
      <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-6 text-center">
        <span className="text-4xl mb-4 block">📊</span>
        <p className="text-gray-400">暂无主题数据</p>
        <p className="text-xs text-gray-500 mt-2">开始与智能体对话后，这里将显示话题分析</p>
      </div>
    );
  }

  const displayTopics = showAll ? data.distribution : data.distribution.slice(0, 5);
  const maxCount = Math.max(...data.distribution.map(t => t.count));

  return (
    <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>📊</span>
          <span>话题分析</span>
        </h3>
        <span className="text-sm text-gray-500">
          共 {data.totalTopics} 个话题
        </span>
      </div>

      {/* 主题词云/标签 */}
      <div className="flex flex-wrap gap-2">
        {data.topTopics.slice(0, 6).map((topic, idx) => (
          <span
            key={topic.topic}
            className="px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1"
            style={{
              backgroundColor: `${topic.color}20`,
              borderColor: `${topic.color}40`,
              color: topic.color,
              borderWidth: '1px',
              fontSize: idx < 2 ? '0.95rem' : '0.85rem',
            }}
          >
            <span>{topic.emoji}</span>
            <span>{topic.label}</span>
            {topic.percentage !== undefined && (
              <span className="text-xs opacity-70">({topic.percentage}%)</span>
            )}
          </span>
        ))}
      </div>

      {/* 主题分布图 */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-400">话题分布</h4>
        <div className="space-y-2">
          {displayTopics.map((topic) => (
            <div key={topic.topic} className="flex items-center gap-3">
              <span className="w-8 text-center text-lg">{topic.emoji}</span>
              <span className="w-20 text-sm text-gray-400 truncate" title={topic.label}>
                {topic.label}
              </span>
              <div className="flex-1 h-6 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                  style={{
                    width: `${Math.max(10, (topic.count / maxCount) * 100)}%`,
                    backgroundColor: topic.color,
                    opacity: 0.8,
                  }}
                >
                  <span className="text-xs font-medium text-white/90">{topic.count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {data.distribution.length > 5 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
          >
            {showAll ? '收起' : `查看全部 ${data.distribution.length} 个话题`}
          </button>
        )}
      </div>

      {/* 最近话题 */}
      {data.recentTopics.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-400">最近话题</h4>
          <div className="flex flex-wrap gap-2">
            {data.recentTopics.slice(0, 8).map((topic) => (
              <span
                key={topic.id}
                className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300 flex items-center gap-1"
                title={`${topic.label} - ${new Date(topic.createdAt).toLocaleString('zh-CN')}`}
              >
                <span>{topic.emoji}</span>
                <span>{topic.label}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 话题洞察 */}
      {data.topTopics.length > 0 && (
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-2">💡 话题洞察</h4>
          <p className="text-sm text-gray-300">
            您与这位智能体最常讨论的话题是
            <span className="font-medium" style={{ color: data.topTopics[0].color }}>
              {' '}{data.topTopics[0].emoji} {data.topTopics[0].label}
            </span>
            {data.topTopics.length > 1 && (
              <>
                ，其次是
                <span className="font-medium" style={{ color: data.topTopics[1].color }}>
                  {' '}{data.topTopics[1].emoji} {data.topTopics[1].label}
                </span>
              </>
            )}
            。
            {data.topTopics[0].percentage && data.topTopics[0].percentage > 40 && (
              <span className="text-gray-400">
                {' '}看来您对{data.topTopics[0].label}话题特别感兴趣！
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
