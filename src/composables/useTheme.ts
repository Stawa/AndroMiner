import { computed, ref, watch } from 'vue';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

export type ThemePreference = 'light' | 'dark';
type ResolvedTheme = ThemePreference;

const storageKey = 'androminer-theme';
const themeColors: Record<ResolvedTheme, string> = { dark: '#101211', light: '#f5f7f2' };

const systemQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

const systemTheme = (): ResolvedTheme => (systemQuery?.matches === false ? 'light' : 'dark');

const applyTheme = (mode: ResolvedTheme): void => {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.classList.toggle('dark', mode === 'dark');
  document.documentElement.style.colorScheme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[mode]);
  if (Capacitor.isNativePlatform()) {
    void SystemBars.setStyle({
      style: mode === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light
    }).catch(() => {});
  }
};

const getInitialPreference = (): ThemePreference => {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    // The removed "system" option resolves once to the current OS theme.
    if (stored === 'system') {
      return systemTheme();
    }
  } catch {
    /* Storage unavailable: fall through to the default. */
  }

  return 'dark';
};

const theme = ref<ThemePreference>(getInitialPreference());
const resolvedTheme = computed<ResolvedTheme>(() => theme.value);

let fadeTimer = 0;
watch(resolvedTheme, (mode, previous) => {
  if (previous !== undefined && typeof document !== 'undefined') {
    const root = document.documentElement;
    root.classList.add('theme-fade');
    window.clearTimeout(fadeTimer);
    fadeTimer = window.setTimeout(() => root.classList.remove('theme-fade'), 300);
  }
  applyTheme(mode);
});
applyTheme(resolvedTheme.value);
watch(theme, (mode) => {
  try {
    localStorage.setItem(storageKey, mode);
  } catch {
    /* Keep appearance usable if storage is full. */
  }
});

export const useTheme = () => {
  const isDark = computed(() => resolvedTheme.value === 'dark');

  const setTheme = (mode: ThemePreference): void => {
    theme.value = mode;
  };

  const toggleTheme = (): void => {
    setTheme(isDark.value ? 'light' : 'dark');
  };

  return {
    theme,
    resolvedTheme,
    isDark,
    setTheme,
    toggleTheme
  };
};
