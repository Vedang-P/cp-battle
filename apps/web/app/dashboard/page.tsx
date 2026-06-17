'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  elo: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: string;
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
  endReason: string | null;
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
      }).catch(() => {
        setLoading(false);
      });
    }
  }, [status, router]);

  if (loading || !profile) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const winRate = profile.gamesPlayed > 0
    ? ((profile.wins / profile.gamesPlayed) * 100).toFixed(1)
    : '0.0';

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold">Dashboard</h1>

      {/* Profile Card */}
      <div className="card mb-8 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{profile.username}</h2>
            <p className="text-sm text-gray-500">{profile.email}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-accent">{profile.elo}</div>
            <div className="text-xs text-gray-500">ELO Rating</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{profile.gamesPlayed}</div>
            <div className="text-xs text-gray-500">Games</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-ok">{profile.wins}</div>
            <div className="text-xs text-gray-500">Wins</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-bad">{profile.losses}</div>
            <div className="text-xs text-gray-500">Losses</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-warn">{profile.draws}</div>
            <div className="text-xs text-gray-500">Draws</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{winRate}%</div>
            <div className="text-xs text-gray-500">Win Rate</div>
          </div>
        </div>

        <div className="mt-6">
          <Link href="/play" className="btn-primary">
            Find a Match
          </Link>
        </div>
      </div>

      {/* Match History */}
      <h2 className="mb-4 text-lg font-semibold">Recent Matches</h2>
      {history.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No matches yet. Start playing to build your history!
        </div>
      ) : (
        <div className="space-y-2">
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
                  <span
                    className={`text-sm font-bold ${
                      draw ? 'text-warn' : won ? 'text-ok' : 'text-bad'
                    }`}
                  >
                    {draw ? 'DRAW' : won ? 'WIN' : 'LOSS'}
                  </span>
                  <span className="text-sm text-gray-400">vs {opponent.username}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm">
                    {myScore} - {opScore}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      myDelta > 0 ? 'text-ok' : myDelta < 0 ? 'text-bad' : 'text-gray-500'
                    }`}
                  >
                    {myDelta > 0 ? '+' : ''}{myDelta}
                  </span>
                  <span className="text-xs text-gray-600">
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
