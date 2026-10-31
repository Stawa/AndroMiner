import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { matchDeviceLocale, resolveLocale, isLanguagePreference } from '../src/i18n/locale.ts';
import { checkLocales, checkUsage } from './check-i18n.mjs';

// Load Vue before faking `document`: its DOM runtime captures the global at import time.
await import('vue-i18n');

let loads = 0;

/** Imports a fresh copy of the i18n module, as if the app had just been (re)started. */
const startApp = async ({ stored, languages = ['en-US'] } = {}) => {
  const store = new Map(stored === undefined ? [] : [['androminer-language', stored]]);
  const listeners = {};
  const doc = { documentElement: { lang: '' } };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value))
    }
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { languages, language: languages[0] }
  });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { addEventListener: (name, handler) => (listeners[name] = handler) }
  });
  const mod = await import(`../src/i18n/index.ts?run=${loads++}`);
  return {
    ...mod,
    store,
    doc,
    deviceLanguageChanged: (next) => {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: { languages: next, language: next[0] }
      });
      listeners.languagechange?.();
    }
  };
};

test('explicit preference wins over the device language', () => {
  assert.equal(resolveLocale('id', ['zh-CN']), 'id');
  assert.equal(resolveLocale('en', ['id']), 'en');
  assert.equal(resolveLocale('zh-CN', ['en-US']), 'zh-CN');
});

test('system default matches the device language in priority order', () => {
  assert.equal(matchDeviceLocale(['id-ID']), 'id');
  assert.equal(matchDeviceLocale(['in']), 'id');
  assert.equal(matchDeviceLocale(['zh-CN']), 'zh-CN');
  assert.equal(matchDeviceLocale(['zh-Hans-CN']), 'zh-CN');
  assert.equal(matchDeviceLocale(['zh']), 'zh-CN');
  assert.equal(matchDeviceLocale(['en-GB']), 'en');
  assert.equal(matchDeviceLocale(['fr-FR', 'id']), 'id');
  assert.equal(matchDeviceLocale(['de', 'zh-SG']), 'zh-CN');
});

test('unsupported device languages fall back to English', () => {
  assert.equal(matchDeviceLocale(['fr-FR']), 'en');
  assert.equal(matchDeviceLocale(['ja', 'de']), 'en');
  assert.equal(matchDeviceLocale([]), 'en');
  assert.equal(matchDeviceLocale(['']), 'en');
});

test('Traditional Chinese is not mislabelled as Simplified', () => {
  assert.equal(matchDeviceLocale(['zh-TW']), 'en');
  assert.equal(matchDeviceLocale(['zh-Hant-HK']), 'en');
  assert.equal(matchDeviceLocale(['zh-HK', 'id']), 'id');
});

test('device languages map to shipped locales', () => {
  assert.equal(matchDeviceLocale(['pt-PT']), 'pt-BR');
  assert.equal(matchDeviceLocale(['es-MX']), 'es');
  assert.equal(matchDeviceLocale(['ko-KR']), 'ko');
  assert.equal(matchDeviceLocale(['hi-IN']), 'hi');
  assert.equal(matchDeviceLocale(['ru', 'en']), 'ru');
});

test('only known preferences are accepted', () => {
  for (const value of ['system', 'en', 'id', 'zh-CN', 'es', 'pt-BR', 'ru', 'tr', 'vi', 'ko', 'hi'])
    assert.ok(isLanguagePreference(value));
  for (const value of ['fr', '', null, undefined, 'zh', 'EN'])
    assert.ok(!isLanguagePreference(value));
});

test('starts in the device language when nothing is stored', async () => {
  const app = await startApp({ languages: ['id-ID'] });
  assert.equal(app.useLanguage().locale.value, 'id');
  assert.equal(app.t('nav.settings'), 'Pengaturan');
  assert.equal(app.doc.documentElement.lang, 'id');
});

test('unsupported device language starts in English', async () => {
  const app = await startApp({ languages: ['fr-FR'] });
  assert.equal(app.useLanguage().locale.value, 'en');
  assert.equal(app.t('nav.settings'), 'Settings');
});

test('switching language updates messages immediately and is persisted', async () => {
  const app = await startApp({ languages: ['en-US'] });
  const language = app.useLanguage();
  assert.equal(app.t('nav.settings'), 'Settings');

  language.setLanguage('zh-CN');
  assert.equal(language.locale.value, 'zh-CN');
  assert.equal(app.t('nav.settings'), '设置');
  assert.equal(app.doc.documentElement.lang, 'zh-CN');
  assert.equal(app.store.get('androminer-language'), 'zh-CN');

  language.setLanguage('id');
  assert.equal(app.t('nav.settings'), 'Pengaturan');
  assert.equal(app.store.get('androminer-language'), 'id');
});

