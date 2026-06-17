'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Zap } from 'lucide-react';

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
          setGlobalError(json.error || 'Something went wrong');
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
      setGlobalError('Network error. Please try again.');
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
          <h1 className="text-lg font-semibold text-text-primary tracking-tight">Create account</h1>
          <p className="mt-1 text-xs text-text-muted">Start competing today</p>
        </div>

        <div className="card p-6">
          {globalError && (
            <div className="mb-4 rounded-md bg-error/10 border border-error/20 px-3 py-2 text-xs text-error">
              {globalError}
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
              {errors.email && <p className="mt-1 text-xs text-error">{errors.email[0]}</p>}
            </div>
            <div>
              <input
                name="username"
                type="text"
                required
                className="input"
                autoComplete="name"
                placeholder="Username"
              />
              {errors.username && <p className="mt-1 text-xs text-error">{errors.username[0]}</p>}
            </div>
            <div>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className="input"
                autoComplete="new-password"
                placeholder="Password (min 8 chars)"
              />
              {errors.password && <p className="mt-1 text-xs text-error">{errors.password[0]}</p>}
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full h-9">
              {loading ? 'Creating...' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-text-muted">
          Already have an account?{' '}
          <Link href="/signin" className="text-brand hover:text-brand-hover transition-colors">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
