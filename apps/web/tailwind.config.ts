import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // CP Battle palette. Dark-first; accent = electric violet for "battle".
        bg: {
          DEFAULT: '#0b0d12',
          card: '#14171f',
          elev: '#1b1f2a',
        },
        accent: {
          DEFAULT: '#7c5cff',
          glow: '#9d85ff',
        },
        ok: '#3fd07f',
        warn: '#ffb454',
        bad: '#ff5d6c',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
