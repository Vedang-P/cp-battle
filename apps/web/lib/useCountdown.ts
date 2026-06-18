'use client';

import { useState, useEffect, useRef } from 'react';

interface UseCountdownOptions {
  /** ISO timestamp at which the battle ends (server-authoritative). */
  endsAt: string | null;
  /** The matchId this countdown is bound to (for re-sync triggers). */
  matchId: string;
}

/**
 * Server-authoritative countdown. Derives remaining time from `endsAt` rather
 * than a localStorage start timestamp, so opening a second tab or refreshing
 * produces the correct timer. Falls back to a 20-minute timer if `endsAt` is
 * null (e.g. while the match data is still loading).
 */
export function useCountdown({ endsAt, matchId }: UseCountdownOptions) {
  const [timeLeftMs, setTimeLeftMs] = useState<number>(20 * 60 * 1000);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!matchId) return;

    // Compute remaining from server endsAt; default 20 min while loading.
    const compute = () => {
      if (endsAt) {
        const ms = new Date(endsAt).getTime() - Date.now();
        setTimeLeftMs(Math.max(0, ms));
      }
    };

    compute();

    intervalRef.current = setInterval(compute, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [endsAt, matchId]);

  const totalSec = Math.ceil(timeLeftMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const timeWarning = timeLeftMs <= 60_000;
  const isFinished = timeLeftMs <= 0;

  return { timeStr, timeWarning, isFinished, timeLeftMs };
}
