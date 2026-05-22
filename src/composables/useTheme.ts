import { computed, onMounted, ref, watch } from 'vue';

type ThemeMode = 'light' | 'dark';

const storageKey = 'androminer-theme';
const theme = ref<ThemeMode>('dark');

const applyTheme = (mode: ThemeMode): void => {
  document.documentElement.classList.toggle('dark', mode === 'dark');
  document.documentElement.style.colorScheme = mode;
};

export const useTheme = () => {
  const isDark = computed(() => theme.value === 'dark');

  const toggleTheme = (): void => {
    theme.value = isDark.value ? 'light' : 'dark';
  };

  onMounted(() => {
    const stored = localStorage.getItem(storageKey);
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme.value = stored === 'light' || stored === 'dark' ? stored : systemDark ? 'dark' : 'light';
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
    toggleTheme
  };
};
