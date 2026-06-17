import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-6">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-8 space-y-4">
          <h1 className="text-6xl font-bold tracking-tight">
            <span className="text-accent">CP</span> Battle
          </h1>
          <p className="text-xl text-gray-400">
            1v1 competitive programming duels. Race head-to-head, solve progressively
            harder problems, climb the ELO ladder.
          </p>
        </div>

        <div className="mb-12 grid grid-cols-3 gap-4 text-left">
          <div className="card p-4">
            <div className="mb-2 text-2xl font-bold text-accent">1v1</div>
            <div className="text-sm text-gray-400">Real-time duels against opponents of similar skill</div>
          </div>
          <div className="card p-4">
            <div className="mb-2 text-2xl font-bold text-ok">3</div>
            <div className="text-sm text-gray-400">Progressive difficulty — Easy, Medium, Hard</div>
          </div>
          <div className="card p-4">
            <div className="mb-2 text-2xl font-bold text-warn">ELO</div>
            <div className="text-sm text-gray-400">Ranked matchmaking with skill-based pairing</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/signup" className="btn-primary px-8 py-3 text-base">
            Get Started
          </Link>
          <Link href="/leaderboard" className="btn-ghost px-8 py-3 text-base">
            View Leaderboard
          </Link>
        </div>
      </div>
    </main>
  );
}
