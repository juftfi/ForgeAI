'use client';

import { trackMediaDownload } from '@/lib/analytics';

const BRAND_COLORS = [
  { name: '黑色 950', hex: '#000000', usage: '主要背景' },
  { name: '黑色 800', hex: '#121212', usage: '卡片背景' },
  { name: '金色 400', hex: '#fbbf24', usage: '主要强调色' },
  { name: '金色 500', hex: '#f59e0b', usage: '按钮、链接' },
  { name: '金色 600', hex: '#d97706', usage: '渐变、高亮' },
];

const HOUSE_COLORS = [
  { name: 'Clear', hex: '#60A5FA' },
  { name: 'Monsoon', hex: '#34D399' },
  { name: 'Thunder', hex: '#A78BFA' },
  { name: 'Frost', hex: '#93C5FD' },
  { name: 'Aurora', hex: '#F472B6' },
  { name: 'Sand', hex: '#FBBF24' },
  { name: 'Eclipse', hex: '#6B7280' },
];

export default function MediaKitPage() {
  const handleDownload = (asset: string) => {
    trackMediaDownload(asset);
    // In production, this would trigger actual downloads
    alert(`下载 ${asset} - 在生产环境中，这将下载资源文件。`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gold-gradient">
          媒体资源包
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          官方品牌资产、标志和媒体合作伙伴使用指南
        </p>
      </div>

      {/* Press Boilerplate */}
      <section className="glass-card p-8">
        <h2 className="text-2xl font-bold mb-4 text-amber-400">新闻稿模板</h2>
        <div className="prose prose-invert max-w-none">
          <p className="text-gray-300 leading-relaxed">
            <strong className="text-white">KinForge</strong> 是一个建立在 BNB Chain 上的开创性非同质化智能体（NFA）平台。
            该项目引入了 1,302 个创世智能体，分布在七大家族中，每个智能体都具有确定性特征、可验证的成长能力和融合繁殖机制。
          </p>
          <p className="text-gray-300 leading-relaxed mt-4">
            实现 BAP-578 标准，KinForge 智能体在链上维护元数据摘要，同时在链下保险库中存储扩展学习数据。
            所有数据都可通过存储在区块链上的加密哈希进行不可篡改的验证。
          </p>
          <p className="text-gray-300 leading-relaxed mt-4">
            每个智能体的视觉呈现都使用专业级的 Blender Cycles 渲染，创造出博物馆级别的 3D 收藏品，
            而非典型的 NFT 艺术风格。
          </p>
        </div>
        <button
          onClick={() => handleDownload('press-boilerplate.txt')}
          className="btn-secondary mt-6"
        >
          复制新闻稿文本
        </button>
      </section>

      {/* Key Facts */}
      <section className="glass-card p-8">
        <h2 className="text-2xl font-bold mb-6 text-amber-400">关键信息</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { label: '发布链', value: 'BNB 智能链' },
            { label: '创世供应', value: '1,302 智能体' },
            { label: '家族', value: '7 大 Kin 家族' },
            { label: '标准', value: 'BAP-578 (非同质化智能体)' },
            { label: '渲染引擎', value: 'Blender Cycles (GPU/OptiX)' },
            { label: '繁殖系统', value: '提交-揭示融合' },
          ].map(fact => (
            <div key={fact.label} className="flex justify-between p-4 bg-black/60 rounded-lg border border-amber-500/10">
              <span className="text-gray-400">{fact.label}</span>
              <span className="font-medium text-white">{fact.value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Logo Downloads */}
      <section className="glass-card p-8">
        <h2 className="text-2xl font-bold mb-6 text-amber-400">标志</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {/* Primary Logo */}
          <div className="bg-black/60 rounded-xl p-6 text-center border border-amber-500/10">
            <div className="h-24 flex items-center justify-center mb-4">
              <div className="text-3xl font-bold text-gold-gradient">
                KinForge
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4">主标志</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => handleDownload('logo-primary.svg')}
                className="px-3 py-1 bg-amber-500/10 rounded text-sm hover:bg-amber-500/20 transition-colors text-amber-400"
              >
                SVG
              </button>
              <button
                onClick={() => handleDownload('logo-primary.png')}
                className="px-3 py-1 bg-amber-500/10 rounded text-sm hover:bg-amber-500/20 transition-colors text-amber-400"
              >
                PNG
              </button>
            </div>
          </div>

          {/* Icon */}
          <div className="bg-black/60 rounded-xl p-6 text-center border border-amber-500/10">
            <div className="h-24 flex items-center justify-center mb-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
                <span className="text-2xl font-bold text-black">KF</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4">图标 / 头像</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => handleDownload('icon.svg')}
                className="px-3 py-1 bg-amber-500/10 rounded text-sm hover:bg-amber-500/20 transition-colors text-amber-400"
              >
                SVG
              </button>
              <button
                onClick={() => handleDownload('icon.png')}
                className="px-3 py-1 bg-amber-500/10 rounded text-sm hover:bg-amber-500/20 transition-colors text-amber-400"
              >
                PNG
              </button>
            </div>
          </div>

          {/* White Version */}
          <div className="bg-amber-500/20 rounded-xl p-6 text-center border border-amber-500/30">
            <div className="h-24 flex items-center justify-center mb-4">
              <div className="text-3xl font-bold text-white">
                KinForge
              </div>
            </div>
            <p className="text-gray-300 text-sm mb-4">白色版本</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => handleDownload('logo-white.svg')}
                className="px-3 py-1 bg-white/10 rounded text-sm hover:bg-white/20 transition-colors text-white"
              >
                SVG
              </button>
              <button
                onClick={() => handleDownload('logo-white.png')}
                className="px-3 py-1 bg-white/10 rounded text-sm hover:bg-white/20 transition-colors text-white"
              >
                PNG
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-black/60 rounded-lg border border-amber-500/10">
          <h4 className="font-medium mb-2 text-white">标志使用指南</h4>
          <ul className="text-gray-400 text-sm space-y-1">
            <li>• 在标志周围保持最小净空间，等于 "K" 的高度</li>
            <li>• 不要旋转、扭曲或对标志应用特效</li>
            <li>• 深色背景使用白色版本，浅色背景使用主标志</li>
            <li>• 最小尺寸：数字媒体 120px 宽度，印刷品 1 英寸</li>
          </ul>
        </div>
      </section>

      {/* Brand Colors */}
      <section className="glass-card p-8">
        <h2 className="text-2xl font-bold mb-6 text-amber-400">品牌颜色</h2>

        <h3 className="font-semibold mb-4 text-white">主色调</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {BRAND_COLORS.map(color => (
            <div key={color.name} className="text-center">
              <div
                className="h-20 rounded-lg mb-2 border border-amber-500/20"
                style={{ backgroundColor: color.hex }}
              />
              <p className="font-medium text-sm text-white">{color.name}</p>
              <p className="text-gray-400 text-xs font-mono">{color.hex}</p>
              <p className="text-gray-500 text-xs mt-1">{color.usage}</p>
            </div>
          ))}
        </div>

        <h3 className="font-semibold mb-4 text-white">家族颜色</h3>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
          {HOUSE_COLORS.map(color => (
            <div key={color.name} className="text-center">
              <div
                className="h-12 rounded-lg mb-2"
                style={{ backgroundColor: color.hex }}
              />
              <p className="text-xs font-medium text-white">{color.name}</p>
              <p className="text-gray-500 text-xs font-mono">{color.hex}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sample Renders */}
      <section className="glass-card p-8">
        <h2 className="text-2xl font-bold mb-6 text-amber-400">示例渲染</h2>
        <p className="text-gray-400 mb-6">
          用于媒体和宣传的高分辨率渲染图。所有渲染均使用 Blender Cycles 配合专业级灯光和材质生成。
        </p>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {[1, 100, 500, 1000, 1500, 2000].map(tokenId => (
            <div key={tokenId} className="bg-black/60 rounded-xl overflow-hidden border border-amber-500/10">
              <div className="aspect-square bg-black/40 flex items-center justify-center">
                <span className="text-4xl text-amber-500/30">#{tokenId}</span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-sm text-white">智能体 #{tokenId}</span>
                <button
                  onClick={() => handleDownload(`render-${tokenId}.webp`)}
                  className="px-2 py-1 bg-amber-500/10 rounded text-xs hover:bg-amber-500/20 transition-colors text-amber-400"
                >
                  下载
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => handleDownload('renders-pack.zip')}
          className="btn-primary"
        >
          下载所有渲染图 (ZIP)
        </button>
      </section>

      {/* Typography */}
      <section className="glass-card p-8">
        <h2 className="text-2xl font-bold mb-6 text-amber-400">字体排版</h2>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-3 text-white">主要字体: Inter</h3>
            <p className="text-gray-400 text-sm mb-4">
              用于所有正文、UI 元素和大多数标题。可从 Google Fonts 获取。
            </p>
            <div className="bg-black/60 rounded-lg p-4 space-y-2 border border-amber-500/10">
              <p className="text-4xl font-bold text-white">敏捷的棕色狐狸</p>
              <p className="text-2xl font-semibold text-white">敏捷的棕色狐狸跳过懒惰的狗</p>
              <p className="text-lg text-white">敏捷的棕色狐狸跳过懒惰的狗</p>
              <p className="text-sm text-gray-400">敏捷的棕色狐狸跳过懒惰的狗</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-white">代码字体: System Mono</h3>
            <p className="text-gray-400 text-sm mb-4">
              用于代码块、地址和技术数据。
            </p>
            <div className="bg-black/60 rounded-lg p-4 font-mono text-sm border border-amber-500/10 text-amber-400">
              0x1234...5678 | vaultHash: 0xabcd...ef01
            </div>
          </div>
        </div>
      </section>

      {/* Download All */}
      <section className="text-center py-8">
        <button
          onClick={() => handleDownload('kinforge-media-kit.zip')}
          className="btn-primary text-lg px-8 py-4"
        >
          下载完整媒体资源包
        </button>
        <p className="text-gray-500 text-sm mt-4">
          包含标志、颜色、字体规范和示例渲染
        </p>
      </section>

      {/* Contact */}
      <section className="glass-card p-8 text-center">
        <h2 className="text-xl font-bold mb-4 text-amber-400">媒体联系</h2>
        <p className="text-gray-400">
          如需媒体咨询、合作机会或其他资源：
        </p>
        <p className="text-amber-400 mt-2">press@kinforge.io</p>
      </section>
    </div>
  );
}
