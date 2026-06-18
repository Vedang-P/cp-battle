'use client';

import { useState, useEffect } from 'react';

const MATCH_DURATION_SEC = 15 * 60; // 15 minutes

export function useCountdown(matchId: string) {
  const [timeLeft, setTimeLeft] = useState(MATCH_DURATION_SEC);

  useEffect(() => {
    if (!matchId) return;

    const key = `cpbattle-timer-${matchId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const elapsed = Math.floor((Date.now() - Number(saved)) / 1000);
      setTimeLeft(Math.max(0, MATCH_DURATION_SEC - elapsed));
    } else {
      localStorage.setItem(key, String(Date.now()));
    }

    const interval = setInterval(() => {
      const savedStart = localStorage.getItem(key);
      if (savedStart) {
        const elapsed = Math.floor((Date.now() - Number(savedStart)) / 1000);
        setTimeLeft(Math.max(0, MATCH_DURATION_SEC - elapsed));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [matchId]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const timeWarning = timeLeft <= 60;
  const isFinished = timeLeft <= 0;

  return { timeStr, timeWarning, isFinished };
}
