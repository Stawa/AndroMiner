# Localization

AndroMiner ships ten languages: English (`en`, default and fallback), Bahasa Indonesia, Simplified Chinese, Spanish, Brazilian Portuguese, Russian, Turkish, Vietnamese, Korean and Hindi. Every APK variant and the web build use the same code; nothing is downloaded.

## How it works

- Messages are in `src/i18n/locales/<locale>.json`, grouped by screen. English is the reference: every other file needs the same keys.
- `src/i18n/locale.ts` lists locales and native names and maps the device language to one of them. An unsupported language falls back to English (Traditional Chinese gets English, not Simplified).
- `src/i18n/index.ts` creates the [vue-i18n](https://vue-i18n.intlify.dev/) instance and exports `t()`, `useLanguage()`, `formatDate()`, `formatNumber()` and `formatDuration()`.
- The choice (`system` or a locale) is saved in `localStorage` as `androminer-language`. **System default** follows later device changes.

```vue
<p>{{ $t('dashboard.showing', { shown: 3, total: runs.length }) }}</p>
```

## Rules

- Use named placeholders (`{count}`), never joined strings, so languages can reorder words. Plurals: `one | other` with `$t(key, { n }, n)`.
- Don't translate technical values: wallets, pool hosts, algorithm names (`rx/0`), protocol ids, raw miner output. Pass them as placeholders.
- Node-side logic (such as `validateMiningSetup`) returns message keys; the view translates them.
- Format dates, numbers and durations with the `src/i18n` helpers, not `toLocaleString(undefined)`.
- Avoid `|`, `@`, `{` and `}` in text unless you mean plural or placeholder syntax.
- Build labels inside `computed()` or templates; a string made at module load won't follow the language.

## Adding a language

1. Copy `en.json` to `<code>.json` and translate every value in natural language, keeping placeholders.
2. Add the code to `supportedLocales`, its name to `nativeLanguageNames` and `matchTag` in `locale.ts`, and import the file into `messages` in `index.ts`.
3. Run `npm run i18n:check` and `npm test`, and check the long screens (Miner, Help, Settings) at a narrow width. Add cases to `tests/i18n.test.mjs`.

## Checks

`npm run i18n:check` (also run by `npm test` and CI) fails on a missing, extra or empty key, mismatched `{placeholders}`, a `t('key')` call with no such key, or an English key not used in `src`. `tests/i18n.test.mjs` renders every message in every language.

## Not translated

The public statistics page (English only), text from the native Android layer (notifications, stop reasons, miner output), and pool notes in the coin catalog.
