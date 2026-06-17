'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

export function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="fixed top-0 z-50 flex h-14 w-full items-center border-b border-white/5 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <span className="text-accent">CP</span>
          <span>Battle</span>
        </Link>

        <div className="flex items-center gap-4">
          {session ? (
            <>
              <Link href="/play" className="btn-primary text-xs">
                Play
              </Link>
              <Link href="/leaderboard" className="text-sm text-gray-400 hover:text-white transition-colors">
                Leaderboard
              </Link>
              <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
                {session.user.username}
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/signin" className="text-sm text-gray-400 hover:text-white transition-colors">
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary text-xs">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
