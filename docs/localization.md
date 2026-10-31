# Localization

AndroMiner ships in English (`en`, the default and fallback), Bahasa Indonesia (`id`),
and Simplified Chinese (`zh-CN`). The same code serves the web build and every APK
variant; nothing is downloaded and no permission is involved.

## How it works

- Messages live in `src/i18n/locales/<locale>.json`, grouped by screen (`settings.*`,
  `session.*`, `help.*`, and so on). English is the reference catalog.
- `src/i18n/locale.ts` is plain TypeScript: the supported locale list, each language's
  native name, and the logic that turns the device language into a supported locale.
- `src/i18n/index.ts` creates the [vue-i18n](https://vue-i18n.intlify.dev/) instance,
  applies the chosen locale to `<html lang>`, and exposes `useLanguage()`, `t()`,
  `formatDate()`, `formatNumber()` and `formatDuration()`.
- The preference (`system`, `en`, `id`, `zh-CN`) is stored in `localStorage` under
  `androminer-language`, so it survives restarts. **System default** follows the device
  (including later changes) and uses English when the device language is unsupported.
  Traditional Chinese devices therefore get English rather than mislabelled Simplified text.
- Switching language is reactive: every `$t()` / `t()` call re-renders at once.

## Using messages in code

```vue
<h1>{{ $t('settings.language') }}</h1>
<p>{{ $t('dashboard.showing', { shown: 3, total: runs.length }) }}</p>
```

```ts
import { t, formatDate } from '../i18n';
const message = t('app.imported');
```

Rules:

- Never build sentences by concatenation. Use named placeholders (`{count}`) so each
  language can reorder words. Use `$t(key, { n }, n)` with `one | other` text for plurals.
- Do not translate technical values: wallet addresses, pool hosts and URLs, algorithm
  names (`rx/0`), protocol identifiers, Android permission names, raw miner output or
  error codes. Pass them as placeholders and translate only the text around them.
- Pure logic that must stay testable in Node (for example `validateMiningSetup`) returns
  message _keys_; the view translates them.
- Format dates, numbers and durations with the helpers in `src/i18n`, never with
  `toLocaleString(undefined)`, so they follow the app language rather than the device's.
- Avoid `|`, `@`, `{` and `}` in message text unless you mean plural/placeholder syntax.
- Strings computed once at module load do not update on a language switch. Compute labels
  inside `computed()`, render functions or templates.

## Adding a language

1. Copy `src/i18n/locales/en.json` to `src/i18n/locales/<code>.json` and translate every
   value. Keep placeholders (`{name}`) unchanged. Use natural, native terminology rather
   than literal word-for-word output.
2. In `src/i18n/locale.ts` add the code to `supportedLocales`, add its name in its own
   script to `nativeLanguageNames`, and teach `matchTag` which device language tags map to it.
3. In `src/i18n/index.ts` import the new catalog and add it to `messages`.
4. Run `npm run i18n:check` and `npm test`, then switch to the language in the app
   (Settings → General → Language) and look at long screens (Miner, Help, Settings) at a
   narrow width for clipping. Add cases for the new language to `tests/i18n.test.mjs`.

## Translation completeness

`npm run i18n:check` (also run by `npm test` and CI) fails when:

- a locale is missing a key that English has, or has an extra or empty key;
- a translation uses different `{placeholders}` than English;
- code calls `t('some.key')` for a key that does not exist;
- an English key is no longer used anywhere in `src`.

`tests/i18n.test.mjs` additionally renders every message in every language, and covers
locale switching, persistence, fallback and unsupported device languages.

## Not localized

- The public statistics page (`stats.html`) is a separate site and is still English.
- Text produced by the native Android layer (service notifications, miner stop reasons,
  and raw miner output) is delivered as-is from native code.
- Pool example notes in the coin catalog are internal reference data.
