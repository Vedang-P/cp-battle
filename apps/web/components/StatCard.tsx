import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  accent = false,
  className,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('text-center', className)} aria-label={`${label}: ${value}`}>
      <div
        className={cn(
          'font-mono text-2xl font-semibold tracking-tight tabular-nums',
          accent ? 'text-brand glow-green' : 'text-text-primary',
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 font-mono text-xs text-text-muted tracking-tight">{label}</div>
    </div>
  );
}
