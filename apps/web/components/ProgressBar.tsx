import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercent = true,
  className,
}: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const filled = Math.round(percent / 5);
  const empty = 20 - filled;

  return (
    <div className={cn('font-terminal text-sm', className)}>
      {label && <span className="text-text-muted mr-2">{label}</span>}
      <span className="text-brand">[</span>
      <span className="text-brand">{'█'.repeat(filled)}</span>
      <span className="text-text-muted">{'░'.repeat(empty)}</span>
      <span className="text-brand">]</span>
      {showPercent && (
        <span className="ml-2 text-text-secondary">{Math.round(percent)}%</span>
      )}
    </div>
  );
}

export default ProgressBar;
