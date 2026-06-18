import { TerminalWindow } from '@/components/TerminalWindow';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <TerminalWindow title="empty.log" showDots={false}>
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="font-mono text-sm text-text-secondary">
          <span className="text-text-muted/50">$</span> {title}
        </div>
        {description && (
          <div className="mt-1 font-mono text-xs text-text-muted">{description}</div>
        )}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </TerminalWindow>
  );
}
