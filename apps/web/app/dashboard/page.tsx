'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import { StatCard } from '@/components/StatCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  elo: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

interface MatchHistory {
  id: string;
  playerA: { id: string; username: string };
  playerB: { id: string; username: string };
  winner: { id: string; username: string } | null;
  scoreA: number;
  scoreB: number;
  eloDeltaA: number;
  eloDeltaB: number;
  createdAt: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<MatchHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin?callbackUrl=/dashboard');
      return;
    }
    if (status === 'authenticated') {
      Promise.all([
        fetch('/api/user/profile').then((r) => r.json()),
        fetch('/api/match/history').then((r) => r.json()),
      ]).then(([p, h]) => {
        setProfile(p);
        setHistory(h);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [status, router]);

  if (loading) return <LoadingSpinner />;

  if (!profile) {
    return (
      <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-error">Failed to load profile</p>
          <button onClick={() => window.location.reload()} className="btn-ghost mt-3 h-8 text-xs">Retry</button>
        </div>
      </div>
    );
  }

  const winRate = profile.gamesPlayed > 0
    ? ((profile.wins / profile.gamesPlayed) * 100).toFixed(0)
    : '0';

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 animate-fade-in">
      {/* Profile header */}
      <div className="mb-8">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary tracking-tight">{profile.username}</h1>
            <p className="mt-0.5 text-xs text-text-muted">{profile.email}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold text-brand tabular-nums">{profile.elo}</div>
            <div className="text-xs text-text-muted">ELO</div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="card p-5 mb-8">
        <div className="grid grid-cols-5 gap-4">
          <StatCard label="Games" value={profile.gamesPlayed} />
          <StatCard label="Wins" value={profile.wins} />
          <StatCard label="Losses" value={profile.losses} />
          <StatCard label="Draws" value={profile.draws} />
          <StatCard label="Win %" value={`${winRate}%`} accent />
        </div>
      </div>

      {/* CTA */}
      <div className="mb-8">
        <Link href="/play" className="btn-primary w-full h-10 text-sm">
          Find a match
        </Link>
      </div>

      {/* Match history */}
      <h2 className="mb-3 text-sm font-medium text-text-secondary tracking-tight">Recent matches</h2>
      {history.length === 0 ? (
        <EmptyState
          title="No matches yet"
          description="Start playing to build your history"
          action={<Link href="/play" className="btn-ghost h-8 text-xs">Find a match</Link>}
        />
      ) : (
        <div className="space-y-px">
          {history.map((match) => {
            const isPlayerA = match.playerA.id === profile.id;
            const opponent = isPlayerA ? match.playerB : match.playerA;
            const myScore = isPlayerA ? match.scoreA : match.scoreB;
            const opScore = isPlayerA ? match.scoreB : match.scoreA;
            const myDelta = isPlayerA ? match.eloDeltaA : match.eloDeltaB;
            const won = match.winner?.id === profile.id;
            const draw = !match.winner;

            return (
              <div key={match.id} className="card flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <StatusBadge variant={draw ? 'draw' : won ? 'win' : 'loss'}>
                    {draw ? 'DRAW' : won ? 'WIN' : 'LOSS'}
                  </StatusBadge>
                  <span className="text-sm text-text-secondary">vs {opponent.username}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm text-text-secondary tabular-nums">
                    {myScore}–{opScore}
                  </span>
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      myDelta > 0 ? 'text-success' : myDelta < 0 ? 'text-error' : 'text-text-muted'
                    }`}
                  >
                    {myDelta > 0 ? '+' : ''}{myDelta}
                  </span>
                  <span className="text-xs text-text-muted">
                    {new Date(match.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
