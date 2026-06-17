'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

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
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((data) => {
        setEntries(data);
        setLoading(false);
      });
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold">Leaderboard</h1>

      {loading ? (
        <div className="text-center text-gray-400">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No players yet. Be the first!
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase text-gray-500">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">ELO</th>
                <th className="px-4 py-3 text-right">Games</th>
                <th className="px-4 py-3 text-right">W</th>
                <th className="px-4 py-3 text-right">L</th>
                <th className="px-4 py-3 text-right">D</th>
                <th className="px-4 py-3 text-right">Win %</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const isMe = session?.user?.id === entry.id;
                const winRate =
                  entry.gamesPlayed > 0
                    ? ((entry.wins / entry.gamesPlayed) * 100).toFixed(1)
                    : '0.0';

                return (
                  <tr
                    key={entry.id}
                    className={`border-b border-white/5 transition-colors hover:bg-bg-elev ${
                      isMe ? 'bg-accent/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {entry.username}
                      {isMe && <span className="ml-2 text-xs text-accent">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-accent">
                      {entry.elo}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-400">
                      {entry.gamesPlayed}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-ok">{entry.wins}</td>
                    <td className="px-4 py-3 text-right text-sm text-bad">{entry.losses}</td>
                    <td className="px-4 py-3 text-right text-sm text-warn">{entry.draws}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-400">{winRate}%</td>
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