test('the saved language survives a restart', async () => {
  const first = await startApp({ languages: ['en-US'] });
  first.useLanguage().setLanguage('id');
  const saved = first.store.get('androminer-language');

  const restarted = await startApp({ stored: saved, languages: ['en-US'] });
  assert.equal(restarted.useLanguage().locale.value, 'id');
  assert.equal(restarted.useLanguage().preference.value, 'id');
  assert.equal(restarted.t('nav.settings'), 'Pengaturan');
});

test('an invalid stored value is ignored', async () => {
  const app = await startApp({ stored: 'klingon', languages: ['zh-CN'] });
  assert.equal(app.useLanguage().preference.value, 'system');
  assert.equal(app.useLanguage().locale.value, 'zh-CN');
});

test('choosing System default re-detects the device language', async () => {
  const app = await startApp({ stored: 'id', languages: ['zh-CN'] });
  const language = app.useLanguage();
  assert.equal(language.locale.value, 'id');
  language.setLanguage('system');
  assert.equal(language.locale.value, 'zh-CN');
  assert.equal(app.store.get('androminer-language'), 'system');
});

test('only System default follows later device language changes', async () => {
  const followed = await startApp({ languages: ['en-US'] });
  followed.deviceLanguageChanged(['id']);
  assert.equal(followed.useLanguage().locale.value, 'id');

  const pinned = await startApp({ stored: 'zh-CN', languages: ['en-US'] });
  pinned.deviceLanguageChanged(['id']);
  assert.equal(pinned.useLanguage().locale.value, 'zh-CN');
});

test('missing translations fall back to English', async () => {
  const app = await startApp({ stored: 'id' });
  app.i18n.global.mergeLocaleMessage('en', { onlyEnglish: 'English only' });
  assert.equal(app.t('onlyEnglish'), 'English only');
});

test('plurals and parameters render in every language', async () => {
  const app = await startApp({ languages: ['en-US'] });
  const language = app.useLanguage();
  language.setLanguage('en');
  assert.equal(app.t('unit.threads', { n: 1 }, 1), '1 thread');
  assert.equal(app.t('unit.threads', { n: 4 }, 4), '4 threads');
  language.setLanguage('id');
  assert.equal(app.t('unit.threads', { n: 4 }, 4), '4 thread');
  language.setLanguage('zh-CN');
  assert.equal(app.t('unit.threads', { n: 4 }, 4), '4 个线程');
  assert.equal(app.t('app.viewSession', { status: 'X' }), 'X · 查看会话');
});

test('technical values are interpolated untouched', async () => {
  const app = await startApp({ stored: 'zh-CN' });
  const algorithm = 'rx/0';
  assert.ok(app.t('dashboard.cpuMining', { algorithm }).includes(algorithm));
  assert.ok(app.t('config.walletLabel', { symbol: 'XMR' }).includes('XMR'));
  assert.ok(app.t('guard.thermal', { threshold: 42 }).includes('42 °C'));
});

test('dates and numbers follow the app language', async () => {
  const app = await startApp({ languages: ['en-US'] });
  app.useLanguage().setLanguage('zh-CN');
  assert.match(app.formatDate(Date.UTC(2026, 0, 15, 12), { month: 'long', timeZone: 'UTC' }), /月/);
  assert.equal(app.formatDuration(125), '2分5秒');
  app.useLanguage().setLanguage('en');
  assert.equal(app.formatDuration(125), '2m 5s');
  assert.equal(app.formatDuration(3700), '1h 1m');
});

test('every message in every language renders without errors', async () => {
  const app = await startApp({ languages: ['en-US'] });
  const flatten = (node, prefix = '') =>
    Object.entries(node).flatMap(([key, value]) =>
      typeof value === 'object' ? flatten(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]]
    );
  for (const locale of ['en', 'id', 'zh-CN', 'es', 'pt-BR', 'ru', 'tr', 'vi', 'ko', 'hi']) {
    const catalog = JSON.parse(fs.readFileSync(`src/i18n/locales/${locale}.json`, 'utf8'));
    app.useLanguage().setLanguage(locale);
    for (const [key, message] of flatten(catalog)) {
      const params = Object.fromEntries(
        [...message.matchAll(/\{(\w+)\}/g)].map((match) => [match[1], 'X'])
      );
      const rendered = app.t(key, params, 2);
      assert.notEqual(rendered, key, `${locale}: ${key} did not resolve`);
      assert.ok(!/[{}]/.test(rendered), `${locale}: ${key} left a placeholder: ${rendered}`);
    }
  }
});

test('all locales have identical keys and placeholders', () => {
  assert.deepEqual(checkLocales(), []);
});

test('every key is used and every referenced key exists', () => {
  assert.deepEqual(checkUsage(), []);
});
