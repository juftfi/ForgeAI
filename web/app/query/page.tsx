'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';
import { CONTRACTS, HOUSE_FORGE_AGENT_ABI, HOUSES } from '@/config/contracts';

const TIERS = ['Common', 'Uncommon', 'Rare', 'Epic', 'Mythic'] as const;
const TIER_LABELS: Record<string, string> = {
  Common: '普通',
  Uncommon: '稀有',
  Rare: '精良',
  Epic: '史诗',
  Mythic: '神话',
};
const TIER_COLORS: Record<string, string> = {
  Common: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  Uncommon: 'bg-green-500/20 text-green-400 border-green-500/30',
  Rare: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Epic: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Mythic: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const CONTRACT_ADDRESS = CONTRACTS.HouseForgeAgent[56];
const BSCSCAN_BASE = 'https://bscscan.com';

const publicClient = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed1.binance.org/'),
});

interface QueryResult {
  tokenId: number;
  rarity: string;
  rarityTier: number;
  house: string;
  houseId: number;
  houseColor: string;
  generation: number;
  sealed: boolean;
  parent1: number;
  parent2: number;
  owner: string;
}

export default function QueryPage() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState('');

  async function handleQuery() {
    const tokenId = parseInt(input.trim());
    if (isNaN(tokenId) || tokenId < 1) {
      setError('请输入有效的 Token ID（正整数）');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const [rarityTier, lineage, owner] = await Promise.all([
        publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: HOUSE_FORGE_AGENT_ABI,
          functionName: 'getRarityTier',
          args: [BigInt(tokenId)],
        }),
        publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: HOUSE_FORGE_AGENT_ABI,
          functionName: 'getLineage',
          args: [BigInt(tokenId)],
        }),
        publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: HOUSE_FORGE_AGENT_ABI,
          functionName: 'ownerOf',
          args: [BigInt(tokenId)],
        }),
      ]);

      const tierNum = Number(rarityTier);
      const houseId = Number((lineage as any).houseId);
      const houseInfo = HOUSES[houseId as keyof typeof HOUSES];

      setResult({
        tokenId,
        rarity: TIERS[tierNum] || 'Unknown',
        rarityTier: tierNum,
        house: houseInfo?.name || 'Unknown',
        houseId,
        houseColor: houseInfo?.color || '#fbbf24',
        generation: Number((lineage as any).generation),
        sealed: (lineage as any).isSealed,
        parent1: Number((lineage as any).parent1),
        parent2: Number((lineage as any).parent2),
        owner: owner as string,
      });
    } catch (e: any) {
      if (e?.message?.includes('revert') || e?.message?.includes('ERC721')) {
        setError(`Token #${tokenId} 不存在或已被销毁`);
      } else {
        setError('查询失败，请稍后重试');
        console.error(e);
      }
    }

    setLoading(false);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-gold-gradient">
          链上查询
        </h1>
        <p className="text-gray-400">
          直接从 BNB Chain 智能合约读取 NFT 数据，不经过任何中间服务器
        </p>
      </div>

      {/* Query Input */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-semibold mb-4 text-amber-400">查询智能体</h2>
        <div className="flex gap-3">
          <input
            type="number"
            min="1"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleQuery()}
            placeholder="输入 Token ID，例如 288"
            className="flex-1 px-4 py-3 bg-black/60 border border-amber-500/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 font-mono text-lg"
          />
          <button
            onClick={handleQuery}
            disabled={loading || !input.trim()}
            className="btn-primary px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '查询中...' : '查询'}
          </button>
        </div>
        {error && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-amber-400">
              KinForge Agent #{result.tokenId}
            </h2>
            <Link
              href={`/agent/${result.tokenId}`}
              className="text-amber-400 hover:text-amber-300 text-sm"
            >
              查看详情页 →
            </Link>
          </div>

          {/* Main Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Rarity */}
            <div className="p-4 bg-black/60 rounded-lg border border-amber-500/10 text-center">
              <div className="text-gray-400 text-sm mb-2">稀有度</div>
              <div className={`inline-block px-4 py-1.5 rounded-full border text-lg font-bold ${TIER_COLORS[result.rarity] || ''}`}>
                {TIER_LABELS[result.rarity] || result.rarity}
              </div>
              <div className="text-gray-500 text-xs mt-1">{result.rarity} (tier {result.rarityTier})</div>
            </div>

            {/* House */}
            <div className="p-4 bg-black/60 rounded-lg border border-amber-500/10 text-center">
              <div className="text-gray-400 text-sm mb-2">家族</div>
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: result.houseColor }} />
                <span className="text-lg font-bold text-white">{result.house}</span>
              </div>
              <div className="text-gray-500 text-xs mt-1">House ID: {result.houseId}</div>
            </div>

            {/* Generation */}
            <div className="p-4 bg-black/60 rounded-lg border border-amber-500/10 text-center">
              <div className="text-gray-400 text-sm mb-2">世代</div>
              <div className="text-2xl font-bold text-white">
                {result.generation === 0 ? '创世' : `第 ${result.generation} 代`}
              </div>
              <div className="text-gray-500 text-xs mt-1">Gen {result.generation}</div>
            </div>

            {/* Status */}
            <div className="p-4 bg-black/60 rounded-lg border border-amber-500/10 text-center">
              <div className="text-gray-400 text-sm mb-2">状态</div>
              <div className={`text-lg font-bold ${result.sealed ? 'text-yellow-400' : 'text-green-400'}`}>
                {result.sealed ? '已封印' : '活跃'}
              </div>
              <div className="text-gray-500 text-xs mt-1">{result.sealed ? 'Sealed' : 'Active'}</div>
            </div>
          </div>

          {/* Owner */}
          <div className="p-4 bg-black/60 rounded-lg border border-amber-500/10">
            <div className="text-gray-400 text-sm mb-1">持有者</div>
            <a
              href={`${BSCSCAN_BASE}/address/${result.owner}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-amber-400 hover:text-amber-300 break-all"
            >
              {result.owner}
            </a>
          </div>

          {/* Parents */}
          {result.parent1 > 0 && (
            <div className="p-4 bg-black/60 rounded-lg border border-amber-500/10">
              <div className="text-gray-400 text-sm mb-2">血脉（父母）</div>
              <div className="flex gap-4">
                <button
                  onClick={() => { setInput(String(result.parent1)); }}
                  className="text-amber-400 hover:text-amber-300 font-mono"
                >
                  #{result.parent1}
                </button>
                <span className="text-gray-500">×</span>
                <button
                  onClick={() => { setInput(String(result.parent2)); }}
                  className="text-amber-400 hover:text-amber-300 font-mono"
                >
                  #{result.parent2}
                </button>
              </div>
            </div>
          )}

          {/* Verification Link */}
          <div className="p-4 bg-amber-500/5 rounded-lg border border-amber-500/20">
            <div className="text-amber-400 text-sm font-semibold mb-2">链上验证</div>
            <p className="text-gray-400 text-sm mb-3">
              以上数据全部直接从 BNB Chain 智能合约读取，你可以在 BSCScan 上自行验证：
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={`${BSCSCAN_BASE}/address/${CONTRACT_ADDRESS}#readContract#F9`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary px-4 py-2 text-sm"
              >
                合约 Read 页面 ↗
              </a>
              <a
                href={`${BSCSCAN_BASE}/token/${CONTRACT_ADDRESS}?a=${result.tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary px-4 py-2 text-sm"
              >
                Token #{result.tokenId} 在 BSCScan ↗
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Section */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-semibold mb-4 text-amber-400">如何在 BSCScan 上自行验证</h2>

        <div className="space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm">
              1
            </div>
            <div>
              <h3 className="font-medium text-white mb-1">打开合约页面</h3>
              <p className="text-gray-400 text-sm mb-2">
                访问 BSCScan 上的 KinForgeAgent 合约，点击 &quot;Read Contract&quot; 标签页。
              </p>
              <a
                href={`${BSCSCAN_BASE}/address/${CONTRACT_ADDRESS}#readContract`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm"
              >
                {CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-8)} ↗
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm">
              2
            </div>
            <div>
              <h3 className="font-medium text-white mb-1">查询稀有度</h3>
              <p className="text-gray-400 text-sm mb-2">
                找到 <code className="px-1.5 py-0.5 bg-black/60 rounded text-amber-400 text-xs">getRarityTier</code> 函数，输入 Token ID，点击 Query。
              </p>
              <div className="p-3 bg-black/60 rounded-lg border border-amber-500/10 text-sm">
                <div className="text-gray-500 mb-1">返回值对照表：</div>
                <div className="grid grid-cols-5 gap-2">
                  {TIERS.map((tier, i) => (
                    <div key={tier} className="text-center">
                      <div className="text-white font-mono">{i}</div>
                      <div className={`text-xs mt-0.5 ${
                        i === 0 ? 'text-gray-400' :
                        i === 1 ? 'text-green-400' :
                        i === 2 ? 'text-blue-400' :
                        i === 3 ? 'text-purple-400' :
                        'text-amber-400'
                      }`}>
                        {TIER_LABELS[tier]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm">
              3
            </div>
            <div>
              <h3 className="font-medium text-white mb-1">查询血脉</h3>
              <p className="text-gray-400 text-sm mb-2">
                找到 <code className="px-1.5 py-0.5 bg-black/60 rounded text-amber-400 text-xs">getLineage</code> 函数，输入 Token ID。返回值包含父母 ID、世代、家族 ID、封印状态。
              </p>
              <div className="p-3 bg-black/60 rounded-lg border border-amber-500/10 text-sm">
                <div className="text-gray-500 mb-1">家族 ID 对照表：</div>
                <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                  {Object.entries(HOUSES).map(([id, house]) => (
                    <div key={id} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: house.color }} />
                      <span className="text-xs">
                        <span className="text-white font-mono">{id}</span>
                        <span className="text-gray-400 ml-1">{house.name}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm">
              4
            </div>
            <div>
              <h3 className="font-medium text-white mb-1">查询持有者</h3>
              <p className="text-gray-400 text-sm">
                找到 <code className="px-1.5 py-0.5 bg-black/60 rounded text-amber-400 text-xs">ownerOf</code> 函数，输入 Token ID，即可查看当前持有者地址。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contract Info */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-semibold mb-4 text-amber-400">合约信息</h2>
        <div className="space-y-3">
          <div className="p-4 bg-black/60 rounded-lg border border-amber-500/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white font-medium">KinForgeAgent (ERC-721)</span>
              <span className="text-green-400 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                已验证
              </span>
            </div>
            <div className="font-mono text-sm text-gray-400 break-all mb-2">{CONTRACT_ADDRESS}</div>
            <div className="flex gap-3">
              <a
                href={`${BSCSCAN_BASE}/address/${CONTRACT_ADDRESS}#code`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 text-sm"
              >
                查看源码 ↗
              </a>
              <a
                href={`${BSCSCAN_BASE}/address/${CONTRACT_ADDRESS}#readContract`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 text-sm"
              >
                Read Contract ↗
              </a>
            </div>
          </div>

          <div className="p-4 bg-black/60 rounded-lg border border-amber-500/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white font-medium">FusionCore</span>
              <span className="text-green-400 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                已验证
              </span>
            </div>
            <div className="font-mono text-sm text-gray-400 break-all mb-2">{CONTRACTS.FusionCore[56]}</div>
            <a
              href={`${BSCSCAN_BASE}/address/${CONTRACTS.FusionCore[56]}#code`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 text-sm"
            >
              查看源码 ↗
            </a>
          </div>
        </div>
      </div>

      <div className="text-center text-gray-500 text-sm">
        所有数据直接从 BNB Chain 智能合约读取，无需连接钱包
      </div>
    </div>
  );
}