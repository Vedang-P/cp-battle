'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MusicToggle } from './MusicToggle';

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [time, setTime] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <nav className="fixed top-0 z-50 h-12 w-full border-b border-border-subtle bg-bg/90 frosted" aria-label="Main navigation">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-5">
        {/* Left: terminal prompt */}
        <Link href="/" className="flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary transition-colors">
          <span className="text-brand">root</span>
          <span className="text-text-muted">@</span>
          <span className="text-text-secondary">zapdos</span>
          <span className="text-text-muted">:</span>
          <span className="text-accent-cyan">~</span>
          <span className="text-text-muted">$</span>
          <span className="text-text-muted ml-1.5 hidden sm:inline">{pathname === '/' ? '' : pathname}</span>
          <span className="animate-cursor-blink text-brand text-xs">█</span>
        </Link>

        {/* Desktop: nav links + clock */}
        <div className="hidden sm:flex items-center gap-4">
          {session ? (
            <>
              <Link href="/play" className="text-sm text-text-secondary hover:text-brand transition-colors" aria-current={pathname === '/play' ? 'page' : undefined}>
                &gt; play
              </Link>
              <Link href="/leaderboard" className="text-sm text-text-muted hover:text-text-secondary transition-colors" aria-current={pathname === '/leaderboard' ? 'page' : undefined}>
                &gt; rank
              </Link>
              <Link href="/dashboard" className="text-sm text-text-muted hover:text-text-secondary transition-colors" aria-current={pathname === '/dashboard' ? 'page' : undefined}>
                &gt; profile
              </Link>
              <span className="text-border-medium">|</span>
              <button onClick={() => signOut({ callbackUrl: '/' })} className="text-sm text-text-muted hover:text-error transition-colors" aria-label="Sign out">
                logout
              </button>
            </>
          ) : (
            <>
              <Link href="/signin" className="text-sm text-text-muted hover:text-text-secondary transition-colors">
                &gt; login
              </Link>
              <Link href="/signup" className="rounded border border-border-medium bg-transparent px-3 py-1 text-sm text-brand hover:bg-brand-dim hover:border-brand transition-all">
                &gt; signup
              </Link>
            </>
          )}
          <span className="text-border-medium">|</span>
          <MusicToggle />
          <span className="text-border-medium">|</span>
          <span className="font-mono text-xs text-text-muted tabular-nums">{time}</span>
        </div>

        {/* Mobile: hamburger + clock */}
        <div className="flex sm:hidden items-center gap-3">
          <MusicToggle />
          <span className="font-mono text-xs text-text-muted tabular-nums">{time}</span>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-text-muted hover:text-text-secondary transition-colors p-1.5"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            <span className="font-mono text-sm">{mobileOpen ? 'x' : '='}</span>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-border-subtle bg-bg-panel/95 frosted">
          <div className="flex flex-col px-5 py-4 gap-3">
            {session ? (
              <>
                <Link href="/play" className="font-mono text-sm text-text-secondary hover:text-brand transition-colors py-1.5" aria-current={pathname === '/play' ? 'page' : undefined}>
                  &gt; play
                </Link>
                <Link href="/leaderboard" className="font-mono text-sm text-text-muted hover:text-text-secondary transition-colors py-1.5" aria-current={pathname === '/leaderboard' ? 'page' : undefined}>
                  &gt; rank
                </Link>
                <Link href="/dashboard" className="font-mono text-sm text-text-muted hover:text-text-secondary transition-colors py-1.5" aria-current={pathname === '/dashboard' ? 'page' : undefined}>
                  &gt; profile
                </Link>
                <button onClick={() => signOut({ callbackUrl: '/' })} className="font-mono text-sm text-text-muted hover:text-error transition-colors py-1.5 text-left" aria-label="Sign out">
                  &gt; logout
                </button>
              </>
            ) : (
              <>
                <Link href="/signin" className="font-mono text-sm text-text-muted hover:text-text-secondary transition-colors py-1.5">
                  &gt; login
                </Link>
                <Link href="/signup" className="font-mono text-sm text-brand hover:text-brand-hover transition-colors py-1.5">
                  &gt; signup
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
