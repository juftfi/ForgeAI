'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount } from 'wagmi';

// 情绪类型
type EmotionType = 'happy' | 'sad' | 'angry' | 'anxious' | 'curious' | 'grateful' | 'confused' | 'neutral';

interface EmotionState {
  primary: EmotionType;
  intensity: number;
  confidence: number;
}

interface ChatMessage {
  id: string;
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
}

interface AgentChatProps {
  tokenId: number;
  agentName?: string;
  houseName?: string;
  onClose?: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AgentChat({ tokenId, agentName, houseName, onClose }: AgentChatProps) {
  const { address, isConnected } = useAccount();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentEmotion, setCurrentEmotion] = useState<EmotionState | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 情绪显示配置
  const emotionConfig: Record<EmotionType, { emoji: string; label: string; color: string }> = {
    happy: { emoji: '😊', label: '开心', color: 'text-yellow-400' },
    sad: { emoji: '😢', label: '难过', color: 'text-blue-400' },
    angry: { emoji: '😠', label: '愤怒', color: 'text-red-400' },
    anxious: { emoji: '😰', label: '焦虑', color: 'text-orange-400' },
    curious: { emoji: '🤔', label: '好奇', color: 'text-purple-400' },
    grateful: { emoji: '🙏', label: '感激', color: 'text-pink-400' },
    confused: { emoji: '😵', label: '困惑', color: 'text-gray-400' },
    neutral: { emoji: '😐', label: '平静', color: 'text-gray-300' },
  };

  // Scroll within messages container only (not the page)
  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Start a new session
  const startSession = async () => {
    if (!isConnected || !address) {
      setError('请先连接钱包');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/chat/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId, userAddress: address }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '创建会话失败');
      }

      const newSession = await res.json();
      setSession(newSession);
      setMessages([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Send a message
  const sendMessage = async () => {
    if (!session || !input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, content: userMessage.content, userAddress: address }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '发送消息失败');
      }

      const { message: agentMessage, detectedEmotion } = await res.json();
      setMessages(prev => [...prev, agentMessage]);

      // 更新检测到的情绪状态
      if (detectedEmotion) {
        setCurrentEmotion(detectedEmotion);
      }
    } catch (err: any) {
      setError(err.message);
      // Remove the optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  // End session
  const endSession = async () => {
    if (!session) return;

    setIsLoading(true);
    try {
      await fetch(`${API_BASE}/chat/session/${session.id}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: address }),
      });
      setSession(null);
      setMessages([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // House color mapping
  const houseColors: Record<string, string> = {
    SOLARA: 'from-yellow-500 to-orange-500',
    TEMPEST: 'from-purple-500 to-indigo-600',
    MISTRAL: 'from-gray-400 to-blue-400',
    GLACIUS: 'from-blue-300 to-cyan-400',
    NIMBUS: 'from-pink-400 to-purple-400',
    TERRUS: 'from-amber-600 to-yellow-700',
    AQUORA: 'from-teal-400 to-blue-500',
    CLEAR: 'from-blue-400 to-cyan-500',
    MONSOON: 'from-green-500 to-teal-500',
    THUNDER: 'from-purple-500 to-violet-600',
    FROST: 'from-blue-300 to-indigo-400',
    AURORA: 'from-pink-400 to-rose-500',
    SAND: 'from-yellow-500 to-amber-600',
    ECLIPSE: 'from-gray-600 to-slate-700',
  };

  const gradientClass = houseColors[houseName || ''] || 'from-blue-500 to-purple-600';

  // Pre-session: floating dialog with start button
  if (!session) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative flex flex-col items-center justify-center w-full max-w-md bg-gray-900 rounded-xl border border-gray-700 shadow-2xl p-6 sm:p-8">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              ✕
            </button>
          )}
          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center mb-4`}>
            <span className="text-2xl">🤖</span>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            与 {agentName || `Agent #${tokenId}`} 对话
          </h3>
          <p className="text-gray-400 text-sm mb-4 text-center px-4">
            只有持有者才能与智能体对话。它会记住你们的对话并随时间成长。
          </p>
          {error && (
            <p className="text-red-400 text-sm mb-4">{error}</p>
          )}
          <button
            onClick={startSession}
            disabled={isLoading || !isConnected}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              isConnected
                ? `bg-gradient-to-r ${gradientClass} text-white hover:opacity-90`
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isLoading ? '连接中...' : isConnected ? '开始对话' : '请先连接钱包'}
          </button>
        </div>
      </div>
    );
  }

  // Active session: floating chat dialog
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex flex-col w-full max-w-lg h-[85vh] sm:h-[70vh] max-h-[640px] bg-gray-900 rounded-xl sm:rounded-xl border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className={`px-4 py-3 bg-gradient-to-r ${gradientClass} rounded-t-xl flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <span className="font-medium text-white">
              {agentName || `Agent #${tokenId}`}
            </span>
            {houseName && (
              <span className="text-xs bg-black/20 px-2 py-0.5 rounded text-white/80">
                {houseName}
              </span>
            )}
            {/* 情绪状态显示 */}
            {currentEmotion && currentEmotion.primary !== 'neutral' && currentEmotion.confidence > 0.4 && (
              <span
                className="text-xs bg-black/30 px-2 py-0.5 rounded flex items-center gap-1"
                title={`检测到情绪: ${emotionConfig[currentEmotion.primary].label} (强度: ${Math.round(currentEmotion.intensity * 100)}%)`}
              >
                <span>{emotionConfig[currentEmotion.primary].emoji}</span>
                <span className="text-white/80">{emotionConfig[currentEmotion.primary].label}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={endSession}
              className="text-white/80 hover:text-white text-sm"
              title="结束对话"
            >
              结束
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="关闭窗口"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              发送消息开始对话...
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-100'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className="text-xs opacity-50 mt-1">
                  {new Date(msg.createdAt).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-700 px-4 py-2 rounded-lg">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="px-4 py-2 bg-red-900/50 border-t border-red-800 shrink-0">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-gray-700 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="输入消息..."
              disabled={isLoading}
              maxLength={2000}
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                input.trim() && !isLoading
                  ? `bg-gradient-to-r ${gradientClass} text-white hover:opacity-90`
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}