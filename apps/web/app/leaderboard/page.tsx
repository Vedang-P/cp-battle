'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';

interface LeaderboardEntry {
  id: string;
  username: string;
  elo: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then((data) => { setEntries(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-error">Failed to load leaderboard</p>
          <button onClick={() => window.location.reload()} className="btn-ghost mt-3 h-8 text-xs">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 animate-fade-in">
      <h1 className="mb-6 text-lg font-semibold text-text-primary tracking-tight">Leaderboard</h1>

      {entries.length === 0 ? (
        <EmptyState title="No players yet" description="Be the first to play" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle text-left text-xs text-text-muted">
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Player</th>
                <th className="px-4 py-2.5 text-right font-medium">ELO</th>
                <th className="px-4 py-2.5 text-right font-medium">W</th>
                <th className="px-4 py-2.5 text-right font-medium">L</th>
                <th className="px-4 py-2.5 text-right font-medium">D</th>
                <th className="px-4 py-2.5 text-right font-medium">Win %</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const isMe = session?.user?.id === entry.id;
                const winRate = entry.gamesPlayed > 0
                  ? ((entry.wins / entry.gamesPlayed) * 100).toFixed(0)
                  : '0';

                return (
                  <tr
                    key={entry.id}
                    className={`border-b border-border-subtle transition-colors hover:bg-white/[0.02] ${
                      isMe ? 'bg-brand/[0.04]' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5 text-xs text-text-muted tabular-nums">{i + 1}</td>
                    <td className="px-4 py-2.5 text-sm text-text-secondary">
                      {entry.username}
                      {isMe && <span className="ml-1.5 text-xs text-brand">(you)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium text-brand tabular-nums">
                      {entry.elo}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-success tabular-nums">{entry.wins}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-error tabular-nums">{entry.losses}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-warning tabular-nums">{entry.draws}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-text-muted tabular-nums">{winRate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
