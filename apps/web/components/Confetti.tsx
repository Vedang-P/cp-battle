'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  shape: 'rect' | 'circle';
}

const COLORS = [
  '#5e6ad2', '#7170ff', '#27a644', '#fc7840', '#eb5757',
  '#f7f8f8', '#b4bcd0', '#ffd700', '#00ffff', '#ff69b4',
];

export function ConfettiCanvas({ active, duration = 3000 }: { active: boolean; duration?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);

  const spawn = useCallback((count: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      particlesRef.current.push({
        x: cx + (Math.random() - 0.5) * 100,
        y: cy + (Math.random() - 0.5) * 50,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        life: 0,
        maxLife: 60 + Math.random() * 60,
        size: 4 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#5e6ad2',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
      });
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window?.innerWidth ?? 1920;
    canvas.height = window?.innerHeight ?? 1080;

    // Burst spawn
    spawn(120);

    // Continuous spawn for the first second
    const spawnInterval = setInterval(() => spawn(20), 50);

    let frame = 0;
    const maxFrames = (duration / 1000) * 60;

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current.filter((p) => {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.vx *= 0.99; // drag
        p.rotation += p.rotationSpeed;

        const alpha = 1 - p.life / p.maxLife;
        if (alpha <= 0) return false;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
        return true;
      });

      frame++;
      if (frame < maxFrames && particlesRef.current.length > 0) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    }

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      clearInterval(spawnInterval);
      cancelAnimationFrame(animFrameRef.current);
      particlesRef.current = [];
    };
  }, [active, duration, spawn]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[100]"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
