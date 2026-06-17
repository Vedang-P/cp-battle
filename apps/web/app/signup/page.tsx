'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignUpPage() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setGlobalError('');
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = {
      username: form.get('username') as string,
      email: form.get('email') as string,
      password: form.get('password') as string,
    };

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        if (typeof data.error === 'object') {
          setErrors(data.error);
        } else {
          setGlobalError(data.error || 'Something went wrong');
        }
        setLoading(false);
        return;
      }

      // Auto sign-in after signup
      const signInRes = await signIn('credentials', {
        email: body.email,
        password: body.password,
        redirect: false,
      });

      if (signInRes?.url) {
        router.push(signInRes.url);
      } else {
        router.push('/play');
      }
      router.refresh();
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm text-gray-400">Username</label>
            <input id="username" name="username" type="text" required className="input" autoComplete="username" />
            {errors.username && <p className="mt-1 text-xs text-bad">{errors.username[0]}</p>}
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-gray-400">Email</label>
            <input id="email" name="email" type="email" required className="input" autoComplete="email" />
            {errors.email && <p className="mt-1 text-xs text-bad">{errors.email[0]}</p>}
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-gray-400">Password</label>
            <input id="password" name="password" type="password" required minLength={8} className="input" autoComplete="new-password" />
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
