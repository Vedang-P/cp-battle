'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

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

      // Successful sign-in — use window.location for reliable redirect
      window.location.href = res?.url || callbackUrl;
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="mb-6 text-center text-2xl font-bold">Sign in</h1>

        {error && (
          <div className="mb-4 rounded-md bg-bad/10 border border-bad/20 px-4 py-2 text-sm text-bad">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
          <div>
            <label htmlFor="signin-email" className="mb-1 block text-sm text-gray-400">Email</label>
            <input
              id="signin-email"
              name="email"
              type="email"
              required
              className="input"
              autoComplete="email username"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="signin-password" className="mb-1 block text-sm text-gray-400">Password</label>
            <input
              id="signin-password"
              name="password"
              type="password"
              required
              className="input"
              autoComplete="current-password"
              placeholder="Your password"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          No account?{' '}
          <Link href="/signup" className="text-accent hover:underline">Create one</Link>
        </p>
      </div>
    </main>
  );
}
