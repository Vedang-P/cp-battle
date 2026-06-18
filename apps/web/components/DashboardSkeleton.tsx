'use client';

export function DashboardSkeleton() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 animate-fade-in" aria-busy="true" aria-label="Loading dashboard">
      {/* Profile header skeleton */}
      <div className="mb-8">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="h-7 w-32 rounded bg-white/[0.06] animate-pulse" />
            <div className="mt-1 h-3 w-40 rounded bg-white/[0.03] animate-pulse" />
          </div>
          <div className="text-right">
            <div className="h-8 w-16 rounded bg-white/[0.06] animate-pulse ml-auto" />
            <div className="mt-1 h-3 w-8 rounded bg-white/[0.03] animate-pulse ml-auto" />
          </div>
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="mb-8 rounded-lg border border-border-subtle bg-bg-panel p-4">
        <div className="mb-3 h-3 w-32 rounded bg-white/[0.04] animate-pulse" />
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-12 rounded bg-white/[0.04] animate-pulse" />
              <div className="h-5 w-10 rounded bg-white/[0.06] animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* CTA skeleton */}
      <div className="mb-8">
        <div className="h-10 w-full rounded-lg bg-white/[0.04] animate-pulse" />
      </div>

      {/* Match history skeleton */}
      <div className="mb-3 h-4 w-36 rounded bg-white/[0.04] animate-pulse" />
      <div className="space-y-px">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-5 w-14 rounded bg-white/[0.06] animate-pulse" />
              <div className="h-4 w-24 rounded bg-white/[0.04] animate-pulse" />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-4 w-12 rounded bg-white/[0.04] animate-pulse" />
              <div className="h-4 w-8 rounded bg-white/[0.04] animate-pulse" />
              <div className="h-4 w-16 rounded bg-white/[0.03] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
