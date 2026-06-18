'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: '#050505', color: '#00cc36', fontFamily: 'JetBrains Mono, monospace' }}>
        <main className="flex min-h-screen items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <div className="font-mono text-6xl font-semibold text-[#ff0040] mb-4">!</div>
            <div className="text-sm text-[#00cc36] mb-1">
              $ error: something went wrong
            </div>
            {error.digest && (
              <div className="font-mono text-xs text-[#006618] mb-4">
                digest: {error.digest}
              </div>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={reset}
                style={{
                  background: '#00ff41',
                  color: '#050505',
                  border: 'none',
                  padding: '8px 24px',
                  borderRadius: '6px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                &gt; retry
              </button>
              <a
                href="/"
                style={{
                  background: 'transparent',
                  color: '#00ff41',
                  border: '1px solid rgba(0,255,65,0.25)',
                  padding: '8px 24px',
                  borderRadius: '6px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '13px',
                  textDecoration: 'none',
                }}
              >
                &gt; home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
