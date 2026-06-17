'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { MatchmakingRadar } from '@/components/MatchmakingRadar';
import { resumeAudio, playMatchFound } from '@/lib/sounds';

type QueueStatus = 'idle' | 'queued' | 'in_match';

export default function PlayPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [queueStatus, setQueueStatus] = useState<QueueStatus>('idle');
  const [queueTime, setQueueTime] = useState(0);
  const [error, setError] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

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
        else if (data.status === 'in_match') router.push(`/battle/${data.match.id}`);
      });
  }, [authStatus, router]);

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
        playMatchFound();
        router.push(`/battle/${data.match.id}`);
      }
    }, 1000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [queueStatus, router]);

  useEffect(() => {
    if (queueStatus === 'queued') {
      setQueueTime(0);
      intervalRef.current = setInterval(() => setQueueTime((t) => t + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [queueStatus]);

  const joinQueue = useCallback(async () => {
    setError('');
    resumeAudio();
    try {
      const res = await fetch('/api/match/join', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.status === 'queued') setQueueStatus('queued');
      else if (data.error) setError(data.error);
    } catch {
      setError('Failed to join queue');
    }
  }, []);

  const leaveQueue = useCallback(async () => {
    await fetch('/api/match/join', { method: 'DELETE' });
    setQueueStatus('idle');
    setQueueTime(0);
  }, []);

  return (
    <main className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="card p-6 text-center">
          <h1 className="mb-1 text-base font-semibold text-text-primary tracking-tight">Find a match</h1>
          <p className="mb-5 text-xs text-text-muted">
            Paired with an opponent of similar skill
          </p>

          {error && (
            <div className="mb-4 rounded-md bg-error/10 border border-error/20 px-3 py-2 text-xs text-error">
              {error}
            </div>
          )}

          {queueStatus === 'idle' && (
            <button onClick={joinQueue} className="btn-primary w-full h-10 text-sm">
              Join queue
            </button>
          )}

          {queueStatus === 'queued' && (
            <div className="space-y-4">
              <MatchmakingRadar queueTime={queueTime} />
              <button onClick={leaveQueue} className="btn-ghost w-full h-9 text-sm">
                Leave queue
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
