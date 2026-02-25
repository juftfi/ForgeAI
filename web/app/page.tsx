'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { trackPageView } from '@/lib/analytics';

interface Stats {
  totalSupply: number;
  generatedMetadata: number;
  houses: { key: string; count: number }[];
  rarityDistribution: Record<string, number>;
}

// 七大天气家族 - ForgeAI Weather Theme
const HOUSES = [
  { key: 'CLEAR', name: 'Clear 家族', theme: '高压清澈', desc: '精准、洞察、透明', color: '#60A5FA' },
  { key: 'MONSOON', name: 'Monsoon 家族', theme: '霓虹雨潮', desc: '适应、流动、更新', color: '#34D399' },
  { key: 'THUNDER', name: 'Thunder 家族', theme: '风暴警戒', desc: '能量、颠覆、力量', color: '#A78BFA' },
  { key: 'FROST', name: 'Frost 家族', theme: '静默稳定', desc: '守护、耐心、沉静', color: '#93C5FD' },
  { key: 'AURORA', name: 'Aurora 家族', theme: '磁漂极光', desc: '创意、视野、奇迹', color: '#F472B6' },
  { key: 'SAND', name: 'Sand 家族', theme: '金噪适应', desc: '耐久、生存、韧性', color: '#FBBF24' },
  { key: 'ECLIPSE', name: 'Eclipse 家族', theme: '黑日权威', desc: '神秘、变革、秘密', color: '#6B7280' },
];

const FEATURES = [
  {
    icon: '🧬',
    title: 'BAP-578 原生身份',
    desc: '每个智能体都是 ERC-721 代币，拥有链上元数据、可验证的学习根和状态管理能力。',
  },
  {
    icon: '⚗️',
    title: '天气融合系统',
    desc: '将两个智能体融合，创造拥有遗传特征、天气变异和跨家族奖励的后代。',
  },
  {
    icon: '✓',
    title: '可验证成长',
    desc: '链下保险库数据由链上哈希保护。任何人都可以验证智能体的完整历史。',
  },
];

// AI 对话功能特性
const AI_FEATURES = [
  {
    icon: '💬',
    title: 'AI 个性化对话',
    desc: '每个智能体基于家族特征拥有独特性格，与你进行个性化对话。',
  },
  {
    icon: '😄',
    title: '智能体心情',
    desc: '8 种心情状态（愉悦、满足、好奇等），影响 AI 回复风格。',
  },
  {
    icon: '🤝',
    title: '关系等级',
    desc: '从初识到灵魂伴侣，7 级亲密度系统，互动累积经验解锁权益。',
  },
  {
    icon: '📊',
    title: '话题分析',
    desc: '自动分析 13 种话题类别，洞察你与智能体的对话偏好。',
  },
  {
    icon: '💾',
    title: '永久记忆',
    desc: 'Agent 的对话记忆、关系等级、心情状态持久化存储，不因服务更新而丢失。',
  },
];

