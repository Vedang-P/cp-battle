'use client';

import { useMemo } from 'react';

interface RaceTrackProps {
  /** 0..1 for the current user's car position. */
  playerProgress: number;
  /** 0..1 for the opponent's car position. */
  opponentProgress: number;
  /** Current user's display name. */
  playerName: string;
  /** Opponent's display name. */
  opponentName: string;
  /** Player's solved count. */
  playerSolved: number;
  /** Opponent's solved count. */
  opponentSolved: number;
  /** Total problems. */
  totalProblems: number;
}

export default function RaceTrack({
  playerProgress,
  opponentProgress,
  playerName,
  opponentName,
  playerSolved,
  opponentSolved,
  totalProblems,
}: RaceTrackProps) {
  // Clamp to 0..1
  const pProg = Math.max(0, Math.min(1, playerProgress));
  const oProg = Math.max(0, Math.min(1, opponentProgress));

  // Determine if a car just crossed the finish
  const playerFinished = pProg >= 1;
  const opponentFinished = oProg >= 1;

  return (
    <div className="flex flex-col gap-1 px-4 py-2">
      {/* Player car */}
      <div className="flex items-center gap-2">
        <span className="w-20 truncate text-right text-xs font-medium text-accent">
          {playerName}
        </span>
        <div className="relative flex-1">
          {/* Track background */}
          <div className="h-6 rounded-full bg-bg-elev">
            {/* Progress fill */}
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent/30 to-accent/60 transition-all duration-500 ease-out"
              style={{ width: `${Math.max(2, pProg * 100)}%` }}
            />
          </div>
          {/* Car emoji */}
          <div
            className="absolute top-1/2 -translate-y-1/2 text-lg transition-all duration-500 ease-out"
            style={{ left: `calc(${Math.max(0, Math.min(96, pProg * 100))}% - 8px)` }}
          >
            {playerFinished ? '🏁' : '🏎️'}
          </div>
        </div>
        <span className="w-10 text-left text-xs text-gray-400">
          {playerSolved}/{totalProblems}
        </span>
      </div>

      {/* Opponent car */}
      <div className="flex items-center gap-2">
        <span className="w-20 truncate text-right text-xs font-medium text-gray-400">
          {opponentName}
        </span>
        <div className="relative flex-1">
          <div className="h-6 rounded-full bg-bg-elev">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gray-600/30 to-gray-500/60 transition-all duration-500 ease-out"
              style={{ width: `${Math.max(2, oProg * 100)}%` }}
            />
          </div>
          <div
            className="absolute top-1/2 -translate-y-1/2 text-lg transition-all duration-500 ease-out"
            style={{ left: `calc(${Math.max(0, Math.min(96, oProg * 100))}% - 8px)` }}
          >
            {opponentFinished ? '🏁' : '🏎️'}
          </div>
        </div>
        <span className="w-10 text-left text-xs text-gray-400">
          {opponentSolved}/{totalProblems}
        </span>
      </div>
    </div>
  );
}
