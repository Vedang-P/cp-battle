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
  const [startingPractice, setStartingPractice] = useState(false);
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

  const startPractice = useCallback(async (difficulty: 'EASY' | 'MEDIUM' | 'HARD') => {
    setError('');
    setStartingPractice(true);
    resumeAudio();
    try {
      const res = await fetch('/api/match/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty }),
      });
      const data = await res.json();
      if (res.ok && data.matchId) {
        playMatchFound();
        router.push(`/battle/${data.matchId}`);
      } else {
        setError(data.error || 'Failed to start practice');
      }
    } catch {
      setError('Failed to start practice');
    } finally {
      setStartingPractice(false);
    }
  }, [router]);

  return (
    <main className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in space-y-4">
        {/* Ranked Matchmaking */}
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

        {/* Practice vs AI */}
        {queueStatus === 'idle' && (
          <div className="card p-6">
            <div className="text-center mb-4">
              <h2 className="text-sm font-medium text-text-primary tracking-tight">Practice vs AI</h2>
              <p className="text-[11px] text-text-muted mt-0.5">No ELO impact — warm up your skills</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['EASY', 'MEDIUM', 'HARD'] as const).map((diff) => (
                <button
                  key={diff}
                  onClick={() => startPractice(diff)}
                  disabled={startingPractice}
                  className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-all duration-150 ${
                    diff === 'EASY'
                      ? 'border-success/20 text-success hover:bg-success/10'
                      : diff === 'MEDIUM'
                      ? 'border-warning/20 text-warning hover:bg-warning/10'
                      : 'border-error/20 text-error hover:bg-error/10'
                  } ${startingPractice ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {diff === 'EASY' ? 'Easy' : diff === 'MEDIUM' ? 'Medium' : 'Hard'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
