'use client';

import { cn } from '@/lib/utils';

interface RaceTrackProps {
  playerProgress: number;
  opponentProgress: number;
  playerName: string;
  opponentName: string;
  playerSolved: number;
  opponentSolved: number;
  totalProblems: number;
  className?: string;
}

function RocketIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-5 w-5', className)}>
      <path
        d="M12 2C12 2 6 8 6 14C6 17.314 8.686 20 12 20C15.314 20 18 17.314 18 14C18 8 12 2 12 2Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path d="M12 14L9 20L12 18L15 20L12 14Z" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

function FinishFlag() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 text-text-muted">
      <rect x="2" y="2" width="4" height="4" fill="currentColor" opacity="0.3" />
      <rect x="6" y="6" width="4" height="4" fill="currentColor" opacity="0.5" />
      <rect x="2" y="6" width="4" height="4" fill="currentColor" opacity="0.5" />
      <rect x="6" y="2" width="4" height="4" fill="currentColor" opacity="0.3" />
      <rect x="10" y="2" width="4" height="4" fill="currentColor" opacity="0.5" />
      <rect x="14" y="6" width="4" height="4" fill="currentColor" opacity="0.3" />
      <rect x="10" y="6" width="4" height="4" fill="currentColor" opacity="0.3" />
      <rect x="14" y="2" width="4" height="4" fill="currentColor" opacity="0.5" />
      <rect x="2" y="10" width="4" height="4" fill="currentColor" opacity="0.5" />
      <rect x="6" y="10" width="4" height="4" fill="currentColor" opacity="0.3" />
      <rect x="2" y="14" width="4" height="4" fill="currentColor" opacity="0.3" />
      <rect x="6" y="14" width="4" height="4" fill="currentColor" opacity="0.5" />
      <rect x="10" y="10" width="4" height="4" fill="currentColor" opacity="0.3" />
      <rect x="14" y="10" width="4" height="4" fill="currentColor" opacity="0.5" />
      <rect x="10" y="14" width="4" height="4" fill="currentColor" opacity="0.5" />
      <rect x="14" y="14" width="4" height="4" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

export function RaceTrack({
  playerProgress,
  opponentProgress,
  playerName,
  opponentName,
  playerSolved,
  opponentSolved,
  totalProblems,
  className,
}: RaceTrackProps) {
  const pProgress = Math.max(0, Math.min(1, playerProgress));
  const oProgress = Math.max(0, Math.min(1, opponentProgress));

  return (
    <div className={cn('px-4 py-3', className)}>
      {/* Player lane */}
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-brand" />
            <span className="text-xs font-medium text-brand truncate max-w-[100px]">{playerName}</span>
          </div>
          <span className="font-mono text-xs text-text-muted tabular-nums">
            {playerSolved}/{totalProblems}
          </span>
        </div>
        <div className="relative h-8 rounded-full bg-bg-elevated overflow-hidden">
          {/* Track lanes - subtle grid lines */}
          <div className="absolute inset-0 flex items-center">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-full flex-1 border-r border-white/[0.03]" />
            ))}
          </div>
          {/* Progress fill */}
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${Math.max(4, pProgress * 100)}%`,
              background: 'linear-gradient(90deg, rgba(94,106,210,0.2) 0%, rgba(94,106,210,0.4) 100%)',
            }}
          />
          {/* Rocket */}
          <div
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-700 ease-out"
            style={{ left: `calc(${Math.max(2, pProgress * 96)}% - 10px)` }}
          >
            <div className="relative">
              <RocketIcon className="text-brand drop-shadow-[0_0_8px_rgba(94,106,210,0.6)]" />
              {/* Trail particles */}
              {pProgress > 0 && (
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 flex gap-0.5">
                  <div className="h-1 w-1 rounded-full bg-brand/40 animate-pulse" />
                  <div className="h-1.5 w-1.5 rounded-full bg-brand/30 animate-pulse [animation-delay:75ms]" />
                  <div className="h-1 w-1 rounded-full bg-brand/20 animate-pulse [animation-delay:150ms]" />
                </div>
              )}
            </div>
          </div>
          {/* Finish line */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <FinishFlag />
          </div>
        </div>
      </div>

      {/* Opponent lane */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-white/30" />
            <span className="text-xs font-medium text-text-tertiary truncate max-w-[100px]">{opponentName}</span>
          </div>
          <span className="font-mono text-xs text-text-muted tabular-nums">
            {opponentSolved}/{totalProblems}
          </span>
        </div>
        <div className="relative h-8 rounded-full bg-bg-elevated overflow-hidden">
          <div className="absolute inset-0 flex items-center">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-full flex-1 border-r border-white/[0.03]" />
            ))}
          </div>
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${Math.max(4, oProgress * 100)}%`,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 100%)',
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-700 ease-out"
            style={{ left: `calc(${Math.max(2, oProgress * 96)}% - 10px)` }}
          >
            <RocketIcon className="text-white/40" />
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <FinishFlag />
          </div>
        </div>
      </div>
    </div>
  );
}

export default RaceTrack;
