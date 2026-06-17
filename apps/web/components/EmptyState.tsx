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
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-sm font-medium text-text-secondary">{title}</div>
      {description && (
        <div className="mt-1 text-xs text-text-muted">{description}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
