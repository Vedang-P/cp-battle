'use client';

interface RaceTrackProps {
  playerProgress: number;
  opponentProgress: number;
  playerName: string;
  opponentName: string;
  playerSolved: number;
  opponentSolved: number;
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
  const pProg = Math.max(0, Math.min(1, playerProgress));
  const oProg = Math.max(0, Math.min(1, opponentProgress));

  return (
    <div className="flex flex-col gap-1.5 px-4 py-2">
      {/* Player */}
      <div className="flex items-center gap-3">
        <span className="w-20 truncate text-right text-xs font-medium text-brand">
          {playerName}
        </span>
        <div className="relative flex-1 h-5">
          <div className="absolute inset-0 rounded-full bg-bg-elevated" />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-brand/30 transition-all duration-700 ease-out"
            style={{ width: `${Math.max(4, pProg * 100)}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-brand shadow-[0_0_8px_rgba(94,106,210,0.5)] transition-all duration-700 ease-out"
            style={{ left: `calc(${Math.max(0, Math.min(96, pProg * 100))}% - 4px)` }}
          />
        </div>
        <span className="w-10 text-left text-xs font-mono text-text-muted tabular-nums">
          {playerSolved}/{totalProblems}
        </span>
      </div>

      {/* Opponent */}
      <div className="flex items-center gap-3">
        <span className="w-20 truncate text-right text-xs font-medium text-text-tertiary">
          {opponentName}
        </span>
        <div className="relative flex-1 h-5">
          <div className="absolute inset-0 rounded-full bg-bg-elevated" />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/10 transition-all duration-700 ease-out"
            style={{ width: `${Math.max(4, oProg * 100)}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-white/30 transition-all duration-700 ease-out"
            style={{ left: `calc(${Math.max(0, Math.min(96, oProg * 100))}% - 4px)` }}
          />
        </div>
        <span className="w-10 text-left text-xs font-mono text-text-muted tabular-nums">
          {opponentSolved}/{totalProblems}
        </span>
      </div>
    </div>
  );
}
