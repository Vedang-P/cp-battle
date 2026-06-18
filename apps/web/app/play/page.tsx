'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { MatchmakingRadar } from '@/components/MatchmakingRadar';
import { TerminalWindow } from '@/components/TerminalWindow';
import { GlowText } from '@/components/GlowText';
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
    <main className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md animate-fade-in space-y-6">
        {/* Page header */}
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            <GlowText color="green" intensity="strong">battle arena</GlowText>
          </h1>
          <p className="mt-2 font-mono text-xs text-text-muted">
            choose your mode — ranked or practice
          </p>
        </div>

        {/* Ranked Matchmaking */}
        <TerminalWindow title="matchmaking/search.sh">
          <div className="text-center">
            <h2 className="mb-1 text-base font-semibold tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              ranked match
            </h2>
            <p className="mb-5 font-mono text-xs text-text-muted">
              paired with opponent of similar skill — ELO on the line
            </p>

            {error && (
              <div className="mb-4 rounded border border-error/30 bg-error/5 px-3 py-2 font-mono text-xs text-error glow-red">
                <span className="text-text-muted/50">$</span> {error}
              </div>
            )}

            {queueStatus === 'idle' && (
              <button onClick={joinQueue} className="btn-primary w-full h-11 font-mono text-sm">
                &gt; join queue
              </button>
            )}

            {queueStatus === 'queued' && (
              <div className="space-y-4">
                <MatchmakingRadar queueTime={queueTime} />
                <button onClick={leaveQueue} className="btn-ghost w-full h-9 font-mono text-sm">
                  &gt; leave queue
                </button>
              </div>
            )}
          </div>
        </TerminalWindow>

        {/* Practice vs AI */}
        {queueStatus === 'idle' && (
          <TerminalWindow title="practice/solo.sh">
            <div className="text-center mb-5">
              <h2 className="text-sm font-medium tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                practice vs AI
              </h2>
              <p className="font-mono text-[11px] text-text-muted mt-0.5">no ELO impact — warm up your skills</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['EASY', 'MEDIUM'] as const).map((diff) => (
                <button
                  key={diff}
                  onClick={() => startPractice(diff)}
                  disabled={startingPractice}
                  className={`flex flex-col items-center rounded-lg border px-3 py-3 font-mono text-xs font-medium transition-all duration-150 ${
                    diff === 'EASY'
                      ? 'border-success/30 text-success hover:bg-success/10 hover:border-success/50'
                      : 'border-warning/30 text-warning hover:bg-warning/10 hover:border-warning/50'
                  } ${startingPractice ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="text-sm mb-1">{diff === 'EASY' ? '⚡' : '🔥'}</span>
                  <span>{diff === 'EASY' ? 'easy' : 'medium'}</span>
                </button>
              ))}
            </div>
          </TerminalWindow>
        )}
      </div>
    </main>
  );
}
