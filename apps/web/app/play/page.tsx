'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

type QueueStatus = 'idle' | 'queued' | 'in_match';

export default function PlayPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [queueStatus, setQueueStatus] = useState<QueueStatus>('idle');
  const [queueTime, setQueueTime] = useState(0);
  const [error, setError] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Check current status on mount
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/signin?callbackUrl=/play');
      return;
    }
    if (authStatus !== 'authenticated') return;

    fetch('/api/match/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'queued') setQueueStatus('queued');
        else if (data.status === 'in_match') {
          router.push(`/battle/${data.match.id}`);
        }
      });
  }, [authStatus, router]);

  // Poll for match when queued
  useEffect(() => {
    if (queueStatus !== 'queued') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      const res = await fetch('/api/match/status');
      const data = await res.json();
      if (data.status === 'in_match') {
        if (pollRef.current) clearInterval(pollRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
        router.push(`/battle/${data.match.id}`);
      }
    }, 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [queueStatus, router]);

  // Queue timer
  useEffect(() => {
    if (queueStatus === 'queued') {
      setQueueTime(0);
      intervalRef.current = setInterval(() => {
        setQueueTime((t) => t + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [queueStatus]);

  const joinQueue = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/match/join', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.status === 'queued') {
        setQueueStatus('queued');
      } else if (data.error) {
        setError(data.error);
      }
    } catch {
      setError('Failed to join queue');
    }
  }, []);

  const leaveQueue = useCallback(async () => {
    await fetch('/api/match/join', { method: 'DELETE' });
    setQueueStatus('idle');
    setQueueTime(0);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <h1 className="mb-2 text-2xl font-bold">Find a Match</h1>
        <p className="mb-6 text-sm text-gray-400">
          Join the matchmaking queue to be paired with an opponent of similar skill.
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-bad/10 border border-bad/20 px-4 py-2 text-sm text-bad">
            {error}
          </div>
        )}

        {queueStatus === 'idle' && (
          <button onClick={joinQueue} className="btn-primary w-full py-3 text-base">
            Join Queue
          </button>
        )}

        {queueStatus === 'queued' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-accent/20 bg-accent/5 p-6">
              <div className="mb-2 text-sm text-gray-400">Searching for opponent...</div>
              <div className="text-3xl font-bold font-mono text-accent">
                {formatTime(queueTime)}
              </div>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              <span className="text-xs text-gray-500">Matching based on ELO rating</span>
            </div>
            <button onClick={leaveQueue} className="btn-ghost w-full">
              Leave Queue
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 max-w-sm text-center text-xs text-gray-600">
        <p>
          You&apos;ll be matched with a player of similar ELO rating. Once matched, you&apos;ll enter
          a 20-minute battle with 3 progressively harder problems.
        </p>
      </div>
    </main>
  );
}
