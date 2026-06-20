'use client';

import { renderMath } from '@/lib/render-math';
import { useMemo } from 'react';

interface SampleTestCase {
  input: string;
  expectedOutput: string;
}

interface Problem {
  id: string;
  title: string;
  descriptionMd: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  points: number;
  sampleTestCases?: SampleTestCase[];
  progress: { status: string; wrongSubmissions: number; scoreEarned: number };
}

interface ProblemPanelProps {
  problem: Problem;
}

export function ProblemPanel({ problem }: ProblemPanelProps) {
  const renderedHtml = useMemo(
    () => renderMath(problem.descriptionMd),
    [problem.descriptionMd],
  );

  return (
    <div className="flex w-1/2 flex-col border-r border-border-subtle max-md:w-full max-md:border-r-0">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
        <span className="font-mono text-xs text-text-muted">
          {problem.timeLimitMs}ms · {problem.memoryLimitMb}MB
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed text-text-secondary">
        <div
          className="prose prose-invert max-w-none
            [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-text-primary [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:tracking-tight
            [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-text-primary [&_h3]:mt-4 [&_h3]:mb-2
            [&_code]:rounded [&_code]:bg-bg-elevated [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-brand
            [&_li]:ml-4
            [&_.katex]:text-inherit
            [&_.katex-display]:my-4"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />

        {/* Sample Input/Output */}
        {problem.sampleTestCases && problem.sampleTestCases.length > 0 && (
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-semibold text-text-primary tracking-tight">Examples</h2>
            {problem.sampleTestCases.map((tc, idx) => (
              <div key={idx} className="rounded border border-border-subtle bg-bg-panel overflow-hidden">
                <div className="border-b border-border-subtle bg-bg-elevated px-3 py-1.5">
                  <span className="font-mono text-xs text-text-muted">
                    Example {idx + 1}
                  </span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-border-subtle">
                  <div className="p-3">
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">Input</div>
                    <pre className="overflow-x-auto font-mono text-xs text-text-secondary whitespace-pre">{tc.input}</pre>
                  </div>
                  <div className="p-3">
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">Output</div>
                    <pre className="overflow-x-auto font-mono text-xs text-text-secondary whitespace-pre">{tc.expectedOutput}</pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
