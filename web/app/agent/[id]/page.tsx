'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import {
  useAgentMetadata,
  useAgentLineage,
  useAgentState,
  useAgentOwner,
  useSealAgent,
  useBurnAgent,
} from '@/hooks/useContracts';
import { HOUSES, AgentState } from '@/config/contracts';

// 家族名称映射
const HOUSE_NAMES: Record<number, string> = {
  1: 'Clear 家族',
  2: 'Monsoon 家族',
  3: 'Thunder 家族',
  4: 'Frost 家族',
  5: 'Aurora 家族',
  6: 'Sand 家族',
  7: 'Eclipse 家族',
};

// 稀有度名称映射
const RARITY_NAMES: Record<string, string> = {
  'Common': '普通',
  'Uncommon': '稀有',
  'Rare': '精良',
  'Epic': '史诗',
  'Legendary': '传说',
  'Mythic': '神话',
};

// 特征名称映射
const TRAIT_NAMES: Record<string, string> = {
  'House': '家族',
  'RarityTier': '稀有度',
  'Generation': '世代',
  'WeatherID': '基因 ID',
  'FrameType': '框架类型',
  'CoreMaterial': '核心材质',
  'LightSignature': '光纹标识',
  'InstrumentMark': '器纹标记',
  'Atmosphere': '氛围',
  'DioramaGeometry': '场景几何',
  'PaletteTemperature': '色温',
  'SurfaceAging': '表面纹理',
  'MicroEngraving': '微雕',
  'LensBloom': '光晕',
};

interface TokenMetadata {
  name: string;
  description: string;
  image: string;
  attributes: { trait_type: string; value: string }[];
}

