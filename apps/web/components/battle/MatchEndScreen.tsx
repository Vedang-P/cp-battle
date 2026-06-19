'use client';

import { TerminalWindow } from '@/components/TerminalWindow';
import type { MatchEndPayload } from '@zapdos/realtime';
import { useEffect, useState } from 'react';

interface MatchEndScreenProps {
  matchEnd: MatchEndPayload;
  myUserId: string;
  isPractice: boolean;
  practiceDifficulty: string;
  eloDelta: number;
  solvedCount: { player: number; opponent: number };
  totalProblems: number;
  onRematch: () => void;
  onDashboard: () => void;
}

// ASCII art banners — using string concat to avoid template literal parsing issues
const VICTORY_BANNER = [
  '███████   █████  ███            █████                                 ',
  '░░███   ░░███  ░░░            ░░███                                  ',
  ' ░███    ░███  ████   ██████  ███████    ██████  ████████  █████ ████ ',
  ' ░███    ░███ ░░███  ███░░███░░░███░    ███░░███░░███░░███░░███ ░███ ',
  ' ░░███   ███   ░███ ░███ ░░░   ░███    ░███ ░███ ░███ ░░░  ░███ ░███ ',
  '  ░░░█████░    ░███ ░███  ███  ░███ ███░███ ░███ ░███      ░███ ░███ ',
  '    ░░███      █████░░██████   ░░█████ ░░██████  █████     ░░███████ ',
  '     ░░░      ░░░░░  ░░░░░░     ░░░░░   ░░░░░░  ░░░░░       ░░░░░███ ',
  '                                                            ███ ░███ ',
  '                                                           ░░██████  ',
  '                                                            ░░░░░░  ',
].join('\n');

const GAME_OVER_BANNER = [
  '█████████                                                                           ',
  '  ███░░░░░███                                                                      ',
  ' ███     ░░░   ██████   █████████████    ██████      ██████  █████ █████  ██████  ████████',
  '░███          ░░░░░███ ░░███░░███░░███  ███░░███    ███░░███░░███ ░░███  ███░░███░░███░░███',
  '░███    █████  ███████  ░███ ░███ ░███ ░███████    ░███ ░███ ░███  ░███ ░███████  ░███ ░░░ ',
  '░░███  ░░███  ███░░███  ░███ ░███ ░███ ░███░░░     ░███ ░███ ░░███ ███  ░███░░░   ░███     ',
  ' ░░█████████ ░░████████ █████░███ █████░░██████    ░░██████   ░░█████   ░░██████  █████    ',
  '  ░░░░░░░░░   ░░░░░░░░ ░░░░░ ░░░ ░░░░░  ░░░░░░      ░░░░░░     ░░░░░     ░░░░░░  ░░░░░  ',
].join('\n');

const DRAW_BANNER = [
  '█████████                                       ',
  '░░███░░░░███                                    ',
  ' ░███   ░░███ ████████   ██████   █████ ███ █████',
  ' ░███    ░███░░███░░███ ░░░░░███ ░░███ ░███░░███ ',
  ' ░███    ░███ ░███ ░░░   ███████  ░███ ░███ ░███ ',
  ' ░███    ███  ░███      ███░░███  ░░███████████  ',
  ' ██████████   █████    ░░████████  ░░████░████   ',
  '░░░░░░░░░░   ░░░░░      ░░░░░░░░    ░░░░ ░░░░   ',
].join('\n');

export function MatchEndScreen({
  matchEnd,
  myUserId,
  isPractice,
  practiceDifficulty,
  eloDelta,
  solvedCount,
  totalProblems,
  onRematch,
  onDashboard,
}: MatchEndScreenProps) {
  const isWinner = matchEnd.winnerId === myUserId;
  const isDraw = !matchEnd.winnerId;
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowBanner(true), 100);
    return () => clearTimeout(t);
  }, []);

  const banner = isDraw ? DRAW_BANNER : isWinner ? VICTORY_BANNER : GAME_OVER_BANNER;
  const color = isDraw ? 'amber' : isWinner ? 'green' : 'red';

  return (
    <>
      <main className="flex min-h-screen items-center justify-center px-4">
        <TerminalWindow title="match/result.log" className="w-full max-w-2xl">
          <div className="text-center overflow-hidden">
            <pre
              className={`font-mono text-[7px] sm:text-[8px] leading-tight transition-all duration-500 whitespace-pre inline-block text-left ${
                showBanner ? 'opacity-100' : 'opacity-0 translate-y-2'
              }`}
              style={{
                color: isDraw ? '#ffb000' : isWinner ? '#00ff41' : '#ff0040',
                textShadow: showBanner
                  ? '0 0 10px ' + (isDraw ? '#ffb000' : isWinner ? '#00ff41' : '#ff0040')
                  : 'none',
              }}
            >
              {banner}
            </pre>

            <div className="mt-4 space-y-1">
              <div className="font-mono text-2xl text-text-secondary tabular-nums">
                {solvedCount.player}{' '}
                <span className="text-text-muted text-base">:</span>{' '}
                {solvedCount.opponent}
              </div>
              <div className="font-mono text-[11px] text-text-muted">
                points · {totalProblems} problems
              </div>
            </div>

            {isPractice ? (
              <div className="mt-4">
                <div className="font-mono text-[11px] text-text-muted">no elo change</div>
                <div className="font-mono text-[10px] text-text-muted mt-0.5">
                  {practiceDifficulty}
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <div className="font-mono text-[11px] text-text-muted mb-0.5">[elo delta]</div>
                <div
                  className={`font-mono text-3xl font-semibold tabular-nums ${
                    eloDelta > 0
                      ? 'text-success glow-green'
                      : eloDelta < 0
                        ? 'text-error glow-red'
                        : 'text-text-muted'
                  }`}
                  style={{ letterSpacing: '-0.03em' }}
                >
                  {eloDelta >= 0 ? '+' : ''}
                  {eloDelta}
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <button onClick={onRematch} className="btn-primary flex-1 h-10 font-mono text-sm">
                &gt; rematch
              </button>
              <button
                onClick={onDashboard}
                className="btn-ghost flex-1 h-10 font-mono text-sm"
              >
                &gt; dashboard
              </button>
            </div>
          </div>
        </TerminalWindow>
      </main>
    </>
  );
}
