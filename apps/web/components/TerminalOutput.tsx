'use client';

import { cn } from '@/lib/utils';

interface TerminalLine {
  text: string;
  status?: 'info' | 'success' | 'error' | 'warning';
}

interface TerminalOutputProps {
  lines: TerminalLine[];
  className?: string;
}

const statusStyles = {
  info: 'text-text-secondary',
  success: 'text-success glow-green',
  error: 'text-error glow-red',
  warning: 'text-warning glow-amber',
};

const statusPrefix = {
  info: '>',
  success: '✓',
  error: '✗',
  warning: '!',
};

export function TerminalOutput({ lines, className }: TerminalOutputProps) {
  return (
    <div className={cn('rounded-md border border-border-subtle bg-bg-control p-3 font-terminal text-sm', className)}>
      {lines.map((line, i) => (
        <div key={i} className={cn('flex items-start gap-2', statusStyles[line.status ?? 'info'])}>
          <span className="shrink-0 opacity-60">{statusPrefix[line.status ?? 'info']}</span>
          <span>{line.text}</span>
        </div>
      ))}
      <div className="mt-1 flex items-center gap-1 text-text-muted">
        <span>█</span>
      </div>
    </div>
  );
}

export default TerminalOutput;
