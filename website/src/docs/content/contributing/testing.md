# Testing

## Frontend and service tests

```bash
npm test
```

Runs `node --test tests/*.test.mjs server/tests/*.test.mjs`. Node loads the TypeScript helpers directly, so tests import from `src/utils/` and `website/src/site/` without a browser.

| Test file                         | Covers                                 |
| --------------------------------- | -------------------------------------- |
| `tests/engine-downloads.test.mjs` | Which engines can be downloaded        |
| `tests/engines.test.mjs`          | Engine registry rules                  |
| `tests/protection.test.mjs`       | Protection helpers                     |
| `tests/session-history.test.mjs`  | History merging and filters            |
| `tests/telemetry-client.test.mjs` | Statistics client                      |
| `tests/benchmark-client.test.mjs` | Benchmark payload                      |
| `tests/i18n.test.mjs`             | Locale handling                        |
| `tests/release.test.mjs`          | GitHub release and checksum parsing    |
| `server/tests/*.test.mjs`         | Statistics service and Firestore store |

## Static checks

```bash
npm run typecheck
npm run lint
npm run i18n:check
npm run format:check
```

## Browser smoke tests

`npm run test:ui` drives the app in headless Chromium or Edge with `playwright-core`. Start `npm run dev` first. Set `UI_BASE_URL` to test another address and `BROWSER_EXECUTABLE` to choose a browser binary.

## Previewing the public site

```bash
bun run dev:site          # landing page, /docs and /stats with hot reload on port 5174
npm run build:site && bun run preview:site   # production build on port 4173
```

Both use `website/vite.config.ts`, which applies the same route rewrites as `vercel.json`. Release data comes from the live GitHub API; `/stats` needs `VITE_TELEMETRY_ENDPOINT` or it shows its error state.

## Android tests

```bash
android/gradlew -p android :app:testDebugUnitTest :app:lintDebug spotlessCheck
```

Instrumented tests (`MiningGuardServiceTest`, `SessionJournalTest`) live in `android/app/src/androidTest` and need a device or emulator.

## What is not covered

Real mining lifecycle, Doze, reboot behaviour, screen-off protection and manufacturer restrictions need a physical device. Say in your pull request what you did and did not try.
