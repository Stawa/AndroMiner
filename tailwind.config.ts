import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Manrope',
          'Inter',
          'Segoe UI Variable',
          'Segoe UI',
          'Roboto',
          'ui-sans-serif',
          'system-ui',
          'sans-serif'
        ]
      },
      colors: {
        app: {
          bg: 'rgb(var(--color-app-bg) / <alpha-value>)',
          card: 'rgb(var(--color-app-card) / <alpha-value>)',
          elevated: 'rgb(var(--color-app-elevated) / <alpha-value>)',
          line: 'rgb(var(--color-app-line) / <alpha-value>)',
          muted: 'rgb(var(--color-app-muted) / <alpha-value>)',
          on: 'rgb(var(--color-app-on) / <alpha-value>)',
          green: 'rgb(var(--color-app-green) / <alpha-value>)',
          'green-dim': 'rgb(var(--color-app-green-dim) / <alpha-value>)',
          yellow: 'rgb(var(--color-app-yellow) / <alpha-value>)'
        },
        surface: {
          bg: '#f7f9fa',
          nav: '#ffffff',
          card: '#ffffff',
          elevated: '#f1f5f8',
          line: '#dae2e9',
          on: '#111820',
          muted: '#535f6c'
        },
        dark: {
          bg: '#0a0d11',
          nav: '#12171c',
          card: '#12171c',
          elevated: '#1a2128',
          line: '#2b353e',
          on: '#f4f9f6',
          muted: '#a5b1bc'
        },
        primary: {
          DEFAULT: '#2a6084',
          container: '#e2ebf1',
          dark: '#77b9d9',
          'dark-container': '#193544'
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
          300: '#9bd7f0',
          400: '#77b9d9',
          500: '#3f8fb8'
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
