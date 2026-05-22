import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        app: {
          bg: '#111615',
          card: '#1a211f',
          elevated: '#222a27',
          line: '#2d3834',
          muted: '#aeb8b3',
          green: '#5ad989',
          'green-dim': '#174d34',
          yellow: '#f8c338'
        },
        surface: {
          bg: '#f8faf7',
          nav: '#fffffb',
          card: '#ffffff',
          elevated: '#eef3ee',
          line: '#dfe5dc',
          on: '#171d19',
          muted: '#647067'
        },
        dark: {
          bg: '#111411',
          nav: '#181c18',
          card: '#1b1f1b',
          elevated: '#242a24',
          line: '#30372f',
          on: '#e7ece5',
          muted: '#aab4a8'
        },
        primary: {
          DEFAULT: '#286b4f',
          container: '#d3f7df',
          dark: '#8dd8b2',
          'dark-container': '#123726'
        },
        graphite: {
          50: '#f7f8fb',
          100: '#e9edf4',
          200: '#cbd4e1',
          300: '#9daec4',
          400: '#64758d',
          500: '#475569',
          600: '#334155',
          700: '#1f2937',
          800: '#111827',
          900: '#080b12',
          950: '#05070d'
        },
        volt: {
          300: '#79ffe1',
          400: '#38f8c5',
          500: '#10d9a8'
        },
        plasma: {
          400: '#8b5cf6',
          500: '#6d5dfc'
        }
      },
      boxShadow: {
        glow: '0 0 34px rgba(56, 248, 197, 0.24)',
        panel: '0 22px 60px rgba(4, 8, 20, 0.22)'
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(0.92)', opacity: '0.75' },
          '70%': { transform: 'scale(1.25)', opacity: '0' },
          '100%': { transform: 'scale(1.25)', opacity: '0' }
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' }
        },
        floatUp: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' }
        }
      },
      animation: {
        pulseRing: 'pulseRing 1.8s ease-out infinite',
        shimmer: 'shimmer 1.5s linear infinite',
        floatUp: 'floatUp 5s ease-in-out infinite'
      }
    }
  },
  plugins: []
} satisfies Config;
