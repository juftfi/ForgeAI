'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// 家族颜色
const HOUSE_COLORS: Record<number, string> = {
  1: '#60A5FA', // CLEAR
  2: '#34D399', // MONSOON
  3: '#A78BFA', // THUNDER
  4: '#93C5FD', // FROST
  5: '#F472B6', // AURORA
  6: '#FBBF24', // SAND
  7: '#6B7280', // ECLIPSE
};

// 家族名称映射
const HOUSE_NAMES: Record<number, string> = {
  1: 'Clear 晴空',
  2: 'Monsoon 季风',
  3: 'Thunder 雷霆',
  4: 'Frost 霜冻',
  5: 'Aurora 极光',
  6: 'Sand 沙尘',
  7: 'Eclipse 日蚀',
};

// 稀有度映射
const RARITY_NAMES: Record<string, string> = {
  'Common': '普通',
  'Uncommon': '稀有',
  'Rare': '精良',
  'Epic': '史诗',
  'Mythic': '神话',
};

interface AgentCardData {
  tokenId: number;
  houseId: number;
  generation: number;
  sealed: boolean;
  metadata?: {
    name: string;
    attributes: { trait_type: string; value: string }[];
  };
}

function AgentCard({ agent, onSelect }: { agent: AgentCardData; onSelect?: (id: number) => void }) {
  const color = HOUSE_COLORS[agent.houseId] || '#fbbf24';
  const rarity = agent.metadata?.attributes.find(a => a.trait_type === 'RarityTier')?.value || 'Common';
  const weatherId = agent.metadata?.attributes.find(a => a.trait_type === 'WeatherID')?.value;

  return (
    <div
      className="glass-card overflow-hidden hover:border-amber-500/50 transition-all group cursor-pointer"
      onClick={() => onSelect?.(agent.tokenId)}
    >
      {/* 卡片头部 - 颜色条 */}
      <div
        className="h-24 flex items-center justify-center relative"
        style={{
          background: `linear-gradient(135deg, ${color}40, transparent)`,
        }}
      >
        <span className="text-4xl font-bold text-white/20">#{agent.tokenId}</span>
        <div className={`absolute top-2 right-2 text-xs px-2 py-1 rounded ${
          agent.sealed ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
        }`}>
          {agent.sealed ? '已封印' : '活跃'}
        </div>
      </div>

      {/* 卡片内容 */}
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-white">智能体 #{agent.tokenId}</h3>
            <p className="text-sm text-gray-400">{weatherId || `Gen ${agent.generation}`}</p>
          </div>
          <div
            className="px-2 py-1 rounded text-xs font-medium"
            style={{ backgroundColor: `${color}30`, color }}
          >
            {HOUSE_NAMES[agent.houseId] || `House ${agent.houseId}`}
          </div>
        </div>

        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 bg-gray-800 rounded text-gray-300">
            第 {agent.generation} 代
          </span>
          <span className={`px-2 py-1 rounded ${
            rarity === 'Mythic' ? 'bg-purple-500/20 text-purple-400' :
            rarity === 'Epic' ? 'bg-orange-500/20 text-orange-400' :
            rarity === 'Rare' ? 'bg-blue-500/20 text-blue-400' :
            rarity === 'Uncommon' ? 'bg-green-500/20 text-green-400' :
            'bg-gray-700 text-gray-300'
          }`}>
            {RARITY_NAMES[rarity] || rarity}
          </span>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2 pt-2">
          <Link
            href={`/agent/${agent.tokenId}`}
            className="flex-1 text-center py-2 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            查看详情
          </Link>
          {!agent.sealed && (
            <Link
              href={`/fusion?parentA=${agent.tokenId}`}
              className="flex-1 text-center py-2 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              去融合
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MyAgentsPage() {
  const { address, isConnected } = useAccount();
  const [agents, setAgents] = useState<AgentCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<number[]>([]);

  useEffect(() => {
    if (!isConnected || !address) {
      setAgents([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${API_URL}/user/${address}/tokens`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        setAgents(data.tokens || []);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[MyAgents] Failed to load:', err);
        setError('加载失败，请稍后重试');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isConnected, address]);

  const handleSelect = (tokenId: number) => {
    setSelectedAgents(prev => {
      if (prev.includes(tokenId)) {
        return prev.filter(id => id !== tokenId);
      }
      if (prev.length < 2) {
        return [...prev, tokenId];
      }
      return [prev[1], tokenId];
    });
  };

  const activeAgents = agents.filter(a => !a.sealed);
  const sealedAgents = agents.filter(a => a.sealed);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gold-gradient">我的智能体</h1>
        <p className="text-gray-400 mt-2">
          管理你的基因智能体，发起融合创造新生命
        </p>
      </div>

      {/* Connection Check */}
      {!isConnected ? (
        <div className="glass-card p-12 text-center">
          <div className="text-6xl mb-4">🔌</div>
          <h2 className="text-xl font-bold text-white mb-2">请连接钱包</h2>
          <p className="text-gray-400">连接你的钱包以查看拥有的智能体</p>
        </div>
      ) : loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">加载中...</p>
        </div>
      ) : error ? (
        <div className="glass-card p-12 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">{error}</h2>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded transition-colors"
          >
            重新加载
          </button>
        </div>
      ) : agents.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="text-6xl mb-4">🧬</div>
          <h2 className="text-xl font-bold text-white mb-2">你还没有智能体</h2>
          <p className="text-gray-400 mb-6">去铸造你的第一个创世智能体吧！</p>
          <Link href="/mint" className="btn-primary px-8 py-3">
            去铸造
          </Link>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-4 text-center">
              <div className="text-3xl font-bold text-amber-400">{agents.length}</div>
              <div className="text-sm text-gray-400">总数量</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-3xl font-bold text-green-400">{activeAgents.length}</div>
              <div className="text-sm text-gray-400">活跃</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-3xl font-bold text-yellow-400">{sealedAgents.length}</div>
              <div className="text-sm text-gray-400">已封印</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-3xl font-bold text-purple-400">
                {new Set(agents.map(a => a.houseId)).size}
              </div>
              <div className="text-sm text-gray-400">家族数</div>
            </div>
          </div>

          {/* Quick Fusion */}
          {selectedAgents.length > 0 && (
            <div className="glass-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-gray-400">已选择:</span>
                {selectedAgents.map(id => (
                  <span key={id} className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded">
                    #{id}
                  </span>
                ))}
              </div>
              {selectedAgents.length === 2 && (
                <Link
                  href={`/fusion?parentA=${selectedAgents[0]}&parentB=${selectedAgents[1]}`}
                  className="btn-primary px-6 py-2"
                >
                  开始融合
                </Link>
              )}
              <button
                onClick={() => setSelectedAgents([])}
                className="text-gray-400 hover:text-white"
              >
                清除选择
              </button>
            </div>
          )}

          <p className="text-sm text-gray-500 text-center">
            点击卡片选择智能体进行融合（最多选2个）
          </p>

          {/* Active Agents */}
          {activeAgents.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-green-400 rounded-full"></span>
                活跃的智能体 ({activeAgents.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {activeAgents.map(agent => (
                  <div
                    key={agent.tokenId}
                    className={`relative ${selectedAgents.includes(agent.tokenId) ? 'ring-2 ring-amber-500' : ''}`}
                  >
                    <AgentCard agent={agent} onSelect={handleSelect} />
                    {selectedAgents.includes(agent.tokenId) && (
                      <div className="absolute top-2 left-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-black text-xs font-bold">
                        {selectedAgents.indexOf(agent.tokenId) + 1}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sealed Agents */}
          {sealedAgents.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-yellow-400 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
                已封印的智能体 ({sealedAgents.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sealedAgents.map(agent => (
                  <AgentCard key={agent.tokenId} agent={agent} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
