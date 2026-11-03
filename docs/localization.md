# Localization

AndroMiner supports English (`en`, the default and fallback), Bahasa Indonesia (`id`) and Simplified Chinese (`zh-CN`). The web build and every APK variant use the same code. Nothing is downloaded and no permission is needed.

## How it works

- Messages live in `src/i18n/locales/<locale>.json`, grouped by screen (`settings.*`, `session.*`, `help.*`). English is the reference: every other language must have the same keys.
- `src/i18n/locale.ts` lists the supported locales, their native names, and maps the device language to a supported locale.
- `src/i18n/index.ts` creates the [vue-i18n](https://vue-i18n.intlify.dev/) instance, sets `<html lang>`, and exports `useLanguage()`, `t()`, `formatDate()`, `formatNumber()` and `formatDuration()`.
- The language setting (`system`, `en`, `id`, `zh-CN`) is saved in `localStorage` as `androminer-language`.
- **System default** follows the device language, including later changes. An unsupported language falls back to English: a device set to Traditional Chinese gets English, not Simplified Chinese.

## Using messages

```vue
<h1>{{ $t('settings.language') }}</h1>
<p>{{ $t('dashboard.showing', { shown: 3, total: runs.length }) }}</p>
```

```ts
import { t, formatDate } from '../i18n';
const message = t('app.imported');
```

Rules:

- Don't join strings into sentences. Use named placeholders such as `{count}` so each language can reorder words. For plurals, write `one | other` and call `$t(key, { n }, n)`.
- Don't translate technical values: wallet addresses, pool hosts and URLs, algorithm names (`rx/0`), protocol identifiers, permission names, raw miner output, error codes. Pass them as placeholders.
- Logic that must run in Node (such as `validateMiningSetup`) returns message keys. The view translates them.
- Format dates, numbers and durations with the `src/i18n` helpers. `toLocaleString(undefined)` follows the device language, not the app language.
- Avoid `|`, `@`, `{` and `}` in message text unless you mean plural or placeholder syntax.
- Compute labels inside `computed()`, render functions or templates. A string built at module load won't change with the language.

## Adding a language

1. Copy `src/i18n/locales/en.json` to `<code>.json` and translate every value. Keep placeholders such as `{name}`. Write what a native speaker would say, not a word-for-word translation.
2. In `src/i18n/locale.ts`, add the code to `supportedLocales` and its native name to `nativeLanguageNames`, then update `matchTag`.
3. In `src/i18n/index.ts`, import the file and add it to `messages`.
4. Run `npm run i18n:check` and `npm test`. In the app (Settings → General → Language), check the long screens (Miner, Help, Settings) at a narrow width for clipped text. Add cases to `tests/i18n.test.mjs`.

## Translation checks

`npm run i18n:check` (also run by `npm test` and CI) fails when:

- A locale is missing a key English has, or has an extra or empty key.
- A translation uses different `{placeholders}` than English.
- Code calls `t('some.key')` and the key doesn't exist.
- An English key isn't used anywhere in `src`.

`tests/i18n.test.mjs` also renders every message in every language and covers switching, saving, English fallback and unsupported device languages.

## Not translated

- The public statistics page (`stats.html`): English only.
- Text from the native Android layer (notifications, miner stop reasons, raw miner output).
- Pool example notes in the coin catalog (internal reference data).
