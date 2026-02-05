'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface ExpProgress {
  current: number;
  required: number;
  percentage: number;
}

interface RelationshipStats {
  totalSessions: number;
  totalMessages: number;
  positiveInteractions: number;
}

interface LevelInfo {
  level: number;
  title: string;
  titleEn: string;
  minExp: number;
  color: string;
}

interface RelationshipData {
  tokenId: number;
  userAddress: string;
  level: number;
  levelTitle: string;
  levelTitleEn: string;
  levelColor: string;
  benefits: string[];
  experiencePoints: number;
  expProgress: ExpProgress;
  stats: RelationshipStats;
  firstInteractionAt?: string;
  lastInteractionAt?: string;
  allLevels: LevelInfo[];
}

interface RelationshipPanelProps {
  tokenId: number;
  compact?: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// 等级图标
const levelIcons: Record<number, string> = {
  1: '🌱',
  2: '🌿',
  3: '🌳',
  4: '💫',
  5: '🌟',
  6: '✨',
  7: '💎',
};

export default function RelationshipPanel({ tokenId, compact = false }: RelationshipPanelProps) {
  const { address } = useAccount();
  const [data, setData] = useState<RelationshipData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setIsLoading(false);
      return;
    }

    const fetchRelationship = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(
          `${API_BASE}/agent/${tokenId}/relationship?userAddress=${address}`
        );
        if (!res.ok) throw new Error('获取关系数据失败');
        const result = await res.json();
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRelationship();
  }, [tokenId, address]);

  if (!address) {
    return compact ? null : (
      <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-4 text-center text-gray-500">
        <span className="text-2xl mb-2 block">🔗</span>
        <p>连接钱包查看你与智能体的关系</p>
      </div>
    );
  }

  if (isLoading) {
    return compact ? (
      <span className="inline-flex items-center gap-1 text-gray-500">
        <span className="animate-pulse">🔗</span>
      </span>
    ) : (
      <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-32 mb-4"></div>
        <div className="h-4 bg-gray-700 rounded w-full"></div>
      </div>
    );
  }

  if (error || !data) {
    return compact ? null : (
      <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-4 text-red-400 text-sm">
        {error || '无法加载关系数据'}
      </div>
    );
  }

  const levelIcon = levelIcons[data.level] || '🌱';

  // 紧凑模式
  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border"
        style={{
          backgroundColor: `${data.levelColor}20`,
          borderColor: `${data.levelColor}40`,
        }}
        title={`${data.levelTitle} - ${data.experiencePoints} EXP`}
      >
        <span>{levelIcon}</span>
        <span style={{ color: data.levelColor }}>{data.levelTitle}</span>
      </span>
    );
  }

  // 完整模式
  return (
    <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>🤝</span>
          <span>关系等级</span>
        </h3>
        <span className="text-3xl">{levelIcon}</span>
      </div>

      {/* 当前等级 */}
      <div className="text-center py-4">
        <div
          className="text-4xl font-bold mb-2"
          style={{ color: data.levelColor }}
        >
          {data.levelTitle}
        </div>
        <div className="text-sm text-gray-400">
          {data.levelTitleEn} · Lv.{data.level}
        </div>
      </div>

      {/* 经验进度条 */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">经验值</span>
          <span className="text-white">
            {data.expProgress.current} / {data.expProgress.required}
          </span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-500 rounded-full"
            style={{
              width: `${data.expProgress.percentage}%`,
              backgroundColor: data.levelColor,
            }}
          />
        </div>
        <div className="text-xs text-gray-500 text-right">
          总计 {data.experiencePoints} EXP
        </div>
      </div>

      {/* 等级进度 */}
      <div className="space-y-2">
        <div className="text-sm text-gray-400">等级进度</div>
        <div className="flex items-center justify-between gap-1">
          {data.allLevels.map((level) => (
            <div
              key={level.level}
              className={`flex-1 h-2 rounded-full transition-all ${
                level.level <= data.level ? 'opacity-100' : 'opacity-30'
              }`}
              style={{ backgroundColor: level.color }}
              title={`${level.title} (${level.minExp} EXP)`}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          {data.allLevels.filter((_, i) => i % 2 === 0).map((level) => (
            <span key={level.level}>{level.title}</span>
          ))}
        </div>
      </div>

      {/* 当前等级权益 */}
      {data.benefits.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-gray-400">当前权益</div>
          <div className="flex flex-wrap gap-2">
            {data.benefits.map((benefit, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300"
              >
                {benefit}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 互动统计 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-white">{data.stats.totalSessions}</div>
          <div className="text-xs text-gray-500">会话数</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-white">{data.stats.totalMessages}</div>
          <div className="text-xs text-gray-500">消息数</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-green-400">{data.stats.positiveInteractions}</div>
          <div className="text-xs text-gray-500">正面互动</div>
        </div>
      </div>

      {/* 时间信息 */}
      <div className="text-xs text-gray-500 space-y-1">
        {data.firstInteractionAt && (
          <div>相识于: {new Date(data.firstInteractionAt).toLocaleDateString('zh-CN')}</div>
        )}
        {data.lastInteractionAt && (
          <div>最近互动: {new Date(data.lastInteractionAt).toLocaleString('zh-CN')}</div>
        )}
      </div>
    </div>
  );
}
