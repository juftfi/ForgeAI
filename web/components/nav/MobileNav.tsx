'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@/components/wallet/ConnectButton';

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

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="md:hidden flex items-center gap-3">
      <ConnectButton />
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 flex flex-col items-center justify-center gap-1.5 text-gray-300 hover:text-amber-400 transition-colors"
        aria-label="菜单"
      >
        <span className={`block w-5 h-0.5 bg-current transition-all ${isOpen ? 'rotate-45 translate-y-2' : ''}`} />
        <span className={`block w-5 h-0.5 bg-current transition-all ${isOpen ? 'opacity-0' : ''}`} />
        <span className={`block w-5 h-0.5 bg-current transition-all ${isOpen ? '-rotate-45 -translate-y-2' : ''}`} />
      </button>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 bg-black/95 backdrop-blur-xl border-b border-amber-500/20 py-4 px-6">
          <div className="grid grid-cols-4 gap-2">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`px-3 py-2.5 text-center rounded-lg text-sm font-medium transition-all ${
                  pathname === link.href
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-gray-300 hover:text-amber-400 hover:bg-amber-500/10'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}