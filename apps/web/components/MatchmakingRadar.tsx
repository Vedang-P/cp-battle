'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface MatchmakingRadarProps {
  queueTime: number;
  className?: string;
}

export function MatchmakingRadar({ queueTime, className }: MatchmakingRadarProps) {
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const dots = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const angle = (i / 6) * Math.PI * 2;
      const radius = 60 + Math.random() * 30;
      return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        delay: i * 0.3,
        duration: 3 + i * 0.5,
      };
    });
  }, []);

  return (
    <div className={cn('relative flex flex-col items-center', className)}>
      {/* Radar rings */}
      <div className="relative h-48 w-48">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-full border border-brand/20"
            style={{
              animation: `radar-pulse 2s ease-out ${i * 0.6}s infinite`,
            }}
          />
        ))}

        {/* Center dot */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="h-3 w-3 rounded-full bg-brand shadow-[0_0_20px_rgba(0,255,65,0.6)]" />
        </div>

        {/* Scanning line */}
        <div
          className="absolute left-1/2 top-1/2 h-24 w-0.5 origin-bottom"
          style={{
            background: 'linear-gradient(to top, rgba(0,255,65,0.6), transparent)',
            animation: 'radar-scan 2s linear infinite',
          }}
        />

        {/* Floating player dots */}
        {dots.map((dot, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-text-muted/30"
            style={{
              '--x': `${dot.x}px`,
              '--y': `${dot.y}px`,
              animation: `radar-float ${dot.duration}s ease-in-out infinite`,
              animationDelay: `${dot.delay}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Timer */}
      <div className="mt-6 text-center">
        <div className="font-mono text-4xl font-semibold text-text-primary tabular-nums" style={{ letterSpacing: '-0.03em' }}>
          {formatTime(queueTime)}
        </div>
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
          <span className="text-xs text-text-muted">Searching by ELO</span>
        </div>
      </div>
    </div>
  );
}

export default MatchmakingRadar;
