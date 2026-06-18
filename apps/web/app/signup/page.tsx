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

  return (
    <main className="flex min-h-[calc(100vh-2.25rem)] items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary mb-4">
            <span className="text-brand font-mono">root@cp-battle:~$</span>
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