interface VaultData {
  id: string;
  tokenId: number;
  parentAId: number | null;
  parentBId: number | null;
  traits: Record<string, string>;
  summary: string;
  vaultHash: string;
  learningRoot: string;
  learningVersion: number;
}

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const tokenId = BigInt(id);

  const { address } = useAccount();
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [vault, setVault] = useState<VaultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const [imageError, setImageError] = useState(false);

  // On-chain data
  const { data: onChainMetadata } = useAgentMetadata(tokenId);
  const { data: lineage } = useAgentLineage(tokenId);
  const { data: agentState } = useAgentState(tokenId);
  const { data: owner } = useAgentOwner(tokenId);

  // Actions
  const { seal, isPending: sealPending, isSuccess: sealSuccess } = useSealAgent();
  const { burn, isPending: burnPending, isSuccess: burnSuccess } = useBurnAgent();

  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase();

  // Helper to get full image URL (handle relative paths from API)
  const getImageUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    // If it's already absolute (http/https/ipfs), return as is
    if (url.startsWith('http') || url.startsWith('ipfs://')) return url;
    // If it's relative, prepend API URL
    if (url.startsWith('/')) {
      return `${process.env.NEXT_PUBLIC_API_URL || ''}${url}`;
    }
    return url;
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [metaRes, vaultRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/metadata/${id}`),
          fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/vault/token/${id}`),
        ]);

        if (metaRes.ok) {
          setMetadata(await metaRes.json());
        }
        if (vaultRes.ok) {
          setVault(await vaultRes.json());
        }
      } catch (error) {
        console.error('Failed to load agent data:', error);
      }
      setLoading(false);
    }

    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
        <p className="mt-4 text-gray-400">加载智能体中...</p>
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-red-500">智能体未找到</h1>
        <p className="text-gray-400 mt-2">代币 #{id} 不存在。</p>
        <Link href="/gallery" className="mt-4 inline-block px-4 py-2 btn-primary">
          返回图鉴
        </Link>
      </div>
    );
  }

  const house = metadata.attributes.find(a => a.trait_type === 'House')?.value || 'Alpha';
  const rarity = metadata.attributes.find(a => a.trait_type === 'RarityTier')?.value || 'Common';
  const generation = lineage ? Number(lineage.generation) : (metadata.attributes.find(a => a.trait_type === 'Generation')?.value || '0');
  const weatherId = metadata.attributes.find(a => a.trait_type === 'WeatherID')?.value || '';

  // Group traits by category
  const coreTraits = ['FrameType', 'CoreMaterial', 'LightSignature', 'InstrumentMark'];
  const visualTraits = ['Atmosphere', 'DioramaGeometry', 'PaletteTemperature', 'SurfaceAging', 'MicroEngraving', 'LensBloom'];

  const stateLabel = agentState === AgentState.SEALED ? '已封印' : agentState === AgentState.BURNED ? '已销毁' : '活跃';
  const stateColor = agentState === AgentState.SEALED ? 'text-yellow-400' : agentState === AgentState.BURNED ? 'text-red-400' : 'text-green-400';

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/gallery" className="hover:text-amber-400">图鉴</Link>
        <span>/</span>
        <span className="text-white">智能体 #{id}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image Section */}
        <div>
          <div className="aspect-square rounded-xl overflow-hidden glass-card">
            {metadata.image && !imageError ? (
              <img
                src={getImageUrl(metadata.image)}
                alt={metadata.name}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${HOUSES[lineage?.houseId as keyof typeof HOUSES]?.color || '#fbbf24'}, transparent)`,
                }}
              >
                <span className="text-8xl font-bold text-white/30">#{id}</span>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRarityClass(rarity)}`}>
              {RARITY_NAMES[rarity] || rarity}
            </span>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-black/60 border border-amber-500/20">
              第 {generation} 代
            </span>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-black/60 border border-amber-500/20">
              {HOUSE_NAMES[lineage?.houseId || 1] || house}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium bg-black/60 border border-amber-500/20 ${stateColor}`}>
              {stateLabel}
            </span>
          </div>
        </div>

        {/* Details Section */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gold-gradient">
              {metadata.name.replace('HouseForge', 'KinForge').replace('House ', '')} — {HOUSE_NAMES[lineage?.houseId || 1] || house}
            </h1>
            <p className="text-gray-400 mt-2">
              在 KinForge 诞生的可交易非同质化智能体。血脉和学习记录可通过 vaultHash/learningRoot 验证；详细信息存储在保险库中。
            </p>
            <p className="text-amber-400 text-sm mt-2 font-mono">{weatherId}</p>
          </div>

          {/* Owner Info */}
          {owner && (
            <div className="glass-card p-4">
              <div className="text-xs text-gray-500 mb-1">持有者</div>
              <div className="font-mono text-sm break-all text-white">
                {owner}
                {isOwner && <span className="ml-2 text-green-400">(你)</span>}
              </div>
            </div>
          )}

          {/* Lineage */}
          {lineage && (lineage.parent1 > BigInt(0) || lineage.parent2 > BigInt(0)) && (
            <div className="glass-card p-4">
              <h2 className="text-lg font-bold mb-3 text-amber-400">血脉</h2>
              <div className="grid grid-cols-2 gap-4">
                {lineage.parent1 > BigInt(0) && (
                  <Link
                    href={`/agent/${lineage.parent1}`}
                    className="bg-black/60 rounded-lg p-3 hover:bg-amber-500/10 transition-colors border border-amber-500/20"
                  >
                    <div className="text-xs text-gray-500">亲本 A</div>
                    <div className="text-amber-400 font-medium">智能体 #{lineage.parent1.toString()}</div>
                  </Link>
                )}
                {lineage.parent2 > BigInt(0) && (
                  <Link
                    href={`/agent/${lineage.parent2}`}
                    className="bg-black/60 rounded-lg p-3 hover:bg-amber-500/10 transition-colors border border-amber-500/20"
                  >
                    <div className="text-xs text-gray-500">亲本 B</div>
                    <div className="text-amber-400 font-medium">智能体 #{lineage.parent2.toString()}</div>
                  </Link>
                )}
              </div>
              <Link
                href={`/tree?root=${id}`}
                className="inline-block mt-3 text-sm text-amber-400 hover:text-amber-300"
              >
                查看完整血脉树 →
              </Link>
            </div>
          )}

          {/* Core Traits */}
          <div className="glass-card p-4">
            <h2 className="text-lg font-bold mb-3 text-amber-400">核心特征</h2>
            <div className="grid grid-cols-2 gap-3">
              {metadata.attributes
                .filter(a => coreTraits.includes(a.trait_type))
                .map(attr => (
                  <div key={attr.trait_type} className="bg-black/60 rounded-lg p-3 border border-amber-500/10">
                    <div className="text-xs text-gray-500">{TRAIT_NAMES[attr.trait_type] || attr.trait_type}</div>
                    <div className="text-sm font-medium text-white">{attr.value}</div>
                  </div>
                ))}
            </div>
          </div>

          {/* Visual Traits */}
          <div className="glass-card p-4">
            <h2 className="text-lg font-bold mb-3 text-amber-400">视觉特征</h2>
            <div className="grid grid-cols-2 gap-3">
              {metadata.attributes
                .filter(a => visualTraits.includes(a.trait_type))
                .map(attr => (
                  <div key={attr.trait_type} className="bg-black/60 rounded-lg p-3 border border-amber-500/10">
                    <div className="text-xs text-gray-500">{TRAIT_NAMES[attr.trait_type] || attr.trait_type}</div>
                    <div className="text-sm font-medium text-white">{attr.value}</div>
                  </div>
                ))}
            </div>
          </div>

          {/* On-Chain Data */}
          {onChainMetadata && (
            <div className="glass-card p-4">
              <h2 className="text-lg font-bold mb-3 text-amber-400">链上数据</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">保险库 URI: </span>
                  <span className="font-mono text-xs break-all text-white">{onChainMetadata.vaultURI}</span>
                </div>
                <div>
                  <span className="text-gray-500">保险库哈希: </span>
                  <span className="font-mono text-xs break-all text-white">{onChainMetadata.vaultHash}</span>
                </div>
                <div>
                  <span className="text-gray-500">学习根: </span>
                  <span className="font-mono text-xs break-all text-white">{onChainMetadata.learningRoot}</span>
                </div>
                <div>
                  <span className="text-gray-500">学习版本: </span>
                  <span className="text-white">{onChainMetadata.learningVersion.toString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Vault Info */}
          {vault && (
            <div className="glass-card p-4">
              <h2 className="text-lg font-bold mb-3 text-amber-400">保险库摘要</h2>
              <p className="text-gray-300">{vault.summary}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-4">
            {agentState === AgentState.ACTIVE && (
              <Link
                href={`/fusion?parentA=${id}`}
                className="px-6 py-3 btn-primary"
              >
                用于融合
              </Link>
            )}

            {isOwner && agentState === AgentState.ACTIVE && (
              <>
                <button
                  onClick={() => setShowActions(!showActions)}
                  className="px-6 py-3 btn-secondary"
                >
                  持有者操作
                </button>

                {showActions && (
                  <div className="w-full glass-card p-4 space-y-3">
                    <p className="text-sm text-yellow-400">警告：这些操作不可逆转。</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => seal(tokenId)}
                        disabled={sealPending}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-sm transition-colors disabled:opacity-50 text-black font-medium"
                      >
                        {sealPending ? '封印中...' : '封印智能体'}
                      </button>
                      <button
                        onClick={() => burn(tokenId)}
                        disabled={burnPending}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors disabled:opacity-50 text-white font-medium"
                      >
                        {burnPending ? '销毁中...' : '销毁智能体'}
                      </button>
                    </div>
                    {sealSuccess && (
                      <p className="text-green-400 text-sm">智能体封印成功！</p>
                    )}
                    {burnSuccess && (
                      <p className="text-red-400 text-sm">智能体销毁成功！</p>
                    )}
                  </div>
                )}
              </>
            )}

            <Link
              href="/gallery"
              className="px-6 py-3 btn-secondary"
            >
              返回图鉴
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function getRarityClass(rarity: string): string {
  switch (rarity.toLowerCase()) {
    case 'mythic':
      return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold';
    case 'legendary':
      return 'bg-orange-500 text-black';
    case 'epic':
      return 'bg-purple-500 text-white';
    case 'rare':
      return 'bg-blue-500 text-white';
    case 'uncommon':
      return 'bg-green-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
}
