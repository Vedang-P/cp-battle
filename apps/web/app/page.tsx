'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { MatrixRain } from '@/components/MatrixRain';
import { TerminalWindow } from '@/components/TerminalWindow';
import { Footer } from '@/components/Footer';

/**
 * Landing page — an interactive terminal.
 *
 * Visitors can type commands: help, play, rank, signup, about.
 * Replaces the generic hero + 3-card feature grid with a single
 * playable terminal that showcases the hacker aesthetic.
 */

interface Line {
  type: 'input' | 'output' | 'system';
  text: string;
}

const HELP_TEXT = [
  'available commands:',
  '  help     — show this help',
  '  play     — start a coding battle',
  '  rank     — view leaderboard',
  '  signup   — create an account',
  '  feedback — send us feedback',
  '  about    — what is zapdos?',
  '  clear    — clear the terminal',
];

const ABOUT_TEXT = [
  'zapdos — 1v1 competitive programming duels',
  '',
  'race head-to-head against another programmer.',
  'progressive-unlock problems (easy -> medium).',
  'live timer, opponent progress, ELO ladder.',
  '',
  'real problems from CSES. judge0 sandbox.',
  'c++ / python / java. 20-minute matches.',
];

export default function HomePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([
    { type: 'system', text: 'ZAPDOS v1.0.0' },
    { type: 'system', text: 'Type "help" to get started.' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const addOutput = (texts: string[]) => {
    setLines((prev) => [...prev, ...texts.map((t) => ({ type: 'output' as const, text: t }))]);
  };

  const runCommand = (cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    setLines((prev) => [...prev, { type: 'input', text: cmd }]);

    if (!trimmed) return;

    setHistory((prev) => [...prev, cmd]);
    setHistoryIdx(-1);

    switch (trimmed) {
      case 'help':
        addOutput(HELP_TEXT);
        break;
      case 'about':
        addOutput(ABOUT_TEXT);
        break;
      case 'clear':
        setLines([]);
        break;
      case 'play':
        addOutput(['redirecting to matchmaking lobby...', '> /play']);
        setTimeout(() => { router.push('/play'); }, 800);
        break;
      case 'rank':
      case 'leaderboard':
        addOutput(['loading leaderboard...', '> /leaderboard']);
        setTimeout(() => { router.push('/leaderboard'); }, 800);
        break;
      case 'signup':
      case 'register':
        addOutput(['creating new account...', '> /signup']);
        setTimeout(() => { router.push('/signup'); }, 800);
        break;
      case 'feedback':
        addOutput(['opening feedback page...', '> /feedback']);
        setTimeout(() => { router.push('/feedback'); }, 800);
        break;
      case 'login':
      case 'signin':
        addOutput(['> /signin']);
        setTimeout(() => { router.push('/signin'); }, 800);
        break;
      case 'ls':
        addOutput(['help  play  rank  signup  about  clear']);
        break;
      case 'whoami':
        addOutput(['guest@zapdos — type "signup" to register']);
        break;
      case 'sudo':
        addOutput(['nice try. this isn\'t your system.']);
        break;
      default:
        addOutput([`command not found: ${trimmed} — type "help" for commands`]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      runCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const newIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(newIdx);
      setInput(history[newIdx] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx === -1) return;
      const newIdx = historyIdx + 1;
      if (newIdx >= history.length) {
        setHistoryIdx(-1);
        setInput('');
      } else {
        setHistoryIdx(newIdx);
        setInput(history[newIdx] ?? '');
      }
    }
  };

  return (
    <div className="flex flex-1 flex-col">
    <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-8">
      <MatrixRain opacity={0.03} speed={0.5} />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center w-full max-w-2xl">
        {/* ASCII Art Title */}
        <div className="mb-6 text-center">
          <pre className="text-[4px] sm:text-[6px] md:text-[8px] leading-tight text-green font-mono mx-auto inline-block text-left select-none">
{`██████████                         █████                    
░█░░░░░░███                         ░░███                     
░     ███░    ██████   ████████   ███████   ██████   █████    
     ███     ░░░░░███ ░░███░░███ ███░░███  ███░░███ ███░░     
    ███       ███████  ░███ ░███░███ ░███ ░███ ░███░░█████    
  ████     █ ███░░███  ░███ ░███░███ ░███ ░███ ░███ ░░░░███   
 ███████████░░████████ ░███████ ░░████████░░██████  ██████    
░░░░░░░░░░░  ░░░░░░░░  ░███░░░   ░░░░░░░░  ░░░░░░  ░░░░░░     
                       ░███                                   
                       █████                                  
                      ░░░░░`}
          </pre>
          <p className="mt-3 text-sm text-text-muted">
            1v1 competitive programming duels — race, rank, repeat.
          </p>
        </div>

        {/* Interactive terminal */}
        <TerminalWindow title="guest@zapdos: ~" className="w-full">
          <div
            ref={scrollRef}
            className="h-80 overflow-y-auto font-mono text-sm leading-relaxed"
            onClick={() => inputRef.current?.focus()}
          >
            {lines.map((line, i) => (
              <div key={i} className={
                line.type === 'input'
                  ? 'text-text-primary'
                  : line.type === 'system'
                  ? 'text-accent-cyan'
                  : 'text-text-muted'
              }>
                {line.type === 'input' && <span className="text-brand">$ </span>}
                {line.text || '\u00A0'}
              </div>
            ))}

            {/* Input line */}
            <div className="flex items-center text-text-primary">
              <span className="text-brand">$</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="ml-2 flex-1 bg-transparent text-text-primary outline-none caret-brand"
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
              <span className="animate-cursor-blink text-brand text-xs">█</span>
            </div>
          </div>
        </TerminalWindow>

        {/* Quick action buttons below terminal */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href={session ? '/play' : '/signup'} className="btn-primary h-10 px-8 text-sm">
            &gt; start
          </Link>
          <Link href="/leaderboard" className="btn-ghost h-10 px-8 text-sm">
            &gt; rank
          </Link>
        </div>
      </div>
    </main>
    <Footer />
    </div>
  );
}
