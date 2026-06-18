'use client';

type LanguageId = 'cpp' | 'python' | 'java';

const LANG_LABELS: Record<LanguageId, string> = {
  cpp: 'C++',
  python: 'Python',
  java: 'Java',
};

interface Problem {
  id: string;
  title: string;
  points: number;
  progress: { status: string };
}

interface BattleHUDProps {
  problems: Problem[];
  activeProblem: number;
  currentProblem: Problem;
  language: LanguageId;
  scores: { player: number; opponent: number };
  timeStr: string;
  timeWarning: boolean;
  isPractice: boolean;
  onSwitchProblem: (idx: number) => void;
  onForfeit: () => void;
}

export function BattleHUD({
  problems,
  activeProblem,
  currentProblem,
  scores,
  timeStr,
  timeWarning,
  isPractice,
  onSwitchProblem,
  onForfeit,
}: BattleHUDProps) {
  return (
    <div className="flex items-stretch overflow-x-auto border-b border-border-subtle bg-bg-panel">
      {/* Problem tabs */}
      <div className="flex items-center gap-1 border-r border-border-subtle px-3 py-2">
        {problems.map((p, i) => {
          const isSolved = p.progress.status === 'SOLVED';
          const isCurrent = i === activeProblem;
          const isLocked = p.progress.status === 'LOCKED';
          return (
            <button
              key={p.id}
              onClick={() => onSwitchProblem(i)}
              disabled={isLocked}
              aria-label={`Problem ${i + 1}${isSolved ? ', solved' : ''}${isLocked ? ', locked' : ''}`}
              className={`relative h-8 min-w-[2rem] rounded-md px-2 text-xs font-medium font-mono transition-all duration-150 ${
                isCurrent
                  ? 'bg-brand text-white shadow-[0_0_12px_rgba(0,255,65,0.3)]'
                  : isSolved
                  ? 'bg-success/15 text-success hover:bg-success/20'
                  : isLocked
                  ? 'cursor-not-allowed text-text-muted/30'
                  : 'text-text-muted hover:bg-white/[0.04] hover:text-text-secondary'
              }`}
            >
              {isSolved ? (
                <span className="text-success">✓</span>
              ) : (
                <span className="tabular-nums">{i + 1}</span>
              )}
              {isCurrent && (
                <span className="absolute -bottom-2 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-brand" />
              )}
            </button>
          );
        })}
      </div>

      {/* Problem title + meta */}
      <div className="flex flex-1 items-center gap-4 px-4">
        <div className="flex items-baseline gap-2 overflow-hidden">
          <span className="truncate font-mono text-sm font-medium text-text-primary">{currentProblem.title}</span>
          <span className="shrink-0 font-mono text-[10px] text-text-muted">
            {currentProblem.points} pts
          </span>
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center gap-3 border-l border-border-subtle px-4" role="group" aria-label="Score">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] font-medium uppercase text-brand">you</span>
          <span className="font-mono text-sm font-semibold text-text-primary tabular-nums">{scores.player}</span>
        </div>
        <span className="font-mono text-text-muted/40">:</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm font-semibold text-text-secondary tabular-nums">{scores.opponent}</span>
          <span className="font-mono text-[10px] font-medium uppercase text-text-muted">them</span>
        </div>
      </div>

      {/* Timer */}
      <div
        className={`flex items-center gap-2 border-l border-border-subtle px-4 py-2 ${timeWarning ? 'bg-error/5' : ''}`}
        role="timer"
        aria-label={`Time remaining: ${timeStr}`}
      >
        <div className={`h-1.5 w-1.5 rounded-full ${timeWarning ? 'bg-error animate-pulse' : 'bg-success'}`} />
        <span className={`font-mono text-base font-semibold tabular-nums tracking-wider ${timeWarning ? 'text-error glow-red' : 'text-text-primary'}`}>
          {timeStr}
        </span>
      </div>

      {isPractice && (
        <div className="flex items-center border-l border-border-subtle px-3">
          <span className="font-mono rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
            practice
          </span>
        </div>
      )}

      <button
        onClick={onForfeit}
        className="flex items-center border-l border-border-subtle px-3 font-mono text-[11px] text-text-muted/50 transition-colors hover:bg-error/5 hover:text-error"
        aria-label="Forfeit match"
      >
        ■ forfeit
      </button>
    </div>
  );
}
