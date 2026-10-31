import { computed, ref, watch } from 'vue';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

type ThemeMode = 'light' | 'dark';

const storageKey = 'androminer-theme';

const applyTheme = (mode: ThemeMode): void => {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.classList.toggle('dark', mode === 'dark');
  document.documentElement.style.colorScheme = mode;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', mode === 'dark' ? '#111719' : '#f9faf8');
  if (Capacitor.isNativePlatform()) {
    void SystemBars.setStyle({
      style: mode === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light
    }).catch(() => {});
  }
};

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  let stored: string | null;
  try {
    stored = localStorage.getItem(storageKey);
  } catch {
    return 'dark';
  }
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  return 'dark';
};

const theme = ref<ThemeMode>(getInitialTheme());
watch(
  theme,
  (mode) => {
    applyTheme(mode);
    try {
      localStorage.setItem(storageKey, mode);
    } catch {
      /* Keep appearance usable if storage is full. */
    }
  },
  { immediate: true }
);

export const useTheme = () => {
  const isDark = computed(() => theme.value === 'dark');

  const setTheme = (mode: ThemeMode): void => {
    theme.value = mode;
  };

  const toggleTheme = (): void => {
    setTheme(isDark.value ? 'light' : 'dark');
  };

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme
  };
};
