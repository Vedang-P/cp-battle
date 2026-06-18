'use client';

type LanguageId = 'cpp' | 'python' | 'java';

const LANG_LABELS: Record<LanguageId, string> = {
  cpp: 'C++',
  python: 'Python',
  java: 'Java',
};

interface VerdictResult {
  verdict: string;
  passed: number;
  total: number;
  error?: string;
  timeMs?: number;
  memoryKb?: number;
}

interface Problem {
  timeLimitMs: number;
  memoryLimitMb: number;
  progress: { status: string; wrongSubmissions: number; scoreEarned: number };
}

interface OutputPanelProps {
  outputTab: 'result' | 'description';
  onTabChange: (tab: 'result' | 'description') => void;
  verdict: VerdictResult | null;
  problem: Problem;
  language: LanguageId;
}

export function OutputPanel({
  outputTab,
  onTabChange,
  verdict,
  problem,
  language,
}: OutputPanelProps) {
  return (
    <div className="h-48 border-t border-border-subtle" role="tabpanel">
      <div className="flex border-b border-border-subtle" role="tablist">
        <button
          onClick={() => onTabChange('result')}
          role="tab"
          aria-selected={outputTab === 'result'}
          className={`px-4 py-1.5 font-mono text-xs font-medium transition-colors ${
            outputTab === 'result' ? 'text-brand' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          output {verdict && `(${verdict.verdict})`}
        </button>
        <button
          onClick={() => onTabChange('description')}
          role="tab"
          aria-selected={outputTab === 'description'}
          className={`px-4 py-1.5 font-mono text-xs font-medium transition-colors ${
            outputTab === 'description' ? 'text-brand' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          info
        </button>
      </div>
      <div className="h-[calc(100%-2rem)] overflow-y-auto p-3 font-mono text-xs" aria-live="polite">
        {outputTab === 'description' ? (
          <div className="space-y-1 text-text-muted">
            <div><span className="text-text-muted/50">$</span> lang: {LANG_LABELS[language]}</div>
            <div><span className="text-text-muted/50">$</span> time: {problem.timeLimitMs}ms</div>
            <div><span className="text-text-muted/50">$</span> mem: {problem.memoryLimitMb}MB</div>
            <div><span className="text-text-muted/50">$</span> wrong: {problem.progress.wrongSubmissions}</div>
            {problem.progress.status === 'SOLVED' && (
              <div className="text-success"><span className="text-text-muted/50">$</span> solved — {problem.progress.scoreEarned} pts</div>
            )}
            {problem.progress.status === 'LOCKED' && (
              <div className="text-error"><span className="text-text-muted/50">$</span> locked — solve prev first</div>
            )}
          </div>
        ) : verdict ? (
          <div className="space-y-1">
            <div className={`font-medium ${verdict.verdict === 'AC' ? 'text-success glow-green' : verdict.verdict === 'ERROR' ? 'text-error glow-red' : 'text-error glow-red'}`}>
              <span className="text-text-muted/50">$</span> {verdict.verdict}
              {verdict.total > 0 && <span> — {verdict.passed}/{verdict.total}</span>}
            </div>
            {verdict.timeMs != null && <div className="text-text-muted">time: {verdict.timeMs}ms</div>}
            {verdict.memoryKb != null && <div className="text-text-muted">mem: {verdict.memoryKb}KB</div>}
            {verdict.error && (
              <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-bg-elevated p-2 text-error/80 text-[11px]">{verdict.error}</pre>
            )}
          </div>
        ) : (
          <div className="text-text-muted"><span className="text-text-muted/50">$</span> waiting for input...</div>
        )}
      </div>
    </div>
  );
}
