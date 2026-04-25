import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bull: '#22c55e',
        bear: '#ef4444',
        warn: '#f59e0b',
        surface: {
          DEFAULT: '#0f1117',
          card: '#1a1d27',
          border: '#2a2d3a',
          muted: '#252836',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-once':    'pulse 0.6s ease-in-out 1',
        'fade-in':       'fadeIn 0.4s ease-out both',
        'slide-in-up':   'slideInUp 0.55s cubic-bezier(0.16,1,0.3,1) both',
        'slide-in-left': 'slideInLeft 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'scale-in':      'scaleIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
        'float':         'float 3.5s ease-in-out infinite',
        'glow-bull':     'glowBull 2.5s ease-in-out infinite',
        'glow-bear':     'glowBear 2.5s ease-in-out infinite',
        'live-glow':     'liveCardGlow 4s ease-in-out infinite',
        'marquee':       'marquee 28s linear infinite',
        'pulse-ring':    'pulseRing 2.4s ease-out infinite',
        'number-in':     'numberIn 0.5s cubic-bezier(0.16,1,0.3,1) both',
      },
      // Keyframes are defined in globals.css — Tailwind only needs animation names
      keyframes: {},
    },
  },
  plugins: [],
}

export default config
