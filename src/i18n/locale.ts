export const supportedLocales = [
  'en',
  'id',
  'zh-CN',
  'es',
  'pt-BR',
  'ru',
  'tr',
  'vi',
  'ko',
  'hi'
] as const;
export type AppLocale = (typeof supportedLocales)[number];
export type LanguagePreference = 'system' | AppLocale;

export const fallbackLocale: AppLocale = 'en';

/** Shown in each language's own script so users can find it regardless of the current UI language. */
export const nativeLanguageNames: Record<AppLocale, string> = {
  en: 'English',
  id: 'Bahasa Indonesia',
  'zh-CN': '简体中文',
  es: 'Español',
  'pt-BR': 'Português (Brasil)',
  ru: 'Русский',
  tr: 'Türkçe',
  vi: 'Tiếng Việt',
  ko: '한국어',
  hi: 'हिन्दी'
};

export const isAppLocale = (value: unknown): value is AppLocale =>
  (supportedLocales as readonly unknown[]).includes(value);

export const isLanguagePreference = (value: unknown): value is LanguagePreference =>
  value === 'system' || isAppLocale(value);

const traditionalChinese = /^zh-(hant|tw|hk|mo)(-|$)/;

const matchTag = (rawTag: string): AppLocale | null => {
  const tag = rawTag.trim().toLowerCase().replace(/_/g, '-');
  const primary = tag.split('-')[0];
  if (primary === 'en') return 'en';
  // Android and older Java runtimes report Indonesian as "in".
  if (primary === 'id' || primary === 'in') return 'id';
  if (primary === 'zh') return traditionalChinese.test(tag) ? null : 'zh-CN';
  if (primary === 'pt') return 'pt-BR';
  if (
    primary === 'es' ||
    primary === 'ru' ||
    primary === 'tr' ||
    primary === 'vi' ||
    primary === 'ko' ||
    primary === 'hi'
  )
    return primary;
  return null;
};

/** First device language we ship a translation for, in the device's own priority order. */
export const matchDeviceLocale = (deviceLanguages: readonly string[]): AppLocale => {
  for (const tag of deviceLanguages) {
    const match = matchTag(tag);
    if (match) return match;
  }
  return fallbackLocale;
};

export const resolveLocale = (
  preference: LanguagePreference,
  deviceLanguages: readonly string[]
): AppLocale => (preference === 'system' ? matchDeviceLocale(deviceLanguages) : preference);
