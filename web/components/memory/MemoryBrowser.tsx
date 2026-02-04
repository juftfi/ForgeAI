'use client';

import { useState, useEffect } from 'react';

type MemoryType = 'fact' | 'preference' | 'experience' | 'relationship';

interface Memory {
  id: string;
  tokenId: number;
  memoryType: MemoryType;
  content: string;
  importance: number;
  createdAt: string;
  lastAccessed?: string;
  accessCount: number;
}

interface MemoryBrowserProps {
  tokenId: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Memory type config
const MEMORY_TYPES: Record<MemoryType, { label: string; icon: string; color: string }> = {
  fact: { label: '事实', icon: '📋', color: 'blue' },
  preference: { label: '偏好', icon: '❤️', color: 'pink' },
  experience: { label: '经历', icon: '🌟', color: 'yellow' },
  relationship: { label: '关系', icon: '🤝', color: 'green' },
};

export default function MemoryBrowser({ tokenId }: MemoryBrowserProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<MemoryType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Fetch memories
  const fetchMemories = async (type?: MemoryType) => {
    setIsLoading(true);
    setError(null);

    try {
      const url = type
        ? `${API_BASE}/agent/${tokenId}/memories?type=${type}&limit=50`
        : `${API_BASE}/agent/${tokenId}/memories?limit=50`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('获取记忆失败');
      }
      const data = await res.json();
      setMemories(data.memories);
      setTotalCount(data.totalCount);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Search memories
  const searchMemories = async () => {
    if (!searchQuery.trim()) {
      fetchMemories(activeType === 'all' ? undefined : activeType);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/agent/${tokenId}/memories/search?q=${encodeURIComponent(searchQuery)}&limit=20`
      );
      if (!res.ok) {
        throw new Error('搜索失败');
      }
      const data = await res.json();
      setMemories(data.memories);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  // Fetch on mount and type change
  useEffect(() => {
    if (!searchQuery.trim()) {
      fetchMemories(activeType === 'all' ? undefined : activeType);
    }
  }, [tokenId, activeType]);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchMemories();
  };

  // Get color classes for memory type
  const getTypeColors = (type: MemoryType) => {
    const config = MEMORY_TYPES[type];
    switch (config.color) {
      case 'blue':
        return 'bg-blue-900/30 border-blue-700 text-blue-300';
      case 'pink':
        return 'bg-pink-900/30 border-pink-700 text-pink-300';
      case 'yellow':
        return 'bg-yellow-900/30 border-yellow-700 text-yellow-300';
      case 'green':
        return 'bg-green-900/30 border-green-700 text-green-300';
      default:
        return 'bg-gray-900/30 border-gray-700 text-gray-300';
    }
  };

  // Render importance bar
  const renderImportance = (importance: number) => {
    const width = `${importance * 100}%`;
    const color = importance > 0.7 ? 'bg-green-500' : importance > 0.4 ? 'bg-yellow-500' : 'bg-gray-500';
    return (
      <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width }} />
      </div>
    );
  };

  return (
    <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-300">Agent 记忆</h3>
          <p className="text-xs text-gray-500">共 {totalCount} 条记忆</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索记忆..."
          className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={isSearching}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors"
        >
          {isSearching ? '...' : '搜索'}
        </button>
      </form>

      {/* Type Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => {
            setActiveType('all');
            setSearchQuery('');
          }}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${
            activeType === 'all'
              ? 'bg-white text-gray-900'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          全部
        </button>
        {(Object.keys(MEMORY_TYPES) as MemoryType[]).map((type) => (
          <button
            key={type}
            onClick={() => {
              setActiveType(type);
              setSearchQuery('');
            }}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              activeType === type
                ? 'bg-white text-gray-900'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {MEMORY_TYPES[type].icon} {MEMORY_TYPES[type].label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-gray-400">加载中...</div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-red-400">{error}</div>
        </div>
      ) : memories.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-500">
          <span className="text-3xl mb-2">🧠</span>
          <p className="text-sm">暂无记忆</p>
          <p className="text-xs mt-1">与 Agent 对话后会积累记忆</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {memories.map((memory) => (
            <div
              key={memory.id}
              className={`rounded-lg p-3 border ${getTypeColors(memory.memoryType)}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span>{MEMORY_TYPES[memory.memoryType].icon}</span>
                  <span className="text-xs opacity-70">
                    {MEMORY_TYPES[memory.memoryType].label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {renderImportance(memory.importance)}
                  <span className="text-xs opacity-50">
                    {(memory.importance * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <p className="text-sm">{memory.content}</p>
              <div className="flex items-center justify-between mt-2 text-xs opacity-50">
                <span>
                  {new Date(memory.createdAt).toLocaleDateString('zh-CN')}
                </span>
                <span>访问 {memory.accessCount} 次</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
