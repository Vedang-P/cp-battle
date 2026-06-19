'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MatrixRain } from '@/components/MatrixRain';
import { TerminalWindow } from '@/components/TerminalWindow';

export default function FeedbackPage() {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');

  const submit = async () => {
    if (!message.trim()) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      });
      if (res.ok) {
        setStatus('done');
        setMessage('');
      } else {
        setStatus('idle');
      }
    } catch {
      setStatus('idle');
    }
  };

  return (
    <main className="relative flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center px-4 py-8">
      <MatrixRain opacity={0.03} speed={0.5} />

      <div className="relative z-10 w-full max-w-lg">
        <div className="mb-6 text-center">
          <Link href="/" className="font-mono text-xs text-text-muted hover:text-text-secondary transition-colors">
            &lt; back to home
          </Link>
          <h1 className="mt-3 text-lg font-medium tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            <span className="text-cyan">send feedback</span>
          </h1>
          <p className="font-mono text-[11px] text-text-muted mt-1">anonymous — helps us improve</p>
        </div>

        <TerminalWindow title="feedback/send.sh">
          {status === 'done' ? (
            <div className="text-center py-8">
              <p className="font-mono text-sm text-success mb-4">thanks for your feedback!</p>
              <button
                onClick={() => setStatus('idle')}
                className="btn-ghost h-9 px-6 font-mono text-sm"
              >
                &gt; send another
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="input font-mono text-sm h-32 resize-none w-full"
                placeholder="type your feedback here..."
                maxLength={2000}
                autoFocus
              />
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-text-muted">{message.length}/2000</span>
                <button
                  onClick={submit}
                  disabled={status === 'loading' || !message.trim()}
                  className="btn-primary h-9 px-6 font-mono text-sm"
                >
                  {status === 'loading' ? '> sending...' : '> submit'}
                </button>
              </div>
            </div>
          )}
        </TerminalWindow>
      </div>
    </main>
  );
}
