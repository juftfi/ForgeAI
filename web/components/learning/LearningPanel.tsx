'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface PersonaVector {
  calm: number;
  curious: number;
  bold: number;
  social: number;
  disciplined: number;
}

interface LearningSnapshot {
  id: string;
  tokenId: number;
  version: number;
  personaDelta: PersonaVector;
  memoriesHash: string;
  summary: string;
  learningRoot: string;
  createdAt: string;
  syncedToChain: boolean;
}

interface LearningHistory {
  tokenId: number;
  currentVersion: number;
  totalMemories: number;
  currentPersona: PersonaVector;
  snapshots: LearningSnapshot[];
}

interface LearningPanelProps {
  tokenId: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Persona trait labels
const PERSONA_LABELS: Record<keyof PersonaVector, { name: string; positive: string; negative: string; emoji: string }> = {
  calm: { name: '冷静', positive: '沉着', negative: '活跃', emoji: '🧘' },
  curious: { name: '好奇', positive: '探索', negative: '保守', emoji: '🔍' },
  bold: { name: '大胆', positive: '果敢', negative: '谨慎', emoji: '⚡' },
  social: { name: '社交', positive: '外向', negative: '内敛', emoji: '👥' },
  disciplined: { name: '自律', positive: '有序', negative: '随性', emoji: '📐' },
};

// 性格变化方向描述
const getPersonaChangeDescription = (current: PersonaVector, previous?: PersonaVector): string[] => {
  if (!previous) return [];
  const changes: string[] = [];
  const threshold = 0.05;

  const keys = Object.keys(PERSONA_LABELS) as (keyof PersonaVector)[];
  for (const key of keys) {
    const diff = current[key] - previous[key];
    const label = PERSONA_LABELS[key];
    if (diff > threshold) {
      changes.push(`${label.emoji} ${label.positive}↑`);
    } else if (diff < -threshold) {
      changes.push(`${label.emoji} ${label.negative}↑`);
    }
  }
  return changes;
};

export default function LearningPanel({ tokenId }: LearningPanelProps) {
  const { address, isConnected } = useAccount();
  const [history, setHistory] = useState<LearningHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch learning history (requires wallet connection for ownership verification)
  useEffect(() => {
    const fetchHistory = async () => {
      if (!isConnected || !address) {
        setError('请先连接钱包查看学习历史');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE}/agent/${tokenId}/learning?userAddress=${address}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '获取学习历史失败');
        }
        const data = await res.json();
        setHistory(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [tokenId, isConnected, address]);

  // Create new snapshot
  const createSnapshot = async () => {
    if (!isConnected || !address) {
      setError('请先连接钱包');
      return;
    }

    setIsSyncing(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/agent/${tokenId}/learning/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: address }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '创建快照失败');
      }

      // Refresh history
      const historyRes = await fetch(`${API_BASE}/agent/${tokenId}/learning?userAddress=${address}`);
      const data = await historyRes.json();
      setHistory(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // 获取初始性格（第一个快照之前或默认值）
  const initialPersona: PersonaVector = {
    calm: 0,
    curious: 0,
    bold: 0,
    social: 0,
    disciplined: 0,
  };

  // 计算性格变化描述
  const personaChanges = history ? getPersonaChangeDescription(history.currentPersona, initialPersona) : [];

  // Render persona radar chart (simplified bar visualization)
  const renderPersonaChart = (persona: PersonaVector) => {
    return (
      <div className="space-y-3">
        {(Object.keys(PERSONA_LABELS) as (keyof PersonaVector)[]).map((key) => {
          const value = persona[key];
          const label = PERSONA_LABELS[key];
          const isPositive = value > 0;
          const absValue = Math.abs(value);

          return (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-1">
                  <span>{label.emoji}</span>
                  <span>{label.name}</span>
                </span>
                <span className={`${absValue > 0.3 ? 'text-amber-400' : 'text-gray-300'}`}>
                  {value > 0.3 ? label.positive : value < -0.3 ? label.negative : '平衡'}
                  {absValue > 0.1 && (
                    <span className="ml-1 text-xs text-gray-500">
                      ({isPositive ? '+' : ''}{(value * 100).toFixed(0)}%)
                    </span>
                  )}
                </span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden relative">
                {/* 中心线标记 */}
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-500 z-10" />
                {/* 进度条 */}
                <div
                  className={`h-full transition-all duration-500 ${
                    isPositive
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 ml-[50%]'
                      : 'bg-gradient-to-l from-orange-500 to-red-500 mr-[50%] float-right'
                  }`}
                  style={{ width: `${absValue * 50}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900/50 rounded-lg border border-gray-700">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900/50 rounded-lg border border-gray-700">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  if (!history) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900/50 rounded-lg border border-gray-700">
        <div className="text-gray-400">暂无学习数据</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-4 space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-400">{history.currentVersion}</div>
          <div className="text-xs text-gray-500">学习版本</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-400">{history.totalMemories}</div>
          <div className="text-xs text-gray-500">记忆总数</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-purple-400">{history.snapshots.length}</div>
          <div className="text-xs text-gray-500">成长快照</div>
        </div>
      </div>

      {/* Current Persona */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-300">当前性格向量</h3>
          {personaChanges.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {personaChanges.map((change, i) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                  {change}
                </span>
              ))}
            </div>
          )}
        </div>
        {renderPersonaChart(history.currentPersona)}
        <p className="text-xs text-gray-500 mt-2 text-center">
          性格会随着对话互动而逐渐进化
        </p>
      </div>

      {/* Snapshots Timeline */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-300">成长历史</h3>
          <button
            onClick={createSnapshot}
            disabled={isSyncing}
            className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded transition-colors"
          >
            {isSyncing ? '处理中...' : '创建快照'}
          </button>
        </div>

        {history.snapshots.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            暂无成长快照，与 Agent 对话后可以创建
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {history.snapshots.map((snapshot) => (
              <div
                key={snapshot.id}
                className="bg-gray-800/50 rounded-lg p-3 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      v{snapshot.version}
                    </span>
                    {snapshot.syncedToChain ? (
                      <span className="text-xs px-2 py-0.5 bg-green-900/50 text-green-400 rounded">
                        已上链
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-yellow-900/50 text-yellow-400 rounded">
                        本地
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(snapshot.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-2">{snapshot.summary}</p>
                <div className="text-xs text-gray-600 font-mono truncate">
                  learningRoot: {snapshot.learningRoot.slice(0, 18)}...
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Latest learningRoot */}
      {history.snapshots.length > 0 && (
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">最新 learningRoot</div>
          <div className="text-xs font-mono text-gray-400 break-all">
            {history.snapshots[0].learningRoot}
          </div>
        </div>
      )}
    </div>
  );
}
