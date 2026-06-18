import { cn } from '@/lib/utils';

type BadgeVariant = 'win' | 'loss' | 'draw' | 'solved' | 'locked' | 'default';

const variantStyles: Record<BadgeVariant, string> = {
  win: 'bg-success/10 text-success border-success/20',
  loss: 'bg-error/10 text-error border-error/20',
  draw: 'bg-warning/10 text-warning border-warning/20',
  solved: 'bg-success/10 text-success border-success/20',
  locked: 'bg-white/5 text-text-muted border-border-subtle',
  default: 'bg-white/5 text-text-secondary border-border-subtle',
};

const variantPrefix: Record<BadgeVariant, string> = {
  win: '✓',
  loss: '✗',
  draw: '●',
  solved: '✓',
  locked: '■',
  default: '',
};

export function StatusBadge({
  variant = 'default',
  children,
  className,
}: {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs font-medium tracking-tight',
        variantStyles[variant],
        className,
      )}
    >
      {variantPrefix[variant] && (
        <span className="opacity-60">{variantPrefix[variant]}</span>
      )}
      {children}
    </span>
  );
}
