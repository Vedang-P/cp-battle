'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <div className="card max-w-md p-8 text-center">
        <h2 className="mb-2 text-xl font-bold text-bad">Something went wrong</h2>
        <p className="mb-6 text-sm text-gray-400">{error.message || 'An unexpected error occurred.'}</p>
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
      </div>
    </div>
  );
}
