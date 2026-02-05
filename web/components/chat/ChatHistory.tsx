'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';

// 类型定义
interface EmotionState {
  primary: string;
  intensity: number;
  confidence: number;
}

interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'agent';
  content: string;
  createdAt: string;
  emotion?: EmotionState;
}

interface ChatSession {
  id: string;
  tokenId: number;
  userAddress: string;
  startedAt: string;
  endedAt?: string;
  messageCount: number;
  summary?: string;
  messages?: ChatMessage[];
}

interface ChatHistoryProps {
  tokenId: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// 情绪配置
const emotionConfig: Record<string, { emoji: string; label: string }> = {
  happy: { emoji: '😊', label: '开心' },
  sad: { emoji: '😢', label: '难过' },
  angry: { emoji: '😠', label: '愤怒' },
  anxious: { emoji: '😰', label: '焦虑' },
  curious: { emoji: '🤔', label: '好奇' },
  grateful: { emoji: '🙏', label: '感激' },
  confused: { emoji: '😵', label: '困惑' },
  neutral: { emoji: '😐', label: '平静' },
};

export default function ChatHistory({ tokenId }: ChatHistoryProps) {
  const { address } = useAccount();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState<string | null>(null);

  // 日期过滤
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const limit = 10;

  // 获取历史数据
  const fetchHistory = useCallback(async (reset = false) => {
    if (!address) {
      setError('请先连接钱包');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const currentOffset = reset ? 0 : offset;

      const params = new URLSearchParams({
        userAddress: address,
        limit: limit.toString(),
        offset: currentOffset.toString(),
        includeMessages: 'false',
      });

      if (startDate) params.append('startDate', new Date(startDate).toISOString());
      if (endDate) params.append('endDate', new Date(endDate + 'T23:59:59').toISOString());

      const res = await fetch(`${API_BASE}/chat/history/${tokenId}?${params}`);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || '获取历史失败');
      }

      const data = await res.json();

      if (reset) {
        setSessions(data.sessions);
        setOffset(data.sessions.length);
      } else {
        setSessions(prev => [...prev, ...data.sessions]);
        setOffset(prev => prev + data.sessions.length);
      }

      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [address, tokenId, offset, startDate, endDate]);

  // 初始加载
  useEffect(() => {
    fetchHistory(true);
  }, [address, tokenId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 应用日期过滤
  const applyFilters = () => {
    setOffset(0);
    fetchHistory(true);
  };

  // 清除过滤
  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setOffset(0);
    setTimeout(() => fetchHistory(true), 0);
  };

  // 加载会话消息
  const loadSessionMessages = async (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
      return;
    }

    // 检查是否已有消息
    const session = sessions.find(s => s.id === sessionId);
    if (session?.messages) {
      setExpandedSession(sessionId);
      return;
    }

    try {
      setLoadingMessages(sessionId);

      const res = await fetch(
        `${API_BASE}/chat/session/${sessionId}?userAddress=${address}`
      );

      if (!res.ok) throw new Error('获取消息失败');

      const data = await res.json();

      // 更新会话消息
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, messages: data.messages } : s
      ));

      setExpandedSession(sessionId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingMessages(null);
    }
  };

  // 格式化时间
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 格式化时长
  const formatDuration = (start: string, end?: string) => {
    if (!end) return '进行中';
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.floor(duration / 60000);
    if (minutes < 60) return `${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    return `${hours} 小时 ${minutes % 60} 分钟`;
  };

  if (!address) {
    return (
      <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-6 text-center">
        <span className="text-4xl mb-4 block">🔒</span>
        <p className="text-gray-400">请连接钱包查看对话历史</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 rounded-lg border border-gray-700 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>📜</span>
          <span>对话历史</span>
          {total > 0 && (
            <span className="text-sm font-normal text-gray-500">({total} 条)</span>
          )}
        </h3>
      </div>

      {/* 日期过滤器 */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">开始日期</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">结束日期</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none"
          />
        </div>
        <button
          onClick={applyFilters}
          className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30 transition-colors"
        >
          筛选
        </button>
        {(startDate || endDate) && (
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 transition-colors"
          >
            清除
          </button>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* 会话列表 */}
      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden"
          >
            {/* 会话头部 */}
            <button
              onClick={() => loadSessionMessages(session.id)}
              className="w-full p-4 text-left hover:bg-gray-700/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {session.endedAt ? '💬' : '🔵'}
                  </span>
                  <div>
                    <div className="text-white font-medium">
                      {formatDate(session.startedAt)}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span>{session.messageCount} 条消息</span>
                      <span>•</span>
                      <span>{formatDuration(session.startedAt, session.endedAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {loadingMessages === session.id ? (
                    <div className="animate-spin w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full"></div>
                  ) : (
                    <span className={`text-gray-400 transition-transform ${expandedSession === session.id ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  )}
                </div>
              </div>
              {session.summary && (
                <div className="mt-2 text-sm text-gray-400 line-clamp-2">
                  {session.summary}
                </div>
              )}
            </button>

            {/* 展开的消息列表 */}
            {expandedSession === session.id && session.messages && (
              <div className="border-t border-gray-700 max-h-96 overflow-y-auto">
                <div className="p-4 space-y-3">
                  {session.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.role === 'user'
                            ? 'bg-amber-500/20 text-white'
                            : 'bg-gray-700/50 text-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">
                            {msg.role === 'user' ? '你' : '智能体'}
                          </span>
                          {msg.emotion && msg.emotion.confidence > 0.4 && (
                            <span className="text-xs" title={emotionConfig[msg.emotion.primary]?.label}>
                              {emotionConfig[msg.emotion.primary]?.emoji}
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            {new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* 加载更多 */}
        {hasMore && !isLoading && (
          <button
            onClick={() => fetchHistory(false)}
            className="w-full py-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg text-gray-400 text-sm transition-colors"
          >
            加载更多
          </button>
        )}

        {/* 加载状态 */}
        {isLoading && (
          <div className="py-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-2 text-gray-500 text-sm">加载中...</p>
          </div>
        )}

        {/* 空状态 */}
        {!isLoading && sessions.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            <span className="text-4xl mb-4 block">📭</span>
            <p>暂无对话记录</p>
            {(startDate || endDate) && (
              <p className="text-xs mt-2">尝试调整筛选条件</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
