'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount } from 'wagmi';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  createdAt: string;
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
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AgentChat({ tokenId, agentName, houseName }: AgentChatProps) {
  const { address, isConnected } = useAccount();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        body: JSON.stringify({ sessionId: session.id, content: userMessage.content }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '发送消息失败');
      }

      const { message: agentMessage } = await res.json();
      setMessages(prev => [...prev, agentMessage]);
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

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-80 bg-gray-900/50 rounded-lg border border-gray-700">
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
    );
  }

  return (
    <div className="flex flex-col h-96 bg-gray-900/50 rounded-lg border border-gray-700">
      {/* Header */}
      <div className={`px-4 py-3 bg-gradient-to-r ${gradientClass} rounded-t-lg flex items-center justify-between`}>
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
        </div>
        <button
          onClick={endSession}
          className="text-white/80 hover:text-white text-sm"
          title="结束对话"
        >
          结束
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
        <div ref={messagesEndRef} />
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-900/50 border-t border-red-800">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
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
  );
}
