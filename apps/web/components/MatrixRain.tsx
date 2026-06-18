'use client';

import { useEffect, useRef } from 'react';

interface MatrixRainProps {
  className?: string;
  opacity?: number;
  speed?: number;
}

const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF<>{}[]=/\\';

export function MatrixRain({ className, opacity = 0.06, speed = 1 }: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Respect prefers-reduced-motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let columns: number[] = [];
    let paused = false;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(dpr, dpr);
      const colCount = Math.floor(window.innerWidth / 14);
      columns = Array.from({ length: colCount }, () => Math.random() * window.innerHeight / 14);
    };

    resize();
    window.addEventListener('resize', resize);

    // Pause when tab is hidden
    const handleVisibility = () => {
      if (document.hidden) {
        paused = true;
        cancelAnimationFrame(animFrame);
      } else {
        paused = false;
        animFrame = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const draw = () => {
      if (paused) return;

      ctx.fillStyle = 'rgba(5, 5, 5, 0.05)';
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      ctx.fillStyle = '#00ff41';
      ctx.font = '14px JetBrains Mono, monospace';

      for (let i = 0; i < columns.length; i++) {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)] ?? '0';
        const x = i * 14;
        const y = (columns[i] ?? 0) * 14;

        ctx.globalAlpha = opacity + Math.random() * 0.03;
        ctx.fillText(char, x, y);

        if (y > window.innerHeight && Math.random() > 0.975) {
          columns[i] = 0;
        }
        columns[i] += speed;
      }

      ctx.globalAlpha = 1;
      animFrame = requestAnimationFrame(draw);
    };

    animFrame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [opacity, speed]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none fixed inset-0 z-0 ${className ?? ''}`}
      aria-hidden="true"
    />
  );
}

export default MatrixRain;
