'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useChainId } from 'wagmi';
import { CONTRACTS, HOUSES } from '@/config/contracts';

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

interface TreeNode {
  tokenId: number;
  house: string;
  houseId: number;
  generation: number;
  parentA?: TreeNode;
  parentB?: TreeNode;
  sealed: boolean;
  burned: boolean;
}

interface LineageData {
  parent1: number;
  parent2: number;
  generation: number;
  houseId: number;
  sealed: boolean;
  isBurned?: boolean;
}

function TreePageContent() {
  const searchParams = useSearchParams();
  const chainId = useChainId();
  const initialTokenId = searchParams.get('root') || '';

  const [tokenId, setTokenId] = useState(initialTokenId);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  // Load from URL params on mount
  useEffect(() => {
    if (initialTokenId) {
      handleSearch(initialTokenId);
    }
  }, []);

  const fetchLineage = async (id: number): Promise<LineageData | null> => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/lineage/${id}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  const loadLineageRecursive = useCallback(async (
    id: number,
    depth: number = 0,
    maxDepth: number = 4
  ): Promise<TreeNode | null> => {
    if (depth > maxDepth) return null;

    try {
      const lineage = await fetchLineage(id);
      if (!lineage) return null;

      const node: TreeNode = {
        tokenId: id,
        houseId: lineage.houseId,
        house: HOUSE_NAMES[lineage.houseId] || '未知',
        generation: Number(lineage.generation),
        sealed: lineage.sealed,
        burned: lineage.isBurned || false,
      };

      // Load parents recursively
      if (lineage.parent1 > 0) {
        node.parentA = await loadLineageRecursive(lineage.parent1, depth + 1, maxDepth) || undefined;
      }
      if (lineage.parent2 > 0) {
        node.parentB = await loadLineageRecursive(lineage.parent2, depth + 1, maxDepth) || undefined;
      }

      return node;
    } catch {
      return null;
    }
  }, []);

  const handleSearch = async (searchId?: string) => {
    const idToSearch = searchId || tokenId;
    if (!idToSearch) {
      setError('请输入代币 ID');
      return;
    }

    setLoading(true);
    setError('');
    setTree(null);

    try {
      const node = await loadLineageRecursive(parseInt(idToSearch));
      if (node) {
        setTree(node);
        setExpandedNodes(new Set([node.tokenId]));
      } else {
        setError('未找到代币或没有血脉数据');
      }
    } catch {
      setError('加载血脉失败');
    }

    setLoading(false);
  };

  const toggleNode = (id: number) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getNodeColor = (houseId: number): string => {
    return HOUSES[houseId as keyof typeof HOUSES]?.color || '#fbbf24';
  };

  const renderTreeNode = (node: TreeNode, isRoot: boolean = false, level: number = 0) => {
    const hasParents = node.parentA || node.parentB;
    const isExpanded = expandedNodes.has(node.tokenId);

    return (
      <div className="flex flex-col items-center" key={node.tokenId}>
        {/* Parents row - only show if expanded */}
        {hasParents && isExpanded && (
          <>
            <div className="flex gap-12 mb-2">
              {node.parentA && renderTreeNode(node.parentA, false, level + 1)}
              {node.parentB && renderTreeNode(node.parentB, false, level + 1)}
            </div>
            {/* Connector lines */}
            <div className="relative w-full flex justify-center mb-2">
              <div className="absolute top-0 left-1/4 right-1/4 h-4 border-t-2 border-l-2 border-r-2 border-amber-500/30 rounded-t-lg" />
              <div className="h-4 w-0.5 bg-amber-500/30" />
            </div>
          </>
        )}

        {/* Current node */}
        <div
          className={`relative glass-card p-4 min-w-[140px] transition-all hover:border-amber-500/50 ${
            isRoot ? 'ring-2 ring-amber-500 shadow-lg shadow-amber-500/20' : ''
          } ${node.sealed || node.burned ? 'opacity-60' : ''}`}
        >
          {/* House color indicator */}
          <div
            className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
            style={{ backgroundColor: node.burned ? '#6b7280' : getNodeColor(node.houseId) }}
          />

          {/* Expand/Collapse button */}
          {hasParents && (
            <button
              onClick={() => toggleNode(node.tokenId)}
              className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-amber-500/20 hover:bg-amber-500/40 rounded-full text-xs flex items-center justify-center transition-colors text-amber-400"
            >
              {isExpanded ? '−' : '+'}
            </button>
          )}

          {node.burned ? (
            <div className="block text-center">
              <div
                className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-2 bg-gray-700"
              >
                <span className="text-lg font-bold text-gray-400">#{node.tokenId}</span>
              </div>
              <div className="font-medium text-gray-400">{node.house}</div>
              <div className="text-xs text-gray-500">
                第 {node.generation} 代
              </div>
              <div className="text-xs text-red-400 mt-1">已销毁</div>
            </div>
          ) : (
            <Link href={`/agent/${node.tokenId}`} className="block text-center">
              <div
                className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-2"
                style={{
                  background: `linear-gradient(135deg, ${getNodeColor(node.houseId)}, ${getNodeColor(node.houseId)}44)`,
                }}
              >
                <span className="text-lg font-bold text-white">#{node.tokenId}</span>
              </div>
              <div className="font-medium text-white">{node.house}</div>
              <div className="text-xs text-gray-400">
                第 {node.generation} 代
              </div>
              {node.sealed && (
                <div className="text-xs text-yellow-500 mt-1">已封印</div>
              )}
            </Link>
          )}
        </div>
      </div>
    );
  };

  // Calculate tree statistics
  const getTreeStats = (node: TreeNode | null): { totalNodes: number; maxGen: number; houses: Set<string> } => {
    if (!node) return { totalNodes: 0, maxGen: 0, houses: new Set() };

    const stats = { totalNodes: 1, maxGen: node.generation, houses: new Set([node.house]) };

    if (node.parentA) {
      const parentStats = getTreeStats(node.parentA);
      stats.totalNodes += parentStats.totalNodes;
      stats.maxGen = Math.max(stats.maxGen, parentStats.maxGen);
      parentStats.houses.forEach(h => stats.houses.add(h));
    }

    if (node.parentB) {
      const parentStats = getTreeStats(node.parentB);
      stats.totalNodes += parentStats.totalNodes;
      stats.maxGen = Math.max(stats.maxGen, parentStats.maxGen);
      parentStats.houses.forEach(h => stats.houses.add(h));
    }

    return stats;
  };

  const treeStats = getTreeStats(tree);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gold-gradient">
          血脉树
        </h1>
        <p className="text-gray-400 mt-2">
          探索任何智能体的祖先，发现其血统和血脉。
        </p>
      </div>

      {/* Search */}
      <div className="max-w-md mx-auto">
        <div className="flex gap-2">
          <input
            type="number"
            value={tokenId}
            onChange={e => setTokenId(e.target.value)}
            placeholder="输入代币 ID"
            className="flex-1 bg-black/60 border border-amber-500/20 rounded-lg px-4 py-3 focus:border-amber-500/50 focus:outline-none text-white"
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={() => handleSearch()}
            disabled={loading}
            className="px-6 py-3 btn-primary disabled:opacity-50"
          >
            {loading ? '加载中...' : '查看血脉'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-md mx-auto bg-red-900/30 border border-red-600 rounded-lg p-4 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Tree Stats */}
      {tree && (
        <div className="max-w-2xl mx-auto grid grid-cols-3 gap-4">
          <div className="glass-card p-4 text-center">
            <div className="text-2xl font-bold text-amber-400">{treeStats.totalNodes}</div>
            <div className="text-sm text-gray-400">祖先总数</div>
          </div>
          <div className="glass-card p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {tree.generation === 0 ? '创世' : `第 ${tree.generation} 代`}
            </div>
            <div className="text-sm text-gray-400">世代</div>
          </div>
          <div className="glass-card p-4 text-center">
            <div className="text-2xl font-bold text-amber-500">{treeStats.houses.size}</div>
            <div className="text-sm text-gray-400">家族数</div>
          </div>
        </div>
      )}

      {/* Tree Visualization */}
      {tree && (
        <div className="glass-card p-8 overflow-x-auto">
          <div className="min-w-max flex justify-center py-8">
            {renderTreeNode(tree, true)}
          </div>

          {/* Instructions */}
          <div className="text-center text-sm text-gray-500 mt-4">
            点击 + 按钮展开祖先 | 点击节点查看详情
          </div>
        </div>
      )}

      {/* Empty State */}
      {!tree && !loading && !error && (
        <div className="text-center py-16">
          <div className="text-8xl mb-6 opacity-30">🧬</div>
          <p className="text-gray-500 text-lg">
            输入代币 ID 以探索其血脉树
          </p>
          <p className="text-gray-600 text-sm mt-2">
            创世智能体（第 0 代）没有祖先。后代显示其亲本血脉。
          </p>
        </div>
      )}

      {/* House Legend */}
      <div className="max-w-2xl mx-auto glass-card p-6">
        <h3 className="font-bold mb-4 text-center text-amber-400">家族颜色</h3>
        <div className="flex flex-wrap justify-center gap-4">
          {Object.entries(HOUSE_NAMES).map(([id, name]) => (
            <div key={id} className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-full"
                style={{ backgroundColor: HOUSES[parseInt(id) as keyof typeof HOUSES]?.color || '#fbbf24' }}
              />
              <span className="text-sm text-gray-300">{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      {tree && (
        <div className="max-w-md mx-auto text-center space-y-2">
          <Link
            href={`/agent/${tree.tokenId}`}
            className="inline-block px-6 py-2 btn-secondary mr-2"
          >
            查看智能体详情
          </Link>
          <Link
            href={`/fusion?parentA=${tree.tokenId}`}
            className="inline-block px-6 py-2 btn-primary"
          >
            用于融合
          </Link>
        </div>
      )}
    </div>
  );
}

export default function TreePage() {
  return (
    <Suspense fallback={
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
        <p className="mt-4 text-gray-400">加载中...</p>
      </div>
    }>
      <TreePageContent />
    </Suspense>
  );
}
