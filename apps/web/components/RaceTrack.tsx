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

function FireSpark() {
  return (
    <div className="relative flex items-center" aria-hidden="true">
      {/* Trail dots */}
      <div className="absolute -left-4 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        <div className="h-0.5 w-0.5 rounded-full bg-brand/15 animate-pulse [animation-delay:200ms]" />
        <div className="h-0.5 w-0.5 rounded-full bg-brand/25 animate-pulse [animation-delay:120ms]" />
        <div className="h-1 w-1 rounded-full bg-brand/35 animate-pulse [animation-delay:60ms]" />
        <div className="h-1 w-1 rounded-full bg-brand/50 animate-pulse" />
      </div>
      {/* Core spark */}
      <div className="spark-flicker h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_4px_#00ff41,0_0_8px_#00ff41,0_0_14px_rgba(0,255,65,0.4)]" />
    </div>
  );
}

function Lane({
  name,
  solved,
  total,
  progress,
  isPlayer,
}: {
  name: string;
  solved: number;
  total: number;
  progress: number;
  isPlayer: boolean;
}) {
  const clampedProgress = Math.max(0, Math.min(1, progress));

  return (
    <div className="space-y-1.5">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'font-mono text-xs truncate max-w-[120px]',
            isPlayer ? 'text-brand' : 'text-text-muted',
          )}
        >
          {name}
        </span>
        <span className="font-mono text-xs text-text-muted tabular-nums">
          {solved}/{total}
        </span>
      </div>

      {/* Track — thin glowing bar */}
      <div
        className="relative h-[3px] w-full"
        role="progressbar"
        aria-valuenow={Math.round(clampedProgress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${name}: ${solved} of ${total} problems solved`}
      >
        {/* Rail — subtle background line */}
        <div className="absolute inset-0 rounded-full bg-white/5" />

        {/* Progress fill */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out',
            isPlayer
              ? 'bg-brand shadow-[0_0_6px_rgba(0,255,65,0.5),0_0_14px_rgba(0,255,65,0.2)]'
              : 'bg-brand/30 shadow-[0_0_4px_rgba(0,255,65,0.2)]',
          )}
          style={{ width: `${Math.max(2, clampedProgress * 100)}%` }}
        />

        {/* Fire spark at the tip */}
        {clampedProgress > 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 transition-all duration-700 ease-out"
            style={{ left: `calc(${Math.max(1, clampedProgress * 100)}% - 3px)` }}
          >
            <FireSpark />
          </div>
        )}

        {/* Finish marker */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 font-mono text-[8px] text-text-muted/40 leading-none">
          &gt;
        </div>
      </div>
    </div>
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
  return (
    <div className={cn('px-4 py-3 space-y-3', className)}>
      <Lane
        name={playerName}
        solved={playerSolved}
        total={totalProblems}
        progress={playerProgress}
        isPlayer
      />
      <Lane
        name={opponentName}
        solved={opponentSolved}
        total={totalProblems}
        progress={opponentProgress}
        isPlayer={false}
      />
    </div>
  );
}

export default RaceTrack;
