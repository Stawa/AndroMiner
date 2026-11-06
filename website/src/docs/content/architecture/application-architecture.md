# Application architecture

AndroMiner is a Vue 3 interface inside a Capacitor WebView. Anything that must keep working when the interface is hidden lives in native Android code.

```text
Vue views ── composables ──► Capacitor plugin "NativeMiner" ──► NativeMiningRuntime
   │              │                                                   │
   │              └─ Pinia stores, localStorage                       ├─ MiningGuardService (foreground)
   └─ components                                                      ├─ owned miner process (XMRig-compatible)
                                                                      ├─ ProtectionEngine (every 2 s)
                                                                      └─ SessionJournal (SQLite)
```

## Frontend layers

| Layer          | Responsibility                                                                          | Example                                |
| -------------- | --------------------------------------------------------------------------------------- | -------------------------------------- |
| `views/`       | One screen each; composes components and reads composables                              | `MiningSessionView.vue`                |
| `components/`  | Presentational pieces with props and emits; see [Components](/docs/components/overview) | `StatCard.vue`                         |
| `composables/` | Shared stateful logic and native calls                                                  | `useMiningController.ts`               |
| `stores/`      | Persisted Pinia state for saved setups and settings                                     | `profiles.ts`, `settings.ts`           |
| `utils/`       | Pure functions with unit tests                                                          | `configValidation.ts`, `protection.ts` |
| `types/`       | Types shared across layers                                                              | `mining.ts`                            |

`useMiningController` is the main bridge: it registers the `NativeMiner` plugin, starts and stops sessions, polls status and records session history. `useDeviceTelemetry` registers `DeviceStatus` for temperature and battery readings.

## Native boundary

The WebView is not trusted to keep the miner safe. The foreground service checks the device every two seconds and enforces protection and session deadlines without the interface. When the interface reopens it reconnects to the native run and reconciles history. Removing the app from recents ends the run.

## Styling

Global styles are in `src/styles/*.css`, imported by `src/styles.css`, using Tailwind CSS 4 and CSS variables named `--color-app-*` for light and dark themes. Components rely on global class names rather than scoped styles; see each component's page for its root class and stylesheet.

## Internationalisation

All user-visible app strings go through `vue-i18n` (`src/i18n/`), with ten locales. `npm run i18n:check` verifies the locale files stay in step. See `docs/localization.md` in the repository.

## Public site

The landing page, documentation and statistics page are separate entries (`website/landing.html`, `website/docs.html`, `website/stats.html`) built by `website/vite.config.ts`. They live in `website/`, share design tokens and the header and footer from `website/src/site/` and are never part of the Android bundle.
