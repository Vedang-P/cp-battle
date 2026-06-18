'use client';

import { TerminalWindow } from '@/components/TerminalWindow';
import { GlowText } from '@/components/GlowText';
import { ConfettiCanvas } from '@/components/Confetti';
import type { MatchEndPayload } from '@cp-battle/realtime';

interface MatchEndScreenProps {
  matchEnd: MatchEndPayload;
  myUserId: string;
  isPractice: boolean;
  practiceDifficulty: string;
  eloDelta: number;
  displayElo: number;
  showConfetti: boolean;
  solvedCount: { player: number; opponent: number };
  totalProblems: number;
  onRematch: () => void;
  onDashboard: () => void;
}

export function MatchEndScreen({
  matchEnd,
  myUserId,
  isPractice,
  practiceDifficulty,
  eloDelta,
  displayElo,
  showConfetti,
  solvedCount,
  totalProblems,
  onRematch,
  onDashboard,
}: MatchEndScreenProps) {
  const isWinner = matchEnd.winnerId === myUserId;
  const isDraw = !matchEnd.winnerId;

  return (
    <>
      <ConfettiCanvas active={showConfetti} duration={5000} />
      <main className="flex min-h-[calc(100vh-3rem)] items-center justify-center px-4">
        <TerminalWindow title="match/result.log" className="w-full max-w-sm">
          <div className="text-center">
            <h1
              className="text-4xl font-semibold tracking-tight"
              style={{ letterSpacing: '-0.04em', fontFamily: 'var(--font-space-grotesk)' }}
            >
              <GlowText
                color={isDraw ? 'amber' : isWinner ? 'green' : 'red'}
                intensity="strong"
              >
                {isDraw ? 'DRAW' : isWinner ? 'VICTORY' : 'DEFEAT'}
              </GlowText>
            </h1>

            <div className="mt-4 space-y-1">
              <div className="font-mono text-2xl text-text-secondary tabular-nums">
                {solvedCount.player} <span className="text-text-muted text-base">:</span> {solvedCount.opponent}
              </div>
              <div className="font-mono text-[11px] text-text-muted">
                points · {totalProblems} problems
              </div>
            </div>

            {isPractice ? (
              <div className="mt-6">
                <div className="font-mono text-xs text-text-muted mb-1">[practice mode]</div>
                <div className="font-mono text-lg text-text-secondary">no elo change</div>
                <div className="font-mono text-[11px] text-text-muted mt-1">{practiceDifficulty}</div>
              </div>
            ) : (
              <div className="mt-6">
                <div className="font-mono text-xs text-text-muted mb-1">[elo delta]</div>
                <div className={`font-mono text-4xl font-semibold tabular-nums ${
                  eloDelta > 0 ? 'text-success glow-green' : eloDelta < 0 ? 'text-error glow-red' : 'text-text-muted'
                }`} style={{ letterSpacing: '-0.03em' }}>
                  {eloDelta > 0 ? '+' : ''}{displayElo}
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <button onClick={onRematch} className="btn-primary flex-1 h-10 font-mono text-sm">
                &gt; rematch
              </button>
              <button onClick={onDashboard} className="btn-ghost flex-1 h-10 font-mono text-sm">
                &gt; dashboard
              </button>
            </div>
          </div>
        </TerminalWindow>
      </main>
    </>
  );
}
