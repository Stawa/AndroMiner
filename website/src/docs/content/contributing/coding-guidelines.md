# Coding guidelines

## Formatting and linting

Prettier settings (`.prettierrc`): single quotes, semicolons, 100-column lines, 2-space indent, no trailing commas, LF line endings.

```bash
npm run format        # rewrite files
npm run format:check  # what CI runs
npm run lint          # ESLint over src, tests, server, api
npm run typecheck     # vue-tsc --noEmit
```

## Frontend conventions

- **Vue 3 with `<script setup lang="ts">`.** Declare props with `defineProps<...>()` and events with `defineEmits<{ name: [payload] }>()`.
- **Two-way inputs** use `modelValue` and `update:modelValue`, so `v-model` works.
- **Keep components presentational.** Native calls and persisted state belong in composables and stores, not components.
- **Put pure logic in `src/utils/`** so it can be tested with Node without a browser.
- **Share types in `src/types/mining.ts`** rather than redeclaring them.
- **Strings:** every app string goes through `t()` or `$t()`. Add keys to all locale files and run `npm run i18n:check`.
- **Accessibility:** controls need accessible names, sheets use `useDialogFocus`, and state must not rely on colour alone.
- **Styling:** use the `--color-app-*` tokens and existing classes in `src/styles/`. Do not hard-code colours.

## Public site conventions

- Tokens and base styles live in `website/src/site/site.css`; use the Tailwind utilities generated from them (`bg-surface`, `text-muted`, `text-accent-text`, `border-line`).
- Release data is read through `website/src/site/release.ts`. Never hard-code a version, size or checksum.
- Screenshots come from `overview/` and render through `PhoneFrame`. Do not edit or generate screenshots.

## Native Android conventions

- Anything that must work with the interface hidden belongs in the service, not in Vue.
- Plugin methods always resolve or reject their `PluginCall`.
- Format with Spotless; CI runs `spotlessCheck`.

## Commits

Write short imperative subjects (for example `Add session deadline to history`). Keep unrelated changes in separate commits.
