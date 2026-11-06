# Project structure

```text
AndroMiner/
├── src/                 The Android app (Vue + Capacitor). Nothing here is website code
│   ├── App.vue, main.ts App shell, entry
│   ├── views/           One file per screen (Dashboard, MiningConfig, MiningSession, ...)
│   ├── components/      Reusable UI components
│   ├── composables/     Stateful logic (useMiningController, useDeviceTelemetry, ...)
│   ├── stores/          Pinia stores: profiles.ts, settings.ts
│   ├── types/           Shared types, mining.ts
│   ├── utils/           Pure helpers (configValidation, protection, engines, ...)
│   ├── data/            Coin catalog (miningCatalog.ts)
│   ├── i18n/            vue-i18n setup and ten locale files
│   └── styles/          Global CSS imported by styles.css
├── website/             The public website: landing page, /docs and /stats
│   ├── landing.html, docs.html, stats.html   Page entries
│   ├── vite.config.ts   Site build, dev server and route rewrites
│   ├── public/          Favicon
│   └── src/
│       ├── site/        Shared tokens (site.css), header, footer, release parsing
│       ├── landing/     Home page sections
│       ├── docs/        This documentation: content/, nav.ts, generated component data
│       └── stats/       Public statistics page
├── android/             Capacitor Android project and native Java
├── miner-builder/       Scripts that build XMRig, XMRigCC and XLArig
├── server/              Statistics and benchmark service (Node)
├── api/index.mjs        Vercel entry point for the service
├── docs/                Markdown notes kept in the repository
├── tests/               Node tests and browser smoke scripts
├── overview/            Real app screenshots used by the website and README
├── assets/brand/        Logos and the social preview image
└── index.html           Android app entry
```

## Two builds, one repository

| Build       | Command              | Output          | Config                   |
| ----------- | -------------------- | --------------- | ------------------------ |
| Android app | `npm run build`      | `dist/`         | `vite.config.ts`         |
| Website     | `npm run build:site` | `website/dist/` | `website/vite.config.ts` |

`vercel.json` deploys `website/dist/` and rewrites `/`, `/stats`, `/docs` and `/docs/*` to the right entry. `/v1/*` and `/healthz` go to the statistics service in `api/index.mjs`.

## Native code

`android/app/src/main/java/com/androminer/dashboard/` holds the plugins (`NativeMinerPlugin`, `DeviceStatusPlugin`, `ImmersiveModePlugin`, `MiningNotificationPlugin`), the foreground `MiningGuardService`, `ProtectionEngine` and the session journal. See [Native Android](/docs/architecture/native-android).

## Existing documentation

The `docs/` folder in the repository holds deeper notes: `engines.md`, `device-protection.md`, `statistics.md`, `privacy.md` and `localization.md`.

## Rule of thumb

The website may import from the app's `src/utils` and read `overview/` and `assets/brand/`. The app never imports from `website/`. Changing the website cannot change the Android bundle.
