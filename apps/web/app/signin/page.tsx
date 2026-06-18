'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TerminalWindow } from '@/components/TerminalWindow';

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/play';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const res = await signIn('credentials', {
        email: data.get('email') as string,
        password: data.get('password') as string,
        redirect: false,
        callbackUrl,
      });

      if (res?.error) {
        setError('access denied: invalid credentials');
        setLoading(false);
        return;
      }

      window.location.href = res?.url || callbackUrl;
    } catch {
      setError('network error. connection refused.');
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-2.25rem)] items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary mb-4">
            <span className="text-brand font-mono">root@cp-battle:~$</span>
          </Link>
          <h1 className="text-lg font-semibold tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            <span className="text-brand">ssh</span>{' '}
            <span className="text-text-primary">login</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-text-muted">
            {'>_ authenticate to continue'}
          </p>
        </div>

        <TerminalWindow title="auth/login.sh">
          {error && (
            <div className="mb-4 rounded border border-error/30 bg-error/5 px-3 py-2 font-mono text-xs text-error glow-red">
              <span className="text-text-muted">$</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3" autoComplete="on">
            <div>
              <label className="mb-1 block font-mono text-[11px] text-text-muted">
                <span className="text-brand">email</span>~
              </label>
              <input
                name="email"
                type="email"
                required
                className="input font-mono"
                autoComplete="email"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] text-text-muted">
                <span className="text-brand">pass</span>~
              </label>
              <input
                name="password"
                type="password"
                required
                className="input font-mono"
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full h-10 font-mono text-sm">
              {loading ? '> authenticating...' : '> ssh connect'}
            </button>
          </form>
        </TerminalWindow>

        <p className="mt-4 text-center font-mono text-xs text-text-muted">
          <span className="text-text-muted">$</span> don&apos;t have access?{' '}
          <Link href="/signup" className="text-brand hover:text-brand-hover transition-colors">create account</Link>
        </p>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
