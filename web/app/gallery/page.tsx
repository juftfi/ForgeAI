'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface TokenMetadata {
  name: string;
  description: string;
  image: string;
  attributes: { trait_type: string; value: string }[];
}

// 七大天气家族
const HOUSES = ['全部', 'CLEAR', 'MONSOON', 'THUNDER', 'FROST', 'AURORA', 'SAND', 'ECLIPSE'];
const HOUSE_NAMES: Record<string, string> = {
  '全部': '全部家族',
  'CLEAR': 'Clear 家族',
  'MONSOON': 'Monsoon 家族',
  'THUNDER': 'Thunder 家族',
  'FROST': 'Frost 家族',
  'AURORA': 'Aurora 家族',
  'SAND': 'Sand 家族',
  'ECLIPSE': 'Eclipse 家族',
};
const RARITIES = ['全部', 'Common', 'Uncommon', 'Rare', 'Epic', 'Mythic'];
const RARITY_NAMES: Record<string, string> = {
  '全部': '全部稀有度',
  'Common': '普通',
  'Uncommon': '稀有',
  'Rare': '精良',
  'Epic': '史诗',
  'Mythic': '神话',
};

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

export default function GalleryPage() {
  const [tokens, setTokens] = useState<{ id: number; metadata: TokenMetadata }[]>([]);
  const [loading, setLoading] = useState(true);
  const [houseFilter, setHouseFilter] = useState('全部');
  const [rarityFilter, setRarityFilter] = useState('全部');
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [totalPages, setTotalPages] = useState(88); // 2100 / 24 = 87.5 -> 88
  const pageSize = 24;

  useEffect(() => {
    async function loadTokens() {
      setLoading(true);
      const loaded: { id: number; metadata: TokenMetadata }[] = [];

      // Load tokens for current page
      const start = (page - 1) * pageSize + 1;
      const end = start + pageSize;

      for (let i = start; i < end; i++) {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/metadata/${i}`);
          if (res.ok) {
            const metadata = await res.json();
            loaded.push({ id: i, metadata });
          }
        } catch {
          // Skip missing tokens
        }
      }

      setTokens(loaded);
      setLoading(false);
    }

    loadTokens();
  }, [page]);

  // Sync page input with page state
  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const filteredTokens = tokens.filter(token => {
    const house = token.metadata.attributes.find(a => a.trait_type === 'House')?.value;
    const rarity = token.metadata.attributes.find(a => a.trait_type === 'RarityTier')?.value;

    if (houseFilter !== '全部' && house !== houseFilter) return false;
    if (rarityFilter !== '全部' && rarity !== rarityFilter) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-gold-gradient">智能体图鉴</h1>
        <div className="flex gap-4">
          <select
            value={houseFilter}
            onChange={e => setHouseFilter(e.target.value)}
            className="bg-black/60 border border-amber-500/20 rounded-lg px-4 py-2 text-white focus:border-amber-500/50 focus:outline-none"
          >
            {HOUSES.map(h => (
              <option key={h} value={h}>{HOUSE_NAMES[h]}</option>
            ))}
          </select>
          <select
            value={rarityFilter}
            onChange={e => setRarityFilter(e.target.value)}
            className="bg-black/60 border border-amber-500/20 rounded-lg px-4 py-2 text-white focus:border-amber-500/50 focus:outline-none"
          >
            {RARITIES.map(r => (
              <option key={r} value={r}>{RARITY_NAMES[r]}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">加载智能体中...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredTokens.map(token => {
              const house = token.metadata.attributes.find(a => a.trait_type === 'House')?.value || 'ALPHA';
              const rarity = token.metadata.attributes.find(a => a.trait_type === 'RarityTier')?.value || 'Common';

              return (
                <Link href={`/agent/${token.id}`} key={token.id} className="card group">
                  <div className={`h-32 kin-gradient-${house.toLowerCase()} flex items-center justify-center overflow-hidden`}>
                    {token.metadata.image ? (
                      <img
                        src={getImageUrl(token.metadata.image)}
                        alt={token.metadata.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          // On error, hide image and show fallback
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-4xl font-bold text-white/50 group-hover:text-white/70 transition-colors">#{token.id}</span>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-medium truncate text-white">
                      {token.metadata.name.replace('HouseForge', 'KinForge').replace(/House\s+/g, '')}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-amber-400/70">{HOUSE_NAMES[house] || house}</span>
                      <span className={`text-xs rarity-${rarity.toLowerCase()}`}>{RARITY_NAMES[rarity] || rarity}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {filteredTokens.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">没有找到匹配的智能体</p>
            </div>
          )}

          {/* Pagination */}
          <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
            <button
              onClick={() => { setPage(1); setPageInput('1'); }}
              disabled={page === 1}
              className="btn-secondary disabled:opacity-50"
            >
              首页
            </button>
            <button
              onClick={() => { setPage(p => Math.max(1, p - 1)); setPageInput(String(Math.max(1, page - 1))); }}
              disabled={page === 1}
              className="btn-secondary disabled:opacity-50"
            >
              上一页
            </button>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">第</span>
              <input
                type="number"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const newPage = Math.max(1, Math.min(totalPages, parseInt(pageInput) || 1));
                    setPage(newPage);
                    setPageInput(String(newPage));
                  }
                }}
                onBlur={() => {
                  const newPage = Math.max(1, Math.min(totalPages, parseInt(pageInput) || 1));
                  setPage(newPage);
                  setPageInput(String(newPage));
                }}
                className="w-16 px-2 py-1 bg-black/60 border border-amber-500/20 rounded text-white text-center"
                min="1"
                max={totalPages}
              />
              <span className="text-gray-400">/ {totalPages} 页</span>
            </div>
            <button
              onClick={() => { setPage(p => Math.min(totalPages, p + 1)); setPageInput(String(Math.min(totalPages, page + 1))); }}
              disabled={page >= totalPages || tokens.length < pageSize}
              className="btn-secondary disabled:opacity-50"
            >
              下一页
            </button>
            <button
              onClick={() => { setPage(totalPages); setPageInput(String(totalPages)); }}
              disabled={page >= totalPages}
              className="btn-secondary disabled:opacity-50"
            >
              末页
            </button>
          </div>
        </>
      )}
    </div>
  );
}
