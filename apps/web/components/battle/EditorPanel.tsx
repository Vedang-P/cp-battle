'use client';

import dynamic from 'next/dynamic';
import { TERMINAL_THEME } from '@/lib/monaco-theme';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

type LanguageId = 'cpp' | 'python' | 'java';

const LANG_LABELS: Record<LanguageId, string> = {
  cpp: 'C++',
  python: 'Python',
  java: 'Java',
};

interface EditorPanelProps {
  language: LanguageId;
  code: string;
  onCodeChange: (value: string) => void;
  onLanguageChange: (lang: LanguageId) => void;
  onRun: () => void;
  onSubmit: () => void;
  submitting: boolean;
  isDisabled: boolean;
}

export function EditorPanel({
  language,
  code,
  onCodeChange,
  onLanguageChange,
  onRun,
  onSubmit,
  submitting,
  isDisabled,
}: EditorPanelProps) {
  return (
    <div className="flex flex-1 flex-col">
      {/* Editor toolbar */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
        <div className="flex items-center gap-0.5">
          {(Object.keys(LANG_LABELS) as LanguageId[]).map((lang) => (
            <button
              key={lang}
              onClick={() => onLanguageChange(lang)}
              className={`h-6 rounded px-2 font-mono text-xs font-medium transition-colors ${
                language === lang
                  ? 'bg-brand/15 text-brand'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {LANG_LABELS[lang]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onRun}
            disabled={submitting || isDisabled}
            className="btn-ghost h-7 font-mono text-xs"
          >
            {submitting ? 'running...' : '> run'}
            <span className="ml-1.5 text-text-muted/40 hidden sm:inline">^R</span>
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting || isDisabled}
            className="btn-primary h-7 font-mono text-xs"
          >
            {submitting ? 'judging...' : '> submit'}
            <span className="ml-1.5 text-black/40 hidden sm:inline">^&#9166;</span>
          </button>
        </div>
      </div>

      {/* Monaco */}
      <div className="flex-1">
        <MonacoEditor
          height="100%"
          language={language === 'cpp' ? 'cpp' : language}
          theme="terminal"
          value={code}
          onChange={(v) => onCodeChange(v ?? '')}
          beforeMount={(monaco) => {
            monaco.editor.defineTheme('terminal', TERMINAL_THEME);
          }}
          options={{
            fontSize: 13,
            fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
            minimap: { enabled: false },
            padding: { top: 12 },
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
