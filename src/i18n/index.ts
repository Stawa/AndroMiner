import { computed, ref } from 'vue';
import { createI18n } from 'vue-i18n';
import en from './locales/en.json' with { type: 'json' };
import id from './locales/id.json' with { type: 'json' };
import zhCN from './locales/zh-CN.json' with { type: 'json' };
import es from './locales/es.json' with { type: 'json' };
import ptBR from './locales/pt-BR.json' with { type: 'json' };
import ru from './locales/ru.json' with { type: 'json' };
import tr from './locales/tr.json' with { type: 'json' };
import vi from './locales/vi.json' with { type: 'json' };
import ko from './locales/ko.json' with { type: 'json' };
import hi from './locales/hi.json' with { type: 'json' };
import {
  fallbackLocale,
  isLanguagePreference,
  resolveLocale,
  type AppLocale,
  type LanguagePreference
} from './locale.ts';

const storageKey = 'androminer-language';

const deviceLanguages = (): readonly string[] => {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
};

const readPreference = (): LanguagePreference => {
  try {
    const stored = localStorage.getItem(storageKey);
    return isLanguagePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
};

const preference = ref<LanguagePreference>(readPreference());

export const i18n = createI18n({
  legacy: false,
  locale: resolveLocale(preference.value, deviceLanguages()),
  fallbackLocale,
  messages: { en, id, 'zh-CN': zhCN, es, 'pt-BR': ptBR, ru, tr, vi, ko, hi },
  missingWarn: false,
  fallbackWarn: false
});

const applyLocale = (): void => {
  const locale = resolveLocale(preference.value, deviceLanguages());
  i18n.global.locale.value = locale;
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
};
applyLocale();

if (typeof window !== 'undefined') {
  // Only "System default" follows the device; an explicit choice stays put.
  window.addEventListener('languagechange', () => {
    if (preference.value === 'system') applyLocale();
  });
}

export const t = i18n.global.t;
export const te = i18n.global.te;

const activeLocale = (): AppLocale => i18n.global.locale.value as AppLocale;

// Dates and numbers go through Intl with the app language, not the device's.
export const formatDate = (
  value: Date | number | string,
  options: Intl.DateTimeFormatOptions
): string => new Intl.DateTimeFormat(activeLocale(), options).format(new Date(value));

export const formatNumber = (value: number, options?: Intl.NumberFormatOptions): string =>
  new Intl.NumberFormat(activeLocale(), options).format(value);

// Compact "5m 3s" style used by every run and session label.
export const formatDuration = (totalSeconds: number): string => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) return t('time.seconds', { s: seconds });
  if (seconds < 3600) return t('time.minutes', { m: Math.floor(seconds / 60), s: seconds % 60 });
  return t('time.hours', { h: Math.floor(seconds / 3600), m: Math.floor((seconds % 3600) / 60) });
};

export const regionName = (code: string): string =>
  new Intl.DisplayNames(activeLocale(), { type: 'region' }).of(code) || code;

export const useLanguage = () => {
  const locale = computed<AppLocale>(activeLocale);

  const setLanguage = (next: LanguagePreference): void => {
    preference.value = next;
    applyLocale();
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* The choice still applies for this session if storage is unavailable. */
    }
  };

  return { preference, locale, setLanguage };
};
