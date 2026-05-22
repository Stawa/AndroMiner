import { computed, onMounted, ref, watch } from 'vue';

type ThemeMode = 'light' | 'dark';

const storageKey = 'androminer-theme';

const applyTheme = (mode: ThemeMode): void => {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.classList.toggle('dark', mode === 'dark');
  document.documentElement.style.colorScheme = mode;
};

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const stored = localStorage.getItem(storageKey);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const theme = ref<ThemeMode>(getInitialTheme());
applyTheme(theme.value);

export const useTheme = () => {
  const isDark = computed(() => theme.value === 'dark');

  const setTheme = (mode: ThemeMode): void => {
    theme.value = mode;
  };

  const toggleTheme = (): void => {
    setTheme(isDark.value ? 'light' : 'dark');
  };

  onMounted(() => {
    applyTheme(theme.value);
  });

  watch(
    theme,
    (mode) => {
      applyTheme(mode);
      localStorage.setItem(storageKey, mode);
    },
    { immediate: true }
  );

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme
  };
};
