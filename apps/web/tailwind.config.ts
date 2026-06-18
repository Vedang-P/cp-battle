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
        bg: {
          DEFAULT: '#050505',
          panel: '#0a0a0a',
          elevated: '#111111',
          control: '#1a1a1a',
        },
        text: {
          primary: '#e0e0e0',
          secondary: '#00cc36',
          tertiary: '#009928',
          muted: '#00aa2e',
        },
        brand: {
          DEFAULT: '#00ff41',
          hover: '#39ff6e',
          dim: 'rgba(0,255,65,0.15)',
        },
        success: '#00ff41',
        error: '#ff0040',
        warning: '#ffb000',
        accent: {
          amber: '#ffb000',
          cyan: '#00d4ff',
          red: '#ff0040',
        },
        border: {
          subtle: 'rgba(0,255,65,0.12)',
          medium: 'rgba(0,255,65,0.25)',
          bright: 'rgba(0,255,65,0.4)',
        },
      },
      fontFamily: {
        sans: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'cursor-blink': 'blink 1s step-end infinite',
        'scanline': 'scanline-sweep 8s linear infinite',
        'neon-pulse': 'neon-pulse 2s ease-in-out infinite',
        'glitch': 'glitch 0.3s ease-in-out',
        'typewriter': 'typewriter 2s steps(40) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glow: {
          '0%': { opacity: '0.4' },
          '100%': { opacity: '1' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'scanline-sweep': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'neon-pulse': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0,255,65,0.3), inset 0 0 5px rgba(0,255,65,0.1)' },
          '50%': { boxShadow: '0 0 15px rgba(0,255,65,0.5), inset 0 0 10px rgba(0,255,65,0.2)' },
        },
        glitch: {
          '0%, 100%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(2px, -1px)' },
          '60%': { transform: 'translate(-1px, -2px)' },
          '80%': { transform: 'translate(1px, 1px)' },
        },
        typewriter: {
          'from': { width: '0' },
          'to': { width: '100%' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
