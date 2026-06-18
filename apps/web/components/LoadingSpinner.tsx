import { cn } from '@/lib/utils';

export function LoadingSpinner({ className, label }: { className?: string; label?: string }) {
  return (
    <div
      className={cn('flex min-h-[calc(100vh-3rem)] items-center justify-center', className)}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-lg text-brand animate-cursor-blink">█</span>
        {label && <span className="font-mono text-xs text-text-muted">{label}</span>}
      </div>
    </div>
  );
}

export function LoadingCard({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center gap-3 py-8 font-mono text-sm text-text-muted" role="status" aria-live="polite">
      <span className="text-brand animate-cursor-blink">█</span>
      {text}
    </div>
  );
}
