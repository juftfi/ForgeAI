'use client';

import { useState, useEffect } from 'react';

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
const PERSONA_LABELS: Record<keyof PersonaVector, { name: string; positive: string; negative: string }> = {
  calm: { name: '冷静', positive: '沉着', negative: '活跃' },
  curious: { name: '好奇', positive: '探索', negative: '保守' },
  bold: { name: '大胆', positive: '果敢', negative: '谨慎' },
  social: { name: '社交', positive: '外向', negative: '内敛' },
  disciplined: { name: '自律', positive: '有序', negative: '随性' },
};

export default function LearningPanel({ tokenId }: LearningPanelProps) {
  const [history, setHistory] = useState<LearningHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch learning history
  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE}/agent/${tokenId}/learning`);
        if (!res.ok) {
          throw new Error('获取学习历史失败');
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
  }, [tokenId]);

  // Create new snapshot
  const createSnapshot = async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/agent/${tokenId}/learning/snapshot`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '创建快照失败');
      }

      // Refresh history
      const historyRes = await fetch(`${API_BASE}/agent/${tokenId}/learning`);
      const data = await historyRes.json();
      setHistory(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Render persona radar chart (simplified bar visualization)
  const renderPersonaChart = (persona: PersonaVector) => {
    return (
      <div className="space-y-3">
        {(Object.keys(PERSONA_LABELS) as (keyof PersonaVector)[]).map((key) => {
          const value = persona[key];
          const label = PERSONA_LABELS[key];
          const percentage = ((value + 1) / 2) * 100; // Convert -1~1 to 0~100

          return (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{label.name}</span>
                <span className="text-gray-300">
                  {value > 0.3 ? label.positive : value < -0.3 ? label.negative : '平衡'}
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
                  style={{ width: `${percentage}%` }}
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
        <h3 className="text-sm font-medium text-gray-300 mb-3">当前性格向量</h3>
        {renderPersonaChart(history.currentPersona)}
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
