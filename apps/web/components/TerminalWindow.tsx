'use client';

import { cn } from '@/lib/utils';

interface TerminalWindowProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  showDots?: boolean;
}

export function TerminalWindow({
  title = 'terminal',
  children,
  className,
  showDots = true,
}: TerminalWindowProps) {
  return (
    <div className={cn('rounded-lg border border-border-subtle bg-bg-panel overflow-hidden', className)}>
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-border-subtle bg-bg-elevated px-3 py-1.5">
        <div className="flex items-center gap-2">
          {showDots && (
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            </div>
          )}
          <span className="text-[10px] text-text-muted ml-1">{title}</span>
        </div>
        <span className="text-[10px] text-text-muted font-mono">~</span>
      </div>
      {/* Content */}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

export default TerminalWindow;
