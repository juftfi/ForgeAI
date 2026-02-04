'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useAgentBalance, useContractAddress } from '@/hooks/useContracts';
import { HOUSES, HOUSE_FORGE_AGENT_ABI } from '@/config/contracts';
import { useReadContracts } from 'wagmi';

// 特性名称中英文映射
const TRAIT_NAMES_CN: Record<string, string> = {
  // 基本信息
  'Season': '季节',
  'House': '家族',
  'RarityTier': '稀有度',
  'Generation': '世代',
  'WeatherID': '气象编号',
  // 外观特性
  'FrameType': '框架类型',
  'CoreMaterial': '核心材质',
  'LightSignature': '光纹特征',
  'InstrumentMark': '仪表标记',
  'Atmosphere': '氛围',
  'DioramaGeometry': '透视结构',
  'PaletteTemperature': '色温',
  'SurfaceAging': '表面质感',
  'MicroEngraving': '微雕',
  'LensBloom': '镜头光晕',
  // 行为特性
  'Eye Style': '眼睛样式',
  'EyeStyle': '眼睛样式',
  'Accent Mark': '装饰标记',
  'AccentMark': '装饰标记',
  'Voice Tone': '声音音调',
  'VoiceTone': '声音音调',
  'Behavior Mode': '行为模式',
  'BehaviorMode': '行为模式',
  'Data Preference': '数据偏好',
  'DataPreference': '数据偏好',
  'Energy Pattern': '能量模式',
  'EnergyPattern': '能量模式',
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
  'Rare': '珍稀',
  'Epic': '史诗',
  'Mythic': '神话',
};

interface AgentCardData {
  tokenId: number;
  houseId: number;
  generation: number;
  sealed: boolean;
  state: number;
  metadata?: {
    name: string;
    attributes: { trait_type: string; value: string }[];
  };
}

function AgentCard({ agent, onSelect }: { agent: AgentCardData; onSelect?: (id: number) => void }) {
  const house = HOUSES[agent.houseId as keyof typeof HOUSES];
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
          background: `linear-gradient(135deg, ${house?.color || '#fbbf24'}40, transparent)`,
        }}
      >
        <span className="text-4xl font-bold text-white/20">#{agent.tokenId}</span>
        {/* 状态标签 */}
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
            style={{ backgroundColor: `${house?.color}30`, color: house?.color }}
          >
            {HOUSE_NAMES[agent.houseId] || house?.name}
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
  const { data: balance, isLoading: isBalanceLoading } = useAgentBalance(address);
  const [agents, setAgents] = useState<AgentCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgents, setSelectedAgents] = useState<number[]>([]);

  const agentContractAddress = useContractAddress('HouseForgeAgent');

  // 获取总供应量
  const { data: totalSupply, isLoading: isTotalSupplyLoading } = useReadContracts({
    contracts: [{
      address: agentContractAddress,
      abi: HOUSE_FORGE_AGENT_ABI,
      functionName: 'totalSupply',
    }],
    query: { enabled: !!agentContractAddress },
  });

  const supply = totalSupply?.[0]?.result as bigint | undefined;

  // 创建所有可能的tokenId列表 (1 到 totalSupply)
  // 注意：合约中tokenId从1开始，不是0
  const allTokenIds = supply ? Array.from({ length: Number(supply) }, (_, i) => BigInt(i + 1)) : [];

  // 批量查询所有token的ownerOf - 合约不支持ERC721Enumerable，所以需要遍历所有token
  const { data: owners, isLoading: isOwnersLoading } = useReadContracts({
    contracts: allTokenIds.map(tokenId => ({
      address: agentContractAddress,
      abi: HOUSE_FORGE_AGENT_ABI,
      functionName: 'ownerOf',
      args: [tokenId],
    })),
    query: { enabled: allTokenIds.length > 0 },
  });

  // 筛选出属于当前用户的tokenIds
  const userTokenIds = allTokenIds.filter((tokenId, index) => {
    const owner = owners?.[index]?.result as string | undefined;
    return owner && address && owner.toLowerCase() === address.toLowerCase();
  });

  // 批量读取lineage
  const { data: lineages, isLoading: isLineagesLoading } = useReadContracts({
    contracts: userTokenIds.map(tokenId => ({
      address: agentContractAddress,
      abi: HOUSE_FORGE_AGENT_ABI,
      functionName: 'getLineage',
      args: [tokenId],
    })),
    query: { enabled: userTokenIds.length > 0 },
  });

  // 加载metadata并组装数据
  useEffect(() => {
    async function loadAgents() {
      // 如果还在加载基础数据，等待
      if (isBalanceLoading || isTotalSupplyLoading || isOwnersLoading || isLineagesLoading) {
        return;
      }

      // 如果没有余额或为0，设置为空
      if (!balance || Number(balance) === 0) {
        setAgents([]);
        setLoading(false);
        return;
      }

      // 如果userTokenIds还没加载完成
      if (!userTokenIds.length) {
        // 可能owners还没返回
        if (owners && owners.length > 0) {
          // owners已返回但没找到用户的token
          setAgents([]);
          setLoading(false);
        }
        return;
      }

      // 如果lineages还没加载完成
      if (!lineages || lineages.length === 0) {
        return;
      }

      const agentData: AgentCardData[] = [];

      for (let i = 0; i < userTokenIds.length; i++) {
        const tokenId = Number(userTokenIds[i]);
        const lineage = lineages[i]?.result as any;

        if (!lineage) {
          console.log(`[MyAgents] No lineage for token ${tokenId}`);
          continue;
        }

        // 尝试加载metadata
        let metadata;
        try {
          const res = await fetch(`/metadata/${tokenId}.json`);
          if (res.ok) {
            metadata = await res.json();
          }
        } catch {
          // Metadata可能不存在（offspring）
        }

        agentData.push({
          tokenId,
          houseId: Number(lineage.houseId ?? lineage[3] ?? 1),
          generation: Number(lineage.generation ?? lineage[2] ?? 0),
          sealed: lineage.sealed ?? lineage.isSealed ?? lineage[4] ?? false,
          state: (lineage.sealed || lineage.isSealed) ? 1 : 0,
          metadata,
        });
      }

      // 按tokenId排序
      agentData.sort((a, b) => a.tokenId - b.tokenId);
      setAgents(agentData);
      setLoading(false);
    }

    loadAgents();
  }, [balance, userTokenIds, lineages, owners, isBalanceLoading, isTotalSupplyLoading, isOwnersLoading, isLineagesLoading]);

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
