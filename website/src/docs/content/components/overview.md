# Components overview

AndroMiner has 38 reusable Vue components in `src/components/`. The pages in this section document each one: purpose, source file, props, events, slots, states, dependencies, styling and a usage skeleton.

The technical details are generated from the source by `npm run docs:components` (`website/src/docs/build-component-docs.mjs`), so props, events and slots match the code. Purpose and notes are hand-written in `website/src/docs/componentNotes.ts`.

## Categories

| Page                                                       | Contents                                            |
| ---------------------------------------------------------- | --------------------------------------------------- |
| [Primitives](/docs/components/primitives)                  | Icons and logo                                      |
| [Buttons and controls](/docs/components/buttons)           | Session controls, profile chips, saved setups       |
| [Cards](/docs/components/cards)                            | Surfaces for settings, engines, protection, history |
| [Dialogs and sheets](/docs/components/dialogs)             | Confirmation and warning sheets, crash prompt       |
| [Navigation](/docs/components/navigation)                  | Header, drawer, bottom tabs                         |
| [Settings and form controls](/docs/components/settings)    | Inputs, selects, toggles, sliders                   |
| [Charts and metrics](/docs/components/charts)              | Hashrate ring, sparkline, metric chart              |
| [Notifications and status](/docs/components/notifications) | Update banner and status indicator                  |

## Conventions that apply to every component

- Components use `<script setup lang="ts">` with type-only `defineProps` and `defineEmits`.
- Two-way components follow the `modelValue` / `update:modelValue` convention, so `v-model` works.
- Components do not call native code directly, with a few exceptions noted on their pages (for example `PoolConnectionTest`).
- Styling uses global classes from `src/styles/` and the `--color-app-*` tokens. Few components have scoped styles.
- User-visible text goes through `vue-i18n`. Components that import `../i18n` or use `$t` are marked "Uses i18n".

## What does not exist

- There is **no generic Button, Dialog, Modal or Tabs component.** Buttons are `<button>` elements with global classes; sheets are individual components built on `useDialogFocus`.
- Native Android notifications are not Vue components. See [Native Android](/docs/architecture/native-android).

## Reading a component page

Each entry lists the **props** with their TypeScript types, defaults and whether they are required, the **events** it emits with their payloads, its **slots**, and the **source** file. "Variants and states" appear when a prop is a string union such as `tone`. "Usage" is a skeleton built from the required props; replace the placeholder bindings with your own values.

## Adding or changing a component

1. Create or edit `src/components/Name.vue` and type its props and emits.
2. Add an entry to `website/src/docs/componentNotes.ts` with a category and a purpose.
3. Run `npm run docs:components` and commit `website/src/docs/components.generated.json`.
