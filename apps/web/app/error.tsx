'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center px-4">
      <div className="w-full max-w-sm text-center animate-fade-in">
        <h2 className="text-base font-semibold text-text-primary tracking-tight">Something went wrong</h2>
        <p className="mt-1 text-xs text-text-muted">{error.message || 'An unexpected error occurred'}</p>
        <button onClick={reset} className="btn-ghost mt-4 h-8 text-xs">
          Try again
        </button>
      </div>
    </div>
  );
}
