'use client';

import { TerminalWindow } from '@/components/TerminalWindow';
import { GlowText } from '@/components/GlowText';
import { ConfettiCanvas } from '@/components/Confetti';
import type { MatchEndPayload } from '@cp-battle/realtime';
import { useEffect, useState } from 'react';

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

// ASCII art banners
const VICTORY_BANNER = `
 ██╗   ██╗██╗███████╗██╗    ██╗███████╗███████╗██╗
 ██║   ██║██║██╔════╝██║    ██║██╔════╝██╔════╝██║
 ██║   ██║██║█████╗  ██║ █╗ ██║█████╗  █████╗  ██║
 ╚██╗ ██╔╝██║██╔══╝  ██║███╗██║██╔══╝  ██╔══╝  ██║
  ╚████╔╝ ██║███████╗╚███╔███╔╝███████╗███████╗██║
   ╚═══╝  ╚═╝╚══════╝ ╚══╝╚══╝ ╚══════╝╚══════╝╚═╝`;

const DEFEAT_BANNER = `
  ██████╗ ██╗   ██╗███████╗██████╗ ███████╗
  ██╔══██╗██║   ██║██╔════╝██╔══██╗██╔════╝
  ██║  ██║██║   ██║█████╗  ██████╔╝█████╗  
  ██║  ██║╚██╗ ██╔╝██╔══╝  ██╔══██╗██╔══╝  
  ██████╔╝ ╚████╔╝ ███████╗██║  ██║███████╗
  ╚═════╝   ╚═══╝  ╚══════╝╚═╝  ╚═╝╚══════╝`;

const DRAW_BANNER = `
  ██████╗ ██╗    ██╗███████╗
  ██╔══██╗██║    ██║██╔════╝
  ██████╔╝██║ █╗ ██║█████╗  
  ██╔═══╝ ██║███╗██║██╔══╝  
  ██║     ╚███╔███╔╝███████╗
  ╚═╝      ╚══╝╚══╝ ╚══════╝`;

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
  const [showBanner, setShowBanner] = useState(false);

  // Trigger banner animation after mount
  useEffect(() => {
    const t = setTimeout(() => setShowBanner(true), 100);
    return () => clearTimeout(t);
  }, []);

  const banner = isDraw ? DRAW_BANNER : isWinner ? VICTORY_BANNER : DEFEAT_BANNER;
  const color = isDraw ? 'amber' : isWinner ? 'green' : 'red';

  return (
    <>
      <ConfettiCanvas active={showConfetti} duration={5000} />
      <main className="flex min-h-[calc(100vh-3rem)] items-center justify-center px-4">
        <TerminalWindow title="match/result.log" className="w-full max-w-lg">
          <div className="text-center">
            {/* ASCII art banner with glitch effect */}
            <pre
              className={`font-mono text-[8px] sm:text-[10px] leading-tight transition-all duration-500 ${
                showBanner ? 'opacity-100' : 'opacity-0 translate-y-2'
              }`}
              style={{
                color: isDraw ? '#ffb000' : isWinner ? '#00ff41' : '#ff0040',
                textShadow: showBanner
                  ? `0 0 10px ${isDraw ? '#ffb000' : isWinner ? '#00ff41' : '#ff0040'}`
                  : 'none',
              }}
            >
              {banner}
            </pre>

            {/* Result label */}
            <h1 className="mt-4 text-3xl font-semibold tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif', letterSpacing: '-0.04em' }}>
              <GlowText color={color as 'green' | 'red' | 'amber'} intensity="strong">
                {isDraw ? 'DRAW' : isWinner ? 'VICTORY' : 'DEFEAT'}
              </GlowText>
            </h1>

            {/* Score */}
            <div className="mt-4 space-y-1">
              <div className="font-mono text-2xl text-text-secondary tabular-nums">
                {solvedCount.player} <span className="text-text-muted text-base">:</span> {solvedCount.opponent}
              </div>
              <div className="font-mono text-[11px] text-text-muted">
                points · {totalProblems} problems
              </div>
            </div>

            {/* ELO or practice badge */}
            {isPractice ? (
              <div className="mt-6">
                <div className="font-mono text-xs text-text-muted mb-1">[practice mode]</div>
                <div className="font-mono text-lg text-text-secondary">no elo change</div>
                <div className="font-mono text-[11px] text-text-muted mt-1">{practiceDifficulty}</div>
              </div>
            ) : (
              <div className="mt-6">
                <div className="font-mono text-xs text-text-muted mb-1">[elo delta]</div>
                <div
                  className={`font-mono text-4xl font-semibold tabular-nums ${
                    eloDelta > 0 ? 'text-success glow-green' : eloDelta < 0 ? 'text-error glow-red' : 'text-text-muted'
                  }`}
                  style={{ letterSpacing: '-0.03em' }}
                >
                  {eloDelta > 0 ? '+' : ''}{displayElo}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-8 flex gap-2">
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
