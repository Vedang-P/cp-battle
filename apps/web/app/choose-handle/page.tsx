'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { TerminalWindow } from '@/components/TerminalWindow';

export default function ChooseHandlePage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [handle, setHandle] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If onboarding is complete, redirect to play
  if (session?.user?.onboardingComplete) {
    router.push('/play');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = handle.trim().toLowerCase();
    if (!trimmed) {
      setError('handle cannot be empty');
      return;
    }
    if (trimmed.length < 3 || trimmed.length > 20) {
      setError('handle must be 3-20 characters');
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(trimmed)) {
      setError('only lowercase letters, numbers, _ and - allowed');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/user/claim-handle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'failed to claim handle');
        return;
      }

      // Update the session with the new username
      await update();
      router.push('/play');
    } catch {
      setError('network error — try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            choose your handle
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            this is how other players will see you.
          </p>
        </div>

        <TerminalWindow title="onboarding/setup.sh">
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label className="mb-1 block font-mono text-xs text-text-muted">
                $ enter handle:
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => { setHandle(e.target.value); setError(''); }}
                className="input w-full"
                placeholder="e.g. pikachu42"
                autoFocus
                disabled={loading}
              />
              {error && (
                <p className="mt-1 font-mono text-xs text-red-400">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !handle.trim()}
              className="btn-primary w-full"
            >
              {loading ? 'reserving...' : '> confirm handle'}
            </button>
          </form>
        </TerminalWindow>

        <p className="mt-4 text-center text-xs text-text-muted/50">
          you can change this later in settings.
        </p>
      </div>
    </div>
  );
}
