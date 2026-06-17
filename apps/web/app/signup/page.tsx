'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

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

      // Auto sign-in after signup — use window.location for reliable redirect
      try {
        const signInRes = await signIn('credentials', {
          email: body.email,
          password: body.password,
          redirect: false,
        });

        if (signInRes?.error) {
          // Account created but auto-login failed — send them to signin page
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
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="mb-6 text-center text-2xl font-bold">Create account</h1>

        {globalError && (
          <div className="mb-4 rounded-md bg-bad/10 border border-bad/20 px-4 py-2 text-sm text-bad">
            {globalError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
          <div>
            <label htmlFor="signup-email" className="mb-1 block text-sm text-gray-400">Email</label>
            <input
              id="signup-email"
              name="email"
              type="email"
              required
              className="input"
              autoComplete="email"
              placeholder="you@example.com"
            />
            {errors.email && <p className="mt-1 text-xs text-bad">{errors.email[0]}</p>}
          </div>
          <div>
            <label htmlFor="signup-username" className="mb-1 block text-sm text-gray-400">Username</label>
            <input
              id="signup-username"
              name="username"
              type="text"
              required
              className="input"
              autoComplete="name"
              placeholder="cool_coder"
            />
            {errors.username && <p className="mt-1 text-xs text-bad">{errors.username[0]}</p>}
          </div>
          <div>
            <label htmlFor="signup-password" className="mb-1 block text-sm text-gray-400">Password</label>
            <input
              id="signup-password"
              name="password"
              type="password"
              required
              minLength={8}
              className="input"
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
            {errors.password && <p className="mt-1 text-xs text-bad">{errors.password[0]}</p>}
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/signin" className="text-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
