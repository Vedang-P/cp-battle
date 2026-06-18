'use client';

import Link from 'next/link';
import { MatrixRain } from '@/components/MatrixRain';
import { GlowText } from '@/components/GlowText';
import { TerminalWindow } from '@/components/TerminalWindow';

const FEATURES = [
  {
    icon: '>',
    title: '1v1 Duels',
    desc: 'Real-time matches against similar skill',
    cmd: '/duel',
  },
  {
    icon: '#',
    title: 'Race Mode',
    desc: 'Timed problems, first to finish wins',
    cmd: '/race',
  },
  {
    icon: '^',
    title: 'ELO Ranked',
    desc: 'Skill-based matchmaking and rankings',
    cmd: '/rank',
  },
] as const;

export default function HomePage() {
  return (
    <main className="relative flex min-h-[calc(100vh-2.25rem)] flex-col items-center justify-center px-6">
      <MatrixRain opacity={0.04} speed={0.7} />

      <div className="relative z-10 mx-auto max-w-xl text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-panel px-3 py-1 text-[11px] text-text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          <span className="font-mono">status: live</span>
        </div>

        {/* Hero — terminal style */}
        <div className="mb-8">
          <div className="font-mono text-xs text-text-muted mb-4">
            <span className="text-brand">root</span>
            <span className="text-text-muted">@</span>
            <span className="text-text-secondary">cp-battle</span>
            <span className="text-text-muted">:</span>
            <span className="text-accent-cyan">~</span>
            <span className="text-text-muted">$</span>
          </div>

          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif', letterSpacing: '-0.03em' }}>
            <GlowText color="green" intensity="strong">
              Code.
            </GlowText>
            {' '}
            <span className="text-text-primary">Race.</span>
            <br />
            <GlowText color="green" intensity="strong">
              Compete.
            </GlowText>
          </h1>

          <p className="mt-5 text-base text-text-muted leading-relaxed" style={{ letterSpacing: '-0.011em' }}>
            Head-to-head programming duels. Solve the same problems faster than
            your opponent and climb the ELO ladder.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/signup" className="btn-primary h-10 px-8 text-sm">
            &gt; start
          </Link>
          <Link href="/leaderboard" className="btn-ghost h-10 px-8 text-sm">
            &gt; rank
          </Link>
        </div>

        {/* Features — terminal windows */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {FEATURES.map((f) => (
            <TerminalWindow key={f.title} title={f.cmd} showDots={false}>
              <div className="text-center">
                <div className="text-2xl mb-2">{f.icon}</div>
                <div className="text-sm font-medium text-text-primary tracking-tight">{f.title}</div>
                <div className="mt-1 text-xs text-text-muted leading-relaxed">{f.desc}</div>
              </div>
            </TerminalWindow>
          ))}
        </div>
      </div>
    </main>
  );
}
