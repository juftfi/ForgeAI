'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { trackDocView } from '@/lib/analytics';

const DOCS = [
  {
    category: '入门指南',
    items: [
      { title: '简介', slug: 'introduction', description: 'KinForge 和非同质化智能体概述' },
      { title: '快速开始', slug: 'quickstart', description: '铸造、查看和融合智能体入门' },
      { title: '常见问题', slug: 'faq', description: '关于 KinForge 的常见问题' },
    ],
  },
  {
    category: '铸造',
    items: [
      { title: '创世机制', slug: 'how-genesis-works', description: '预生成资产、S3 策略和验证' },
      { title: '预览与铸造流程', slug: 'preview-vs-mint', description: '无钱包预览和预订后铸造流程' },
      { title: '七大家族', slug: 'houses', description: '天气主题家族及其特征' },
    ],
  },
  {
    category: '技术',
    items: [
      { title: 'BAP-578 标准', slug: 'bap578', description: '理解非同质化智能体协议' },
      { title: '智能合约', slug: 'contracts', description: '合约架构和功能' },
      { title: '保险库验证', slug: 'verification', description: '如何验证 vaultHash 和 learningRoot' },
    ],
  },
  {
    category: '功能',
    items: [
      { title: '融合机制', slug: 'fusion', description: '提交-揭示繁衍系统详解' },
      { title: '特征系统', slug: 'traits', description: '特征如何生成和遗传' },
      { title: '渲染管线', slug: 'rendering', description: 'Blender Cycles 渲染系统' },
    ],
  },
  {
    category: '开发',
    items: [
      { title: 'API 参考', slug: 'api', description: '服务器 API 端点和用法' },
      { title: '集成指南', slug: 'integration', description: '基于 KinForge 进行构建' },
    ],
  },
];

export default function DocsPage() {
  useEffect(() => {
    trackDocView('docs-index');
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gold-gradient">
          文档中心
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          了解、构建和扩展 KinForge 所需的一切
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid md:grid-cols-3 gap-4 mb-12">
        <Link href="/whitepaper" className="glass-card p-6 hover:border-amber-500/50 transition-colors group">
          <div className="text-3xl mb-3">📜</div>
          <h3 className="font-semibold text-white group-hover:text-amber-400 transition-colors">白皮书</h3>
          <p className="text-gray-400 text-sm mt-1">完整技术规范</p>
        </Link>
        <Link href="/docs/bap578" className="glass-card p-6 hover:border-amber-500/50 transition-colors group">
          <div className="text-3xl mb-3">🧬</div>
          <h3 className="font-semibold text-white group-hover:text-amber-400 transition-colors">BAP-578</h3>
          <p className="text-gray-400 text-sm mt-1">协议标准概述</p>
        </Link>
        <Link href="/docs/api" className="glass-card p-6 hover:border-amber-500/50 transition-colors group">
          <div className="text-3xl mb-3">⚡</div>
          <h3 className="font-semibold text-white group-hover:text-amber-400 transition-colors">API 参考</h3>
          <p className="text-gray-400 text-sm mt-1">服务器端点和用法</p>
        </Link>
      </div>

      {/* Doc Categories */}
      <div className="space-y-8">
        {DOCS.map(category => (
          <section key={category.category}>
            <h2 className="text-xl font-bold mb-4 text-amber-400">{category.category}</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {category.items.map(doc => (
                <Link
                  key={doc.slug}
                  href={`/docs/${doc.slug}`}
                  className="block p-4 bg-black/60 rounded-xl border border-amber-500/10 hover:border-amber-500/30 transition-all hover:bg-black/80"
                >
                  <h3 className="font-semibold text-white mb-1">{doc.title}</h3>
                  <p className="text-gray-400 text-sm">{doc.description}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* External Resources */}
      <section className="mt-12 glass-card p-8">
        <h2 className="text-xl font-bold mb-4 text-amber-400">外部资源</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <a
            href="https://github.com/KinForgeLab/kinforge"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 bg-black/60 rounded-lg hover:bg-black/80 transition-colors border border-amber-500/10"
          >
            <div className="text-2xl">🔧</div>
            <div>
              <h3 className="font-semibold">GitHub 仓库</h3>
              <p className="text-gray-400 text-sm">开源合约和工具</p>
            </div>
          </a>
          <a
            href="https://bscscan.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 bg-black/60 rounded-lg hover:bg-black/80 transition-colors border border-amber-500/10"
          >
            <div className="text-2xl">🔍</div>
            <div>
              <h3 className="font-semibold">BSCScan</h3>
              <p className="text-gray-400 text-sm">在链上查看合约</p>
            </div>
          </a>
        </div>
      </section>

      {/* Help */}
      <section className="mt-8 text-center">
        <p className="text-gray-400">
          找不到您需要的内容？{' '}
          <a href="mailto:support@kinforge.io" className="text-amber-400 hover:text-amber-300">
            联系支持
          </a>
        </p>
      </section>
    </div>
  );
}
