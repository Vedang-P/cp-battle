'use client';

import ReactMarkdown from 'react-markdown';
import { renderMath } from '@/lib/render-math';

interface Problem {
  id: string;
  title: string;
  descriptionMd: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  points: number;
  progress: { status: string; wrongSubmissions: number; scoreEarned: number };
}

interface ProblemPanelProps {
  problem: Problem;
}

export function ProblemPanel({ problem }: ProblemPanelProps) {
  return (
    <div className="flex w-1/2 flex-col border-r border-border-subtle max-md:w-full max-md:border-r-0">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
        <span className="font-mono text-xs text-text-muted">
          {problem.timeLimitMs}ms · {problem.memoryLimitMb}MB
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed text-text-secondary">
        <ReactMarkdown
          components={{
            h2: ({ children }) => <h2 className="text-lg font-semibold text-text-primary mt-6 mb-3 tracking-tight">{children}</h2>,
            h3: ({ children }) => <h3 className="text-base font-medium text-text-primary mt-4 mb-2">{children}</h3>,
            code: ({ children }) => <code className="rounded bg-bg-elevated px-1.5 py-0.5 font-mono text-xs text-brand">{children}</code>,
            li: ({ children }) => <li className="ml-4">{children}</li>,
          }}
        >
          {renderMath(problem.descriptionMd)}
        </ReactMarkdown>
      </div>
    </div>
  );
}
