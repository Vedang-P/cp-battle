import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100vh-2.25rem)] items-center justify-center px-4">
      <div className="text-center">
        <div className="font-mono text-6xl font-semibold text-brand glow-green-strong mb-4">404</div>
        <div className="font-mono text-sm text-text-muted mb-1">
          <span className="text-text-muted/50">$</span> error: page not found
        </div>
        <div className="font-mono text-xs text-text-muted/60 mb-6">
          the path you requested does not exist
        </div>
        <Link href="/" className="btn-primary h-10 px-6 font-mono text-sm inline-flex">
          &gt; cd ~
        </Link>
      </div>
    </main>
  );
}
