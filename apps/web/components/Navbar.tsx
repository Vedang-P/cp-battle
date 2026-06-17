'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Zap } from 'lucide-react';

export function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="fixed top-0 z-50 h-12 w-full border-b border-border-subtle bg-bg/80 frosted">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-text-primary tracking-tight">
          <Zap className="h-4 w-4 text-brand" fill="currentColor" />
          <span>CP Battle</span>
        </Link>

        <div className="flex items-center gap-1">
          {session ? (
            <>
              <Link
                href="/play"
                className="btn-primary text-xs h-7 px-3"
              >
                Play
              </Link>
              <Link
                href="/leaderboard"
                className="rounded-md px-2.5 py-1 text-xs text-text-tertiary hover:text-text-primary transition-colors duration-100"
              >
                Leaderboard
              </Link>
              <Link
                href="/dashboard"
                className="rounded-md px-2.5 py-1 text-xs text-text-tertiary hover:text-text-primary transition-colors duration-100"
              >
                {(session.user as any)?.username ?? 'Dashboard'}
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="rounded-md px-2.5 py-1 text-xs text-text-muted hover:text-text-tertiary transition-colors duration-100"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/signin"
                className="rounded-md px-2.5 py-1 text-xs text-text-tertiary hover:text-text-primary transition-colors duration-100"
              >
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary text-xs h-7 px-3">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