const STEPS = [
  { num: '01', title: '铸造', desc: '选择你的家族，铸造一个拥有确定性特征的创世智能体。' },
  { num: '02', title: '融合', desc: '在融合实验室中将两个智能体结合，创造继承天气基因的后代。' },
  { num: '03', title: '进化', desc: '你的智能体积累经验，形成可验证的学习摘要。' },
];

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    trackPageView('/', 'Home');
    fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/stats`)
      .then(res => res.ok ? res.json() : null)
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-24">
      {/* Hero Section */}
      <section className="relative py-20 text-center">
        {/* Background glow - Gold DNA theme */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[600px] sm:h-[600px] bg-amber-500/15 rounded-full blur-[80px] sm:blur-[120px]" />
          <div className="absolute top-1/3 left-1/4 w-[200px] h-[200px] sm:w-[400px] sm:h-[400px] bg-yellow-500/10 rounded-full blur-[60px] sm:blur-[100px]" />
        </div>

        <div className="relative z-10">
          {/* DNA Hexagon Logo */}
          <div className="w-20 h-20 mx-auto mb-8">
            
          </div>

          <div className="inline-block px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-sm text-amber-300 mb-4">
            1,302 创世智能体 · BNB Chain
          </div>

          {/* Contract Address */}
          <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
            <span className="text-gray-500 text-sm">CA:</span>
            <a
              href="https://bscscan.com/address/7777"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs sm:text-sm text-amber-400 hover:text-amber-300 transition-colors break-all"
            >
              7777
            </a>
            <button
              onClick={() => {
                navigator.clipboard.writeText('7777');
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className={`transition-colors ${copied ? 'text-green-400' : 'text-gray-500 hover:text-amber-400'}`}
              title={copied ? '已复制' : '复制地址'}
            >
              {copied ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="text-gold-gradient">
              铸造血脉
            </span>
            <br />
            <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
              交易身份
            </span>
          </h1>

          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            非同质化智能体，拥有确定性特征、可验证成长和基因融合繁衍，
            跨越七大天气家族。
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/mint" className="btn-primary text-base sm:text-lg px-6 py-3 sm:px-8 sm:py-4">
              铸造创世智能体
            </Link>
            <Link href="/gallery" className="btn-secondary text-base sm:text-lg px-6 py-3 sm:px-8 sm:py-4">
              浏览图鉴
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="glass-card p-4 sm:p-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
          <div className="text-center">
            <div className="text-2xl sm:text-4xl font-bold text-white mb-1">{stats?.totalSupply || '1,302'}</div>
            <div className="text-gray-400 text-sm">总供应量</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-4xl font-bold text-amber-400 mb-1">7</div>
            <div className="text-gray-400 text-sm">天气家族</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-4xl font-bold text-yellow-400 mb-1">5</div>
            <div className="text-gray-400 text-sm">稀有度等级</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-4xl font-bold text-amber-500 mb-1">{stats?.generatedMetadata || '—'}</div>
            <div className="text-gray-400 text-sm">已渲染</div>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section>
        <div className="text-center mb-12">
          <h2 className="section-title">为什么选择非同质化智能体？</h2>
          <p className="section-subtitle mx-auto">
            不仅仅是收藏品 —— 智能体是具有可验证历史的自主数字身份。
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <div key={i} className="glass-card p-8 hover:border-amber-500/30 transition-colors">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
              <p className="text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI Features Section */}
      <section>
        <div className="text-center mb-12">
          <div className="inline-block px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-sm text-amber-300 mb-4">
            v0.6.0 新功能
          </div>
          <h2 className="section-title">AI 对话与社交系统</h2>
          <p className="section-subtitle mx-auto">
            你的智能体不仅是收藏品，更是有情感、会成长的数字伙伴。对话记忆永久保存，不因更新丢失。
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {AI_FEATURES.map((f, i) => (
            <div key={i} className="glass-card p-6 hover:border-amber-500/30 transition-colors group">
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{f.icon}</div>
              <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link href="/gallery" className="text-amber-400 hover:text-amber-300 text-sm">
            前往图鉴，与智能体对话 →
          </Link>
        </div>
      </section>

      {/* Seven Kin Houses */}
      <section>
        <div className="text-center mb-12">
          <h2 className="section-title">七大天气家族</h2>
          <p className="section-subtitle mx-auto">
            每个家族拥有独特的天气主题、视觉风格和特征偏好。
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {HOUSES.map(h => (
            <div
              key={h.key}
              className="glass-card overflow-hidden group hover:scale-105 transition-transform cursor-pointer"
            >
              <div
                className="h-24 opacity-80 group-hover:opacity-100 transition-opacity"
                style={{ background: `linear-gradient(135deg, ${h.color}, ${h.color}66)` }}
              />
              <div className="p-4">
                <h4 className="font-bold text-white text-sm">{h.name}</h4>
                <p className="text-amber-400/70 text-xs mt-1 truncate">{h.theme}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link href="/docs/houses" className="text-amber-400 hover:text-amber-300 text-sm">
            了解更多关于家族的信息 →
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section>
        <div className="text-center mb-12">
          <h2 className="section-title">运作方式</h2>
          <p className="section-subtitle mx-auto">
            从铸造到精通，三步完成。
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <div key={i} className="relative">
              <div className="glass-card p-8 h-full">
                <div className="text-5xl font-bold text-amber-500/20 mb-4">{s.num}</div>
                <h3 className="text-xl font-bold text-white mb-3">{s.title}</h3>
                <p className="text-gray-400">{s.desc}</p>
              </div>
              {i < 2 && (
                <div className="hidden md:block absolute top-1/2 -right-4 text-amber-600 text-2xl">
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* BAP-578 Section */}
      <section className="glass-card p-6 sm:p-12">
        <div className="grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
          <div>
            <div className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm font-medium mb-4">
              技术标准
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">
              基于 BAP-578 构建
            </h2>
            <p className="text-gray-400 leading-relaxed mb-6">
              BAP-578（区块链智能体协议）定义了非同质化智能体的接口，
              具备状态管理、学习能力和动作执行功能。
            </p>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start gap-3">
                <span className="text-amber-400">✓</span>
                <span>链上状态：活跃、暂停、终止</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-amber-400">✓</span>
                <span>可验证的 vaultHash 和 learningRoot</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-amber-400">✓</span>
                <span>委托动作执行</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-amber-400">✓</span>
                <span>血脉追踪与世代计数</span>
              </li>
            </ul>
            <div className="mt-8">
              <Link href="/whitepaper" className="btn-secondary">
                阅读白皮书
              </Link>
            </div>
          </div>
          <div className="bg-black/80 rounded-xl p-6 font-mono text-sm border border-amber-500/20">
            <div className="text-gray-500 mb-2">// 智能体元数据</div>
            <pre className="text-amber-400 overflow-x-auto">
{`struct AgentMetadata {
  string persona;
  string experience;
  string vaultURI;
  bytes32 vaultHash;
}

struct LearningState {
  bytes32 learningRoot;
  uint256 version;
  uint256 lastUpdate;
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center py-16">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
          准备好铸造你的血脉了吗？
        </h2>
        <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
          加入 BNB Chain 上非同质化智能体的创世一代。
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/mint" className="btn-primary text-base sm:text-lg px-6 py-3 sm:px-8 sm:py-4">
            立即铸造
          </Link>
          <Link href="/docs" className="btn-secondary text-base sm:text-lg px-6 py-3 sm:px-8 sm:py-4">
            阅读文档
          </Link>
        </div>
      </section>
    </div>
  );
}
