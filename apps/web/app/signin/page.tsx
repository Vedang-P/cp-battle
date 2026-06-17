'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Zap } from 'lucide-react';

export default function SignInPage() {
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
        setError('Invalid email or password');
        setLoading(false);
        return;
      }

      window.location.href = res?.url || callbackUrl;
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-3rem)] items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary mb-4">
            <Zap className="h-4 w-4 text-brand" fill="currentColor" />
            CP Battle
          </Link>
          <h1 className="text-lg font-semibold text-text-primary tracking-tight">Sign in</h1>
          <p className="mt-1 text-xs text-text-muted">Welcome back</p>
        </div>

        <div className="card p-6">
          {error && (
            <div className="mb-4 rounded-md bg-error/10 border border-error/20 px-3 py-2 text-xs text-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3" autoComplete="on">
            <div>
              <input
                name="email"
                type="email"
                required
                className="input"
                autoComplete="email"
                placeholder="Email"
              />
            </div>
            <div>
              <input
                name="password"
                type="password"
                required
                className="input"
                autoComplete="current-password"
                placeholder="Password"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full h-9">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-brand hover:text-brand-hover transition-colors">Create one</Link>
        </p>
      </div>
    </main>
  );
}
