# Localization

AndroMiner is available in English (`en`, the default and fallback), Bahasa Indonesia (`id`) and Simplified Chinese (`zh-CN`). The web build and every APK variant use the same code. Nothing is downloaded and no permission is needed.

## How it works

- Messages live in `src/i18n/locales/<locale>.json`, grouped by screen (`settings.*`, `session.*`, `help.*` and so on). English is the reference: every other language must match its keys.
- `src/i18n/locale.ts` is plain TypeScript. It holds the list of supported locales, each language's name in its own script, and the logic that maps the device language to a supported locale.
- `src/i18n/index.ts` creates the [vue-i18n](https://vue-i18n.intlify.dev/) instance and sets `<html lang>`. It also exports `useLanguage()`, `t()`, `formatDate()`, `formatNumber()` and `formatDuration()`.
- The language setting (`system`, `en`, `id` or `zh-CN`) is saved in `localStorage` under `androminer-language`, so it survives restarts.
- **System default** follows the device language, including later changes. If the device language is not supported, the app uses English. A device set to Traditional Chinese therefore gets English, not Simplified Chinese labeled as something else.
- Switching language updates every `$t()` / `t()` call right away.

## Using messages in code

```vue
<h1>{{ $t('settings.language') }}</h1>
<p>{{ $t('dashboard.showing', { shown: 3, total: runs.length }) }}</p>
```

```ts
import { t, formatDate } from '../i18n';
const message = t('app.imported');
```

Follow these rules:

- Don't build sentences by joining strings. Use named placeholders such as `{count}` so each language can put the words in its own order. For plurals, write `one | other` text and call `$t(key, { n }, n)`.
- Don't translate technical values: wallet addresses, pool hosts and URLs, algorithm names (`rx/0`), protocol identifiers, Android permission names, raw miner output and error codes. Pass them in as placeholders and translate only the text around them.
- Logic that has to be testable in Node (for example `validateMiningSetup`) returns message keys. The view translates them.
- Format dates, numbers and durations with the helpers in `src/i18n`. Don't call `toLocaleString(undefined)`, because that follows the device language, not the app language.
- Avoid `|`, `@`, `{` and `}` in message text unless you mean plural or placeholder syntax.
- A string computed once at module load won't change when the language changes. Compute labels inside `computed()`, render functions or templates.

## Adding a language

1. Copy `src/i18n/locales/en.json` to `src/i18n/locales/<code>.json` and translate every value. Leave placeholders such as `{name}` as they are. Use the wording a native speaker would use, not a word-for-word translation.
2. In `src/i18n/locale.ts`, add the code to `supportedLocales` and the language's own-script name to `nativeLanguageNames`. Then update `matchTag` so the right device language tags map to it.
3. In `src/i18n/index.ts`, import the new file and add it to `messages`.
4. Run `npm run i18n:check` and `npm test`. Then open the app, choose the language (Settings → General → Language), and check the long screens (Miner, Help, Settings) at a narrow width for clipped text. Add cases for the new language to `tests/i18n.test.mjs`.

## Translation checks

`npm run i18n:check` fails if any of these is true. `npm test` and CI run it too.

- A locale is missing a key that English has, or has an extra or empty key.
- A translation uses different `{placeholders}` than English.
- Code calls `t('some.key')` and the key doesn't exist.
- An English key isn't used anywhere in `src`.

`tests/i18n.test.mjs` also renders every message in every language. It covers switching, saving the choice, fallback to English and unsupported device languages.

## What isn't translated

- The public statistics page (`stats.html`) is a separate site and is English only.
- Text from the native Android layer (service notifications, miner stop reasons, raw miner output) is shown as the native code sends it.
- Pool example notes in the coin catalog are internal reference data.
