import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Manrope', 'Roboto', 'system-ui', 'Segoe UI', 'sans-serif'] },
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
        }
      }
    }
  },
  plugins: []
} satisfies Config;
