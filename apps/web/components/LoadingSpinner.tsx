import { cn } from '@/lib/utils';

export function LoadingSpinner({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn('flex min-h-[calc(100vh-3rem)] items-center justify-center', className)}>
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-subtle border-t-brand" />
        {label && <span className="text-xs text-text-muted">{label}</span>}
      </div>
    </div>
  );
}

export function LoadingCard({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center gap-3 py-8 text-sm text-text-muted">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-border-subtle border-t-brand" />
      {text}
    </div>
  );
}
