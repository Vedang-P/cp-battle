'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/play', label: 'Play' },
  { href: '/leaderboard', label: 'Leaderboard' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 flex-shrink-0 border-r border-white/5 bg-bg-card md:block">
      <div className="flex h-full flex-col gap-1 p-4 pt-20">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${
              pathname === link.href
                ? 'bg-accent/10 text-accent'
                : 'text-gray-400 hover:bg-bg-elev hover:text-white'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </aside>
  );
}
