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
    <div className={cn('text-center', className)}>
      <div
        className={cn(
          'text-2xl font-semibold tracking-tight tabular-nums',
          accent ? 'text-brand' : 'text-text-primary',
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-text-muted tracking-tight">{label}</div>
    </div>
  );
}
