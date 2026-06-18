'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { TerminalWindow } from '@/components/TerminalWindow';

export default function SignUpPage() {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setGlobalError('');
    setLoading(true);

    const form = e.currentTarget;
    const data = new FormData(form);
    const body = {
      username: data.get('username') as string,
      email: data.get('email') as string,
      password: data.get('password') as string,
    };

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        if (typeof json.error === 'object') {
          setErrors(json.error);
        } else {
          setGlobalError(json.error || 'registration failed');
        }
        setLoading(false);
        return;
      }

      try {
        const signInRes = await signIn('credentials', {
          email: body.email,
          password: body.password,
          redirect: false,
        });

        if (signInRes?.error) {
          window.location.href = '/signin';
          return;
        }

        window.location.href = '/play';
      } catch {
        window.location.href = '/signin';
      }
    } catch {
      setGlobalError('network error. connection refused.');
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setGlobalError('');
    setLoading(true);
    try {
      await signIn('google', { callbackUrl: '/play' });
    } catch {
      setGlobalError('failed to connect to google');
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-3rem)] items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary mb-4">
            <span className="text-brand font-mono">root@zapdos:~$</span>
          </Link>
          <h1 className="text-lg font-semibold tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            <span className="text-brand">useradd</span>{' '}
            <span className="text-text-primary">new account</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-text-muted">
            {'>_ register to join the arena'}
          </p>
        </div>

        <TerminalWindow title="auth/register.sh">
          {globalError && (
            <div className="mb-4 rounded border border-error/30 bg-error/5 px-3 py-2 font-mono text-xs text-error glow-red">
              <span className="text-text-muted">$</span> {globalError}
            </div>
          )}

          {/* Google Sign Up Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full h-11 flex items-center justify-center gap-2 rounded-md border border-border-medium bg-white text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {loading ? 'connecting...' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-subtle"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-bg-panel px-2 text-text-muted font-mono">or</span>
            </div>
          </div>

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
                placeholder="you@domain.com"
              />
              {errors.email && (
                <p className="mt-1 font-mono text-xs text-error">
                  <span className="text-text-muted">$</span> {errors.email[0]}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] text-text-muted">
                <span className="text-brand">user</span>~
              </label>
              <input
                name="username"
                type="text"
                required
                className="input font-mono"
                autoComplete="name"
                placeholder="handle"
              />
              {errors.username && (
                <p className="mt-1 font-mono text-xs text-error">
                  <span className="text-text-muted">$</span> {errors.username[0]}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] text-text-muted">
                <span className="text-brand">pass</span>~
              </label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className="input font-mono"
                autoComplete="new-password"
                placeholder="min 8 chars"
              />
              {errors.password && (
                <p className="mt-1 font-mono text-xs text-error">
                  <span className="text-text-muted">$</span> {errors.password[0]}
                </p>
              )}
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full h-10 font-mono text-sm">
              {loading ? '> creating account...' : '> create user'}
            </button>
          </form>
        </TerminalWindow>

        <p className="mt-4 text-center font-mono text-xs text-text-muted">
          <span className="text-text-muted">$</span> already registered?{' '}
          <Link href="/signin" className="text-brand hover:text-brand-hover transition-colors">ssh login</Link>
        </p>
      </div>
    </main>
  );
}
