import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Web3Provider } from '@/components/providers/Web3Provider';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import MobileNav from '@/components/nav/MobileNav';

export const metadata: Metadata = {
  title: 'KinForge - 链上基因智能体 | BNB Chain',
  description: '铸造血脉，交易身份。1,302 个创世智能体，跨越 7 大基因家族，在 BNB Chain 上实现可验证的成长与进化。',
  keywords: ['NFT', 'NFA', 'BNB Chain', 'BSC', 'AI智能体', '区块链', 'BAP-578', '基因', 'DNA'],
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-icon.svg', type: 'image/svg+xml' },
    ],
  },
  openGraph: {
    title: 'KinForge - 链上基因智能体',
    description: '铸造血脉，交易身份。1,302 个创世智能体，可验证的成长与进化。',
    type: 'website',
    locale: 'zh_CN',
    siteName: 'KinForge',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KinForge - 链上基因智能体',
    description: '铸造血脉，交易身份。1,302 个创世智能体，可验证的成长与进化。',
  },
};

const NAV_LINKS = [
  { href: '/mint', label: '铸造' },
  { href: '/my-agents', label: '我的' },
  { href: '/gallery', label: '图鉴' },
  { href: '/fusion', label: '融合' },
  { href: '/tree', label: '血脉' },
  { href: '/query', label: '查询' },
  { href: '/whitepaper', label: '白皮书' },
  { href: '/docs', label: '文档' },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen">
        <Web3Provider>
          {/* Navigation */}
          <nav className="fixed top-0 left-0 right-0 z-50 border-b border-amber-500/20 bg-black/90 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 group">
                  {/* DNA Hexagon Icon */}
                  <div className="relative w-10 h-10">
                    <svg viewBox="0 0 40 40" className="w-full h-full">
                      {/* Hexagon frame */}
                      <polygon
                        points="20,2 37,11 37,29 20,38 3,29 3,11"
                        fill="none"
                        stroke="#6b7280"
                        strokeWidth="2"
                        className="group-hover:stroke-amber-400 transition-colors"
                      />
                      {/* DNA helix */}
                      <path
                        d="M15,10 Q20,15 25,10 M15,15 Q20,20 25,15 M15,20 Q20,25 25,20 M15,25 Q20,30 25,25 M15,30 Q20,25 25,30"
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <span className="text-2xl font-bold text-gold-gradient">
                    KinForge
                  </span>
                </Link>

                {/* Desktop Nav */}
                <div className="hidden md:flex items-center gap-1">
                  {NAV_LINKS.map(link => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="px-4 py-2 text-gray-300 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all text-sm font-medium"
                    >
                      {link.label}
                    </Link>
                  ))}
                  <div className="ml-4">
                    <ConnectButton />
                  </div>
                </div>

                {/* Mobile Menu */}
                <MobileNav />
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="pt-20 min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
              {children}
            </div>
          </main>

          {/* Footer */}
          <footer className="border-t border-amber-500/20 bg-black/50 mt-20">
            <div className="max-w-7xl mx-auto px-6 py-12">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 sm:gap-8">
                {/* Brand */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8">
                      <svg viewBox="0 0 40 40" className="w-full h-full">
                        <polygon points="20,2 37,11 37,29 20,38 3,29 3,11" fill="none" stroke="#6b7280" strokeWidth="2" />
                        <path d="M15,10 Q20,15 25,10 M15,15 Q20,20 25,15 M15,20 Q20,25 25,20 M15,25 Q20,30 25,25" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                    <span className="text-xl font-bold text-gold-gradient">KinForge</span>
                  </div>
                  <p className="text-gray-400 text-sm">
                    链上基因智能体，可验证的成长与进化。
                  </p>
                </div>

                {/* 探索 */}
                <div>
                  <h4 className="font-semibold mb-4 text-amber-400">探索</h4>
                  <div className="space-y-2">
                    <Link href="/gallery" className="block text-gray-400 hover:text-amber-400 text-sm transition-colors">图鉴</Link>
                    <Link href="/mint" className="block text-gray-400 hover:text-amber-400 text-sm transition-colors">铸造</Link>
                    <Link href="/fusion" className="block text-gray-400 hover:text-amber-400 text-sm transition-colors">融合实验室</Link>
                    <Link href="/tree" className="block text-gray-400 hover:text-amber-400 text-sm transition-colors">血脉树</Link>
                    <Link href="/query" className="block text-gray-400 hover:text-amber-400 text-sm transition-colors">链上查询</Link>
                  </div>
                </div>

                {/* 资源 */}
                <div>
                  <h4 className="font-semibold mb-4 text-amber-400">资源</h4>
                  <div className="space-y-2">
                    <Link href="/whitepaper" className="block text-gray-400 hover:text-amber-400 text-sm transition-colors">白皮书</Link>
                    <Link href="/docs" className="block text-gray-400 hover:text-amber-400 text-sm transition-colors">开发文档</Link>
                    <Link href="/media" className="block text-gray-400 hover:text-amber-400 text-sm transition-colors">媒体资源</Link>
                    <Link href="/status" className="block text-gray-400 hover:text-amber-400 text-sm transition-colors">系统状态</Link>
                  </div>
                </div>

                {/* 合约 */}
                <div>
                  <h4 className="font-semibold mb-4 text-amber-400">智能合约</h4>
                  <div className="space-y-2">
                    <a href="https://bscscan.com/address/0x713Be3D43c5DdfE145215Cd366c553c75A06Ce7f#code" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-400 hover:text-amber-400 text-sm transition-colors">
                      <span className="text-green-400 text-xs">✓</span> HouseForgeAgent
                    </a>
                    <a href="https://bscscan.com/address/0xa62E109Db724308FEB530A0b00431cf47BBC1f6E#code" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-400 hover:text-amber-400 text-sm transition-colors">
                      <span className="text-green-400 text-xs">✓</span> FusionCore
                    </a>
                  </div>
                </div>

                {/* 社区 */}
                <div>
                  <h4 className="font-semibold mb-4 text-amber-400">社区</h4>
                  <div className="space-y-2">
                    <a href="https://x.com/kinforge_lab" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-amber-400 text-sm transition-colors">X (Twitter)</a>
                    <a href="https://github.com/KinForgeLab/kinforge" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-amber-400 text-sm transition-colors">GitHub</a>
                  </div>
                </div>
              </div>

              <div className="border-t border-amber-500/20 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-gray-500 text-sm">
                  © 2026 KinForge. 保留所有权利。
                </p>
                <div className="flex items-center gap-4">
                  <Link href="/privacy" className="text-gray-500 hover:text-amber-400 text-xs transition-colors">Privacy Policy</Link>
                  <Link href="/terms" className="text-gray-500 hover:text-amber-400 text-xs transition-colors">Terms of Service</Link>
                  <span className="text-gray-600 text-xs">NFT 为数字收藏品，非投资产品。</span>
                </div>
              </div>
            </div>
          </footer>
        </Web3Provider>
      </body>
    </html>
  );
}
