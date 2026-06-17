import Link from 'next/link';
import { Zap, Timer, TrendingUp } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center px-6">
      {/* Hero */}
      <div className="mx-auto max-w-xl text-center animate-fade-in">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-panel px-3 py-1 text-xs text-text-tertiary">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          Live matchmaking
        </div>

        <h1 className="text-5xl font-semibold tracking-tight text-text-primary sm:text-6xl" style={{ letterSpacing: '-0.03em' }}>
          Code. Race.
          <br />
          <span className="text-brand">Compete.</span>
        </h1>

        <p className="mt-5 text-base text-text-tertiary leading-relaxed" style={{ letterSpacing: '-0.011em' }}>
          Head-to-head programming duels. Solve the same problems faster than
          your opponent and climb the ELO ladder.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/signup" className="btn-primary h-9 px-6 text-sm">
            Get started
          </Link>
          <Link href="/leaderboard" className="btn-ghost h-9 px-6 text-sm">
            Leaderboard
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="mt-20 grid max-w-lg grid-cols-3 gap-px rounded-lg border border-border-subtle bg-border-subtle animate-slide-up">
        {[
          {
            icon: Zap,
            title: '1v1 Duels',
            desc: 'Real-time matches against similar skill',
            color: 'text-brand',
          },
          {
            icon: Timer,
            title: 'Race Mode',
            desc: 'Timed problems, first to finish wins',
            color: 'text-success',
          },
          {
            icon: TrendingUp,
            title: 'ELO Ranked',
            desc: 'Skill-based matchmaking and rankings',
            color: 'text-warning',
          },
        ].map((f) => (
          <div key={f.title} className="bg-bg-panel p-5">
            <f.icon className={`mb-3 h-5 w-5 ${f.color}`} strokeWidth={1.5} />
            <div className="text-sm font-medium text-text-primary tracking-tight">{f.title}</div>
            <div className="mt-1 text-xs text-text-muted leading-relaxed">{f.desc}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
