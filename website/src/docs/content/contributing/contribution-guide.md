# Contribution guide

AndroMiner is MIT-licensed application code that drives GPL-3.0 miners. Contributions to the app, the public site, the statistics service and the documentation are welcome.

## Before you start

1. Read the [introduction](/docs/getting-started/introduction) and [architecture](/docs/architecture/application-architecture).
2. Set up the [development environment](/docs/getting-started/development-setup).
3. Look through [open issues](https://github.com/Stawa/AndroMiner/issues). For anything larger than a small fix, open an issue first so the approach can be agreed.

## Ground rules

- Phones overheat. Changes to protection, throttling or session limits need extra care and a clear note on what was and was not tested on a device.
- Never present an unmeasured value as measured. Missing readings stay "not reported".
- Do not add telemetry fields without updating `docs/privacy.md` and `docs/statistics.md`.
- Do not claim a feature in the UI or on this site unless it is implemented.

## Workflow

```bash
git clone https://github.com/Stawa/AndroMiner.git
cd AndroMiner
bun install --frozen-lockfile
git switch -c my-change
# edit, then run the checks in the Testing page
```

Open a pull request against `main`. See [Pull requests](/docs/contributing/pull-requests).

## Reporting a bug

Open an issue at [github.com/Stawa/AndroMiner/issues](https://github.com/Stawa/AndroMiner/issues) with:

- App version and APK variant (TLS, No-TLS or Download), from **About**.
- Phone model, Android version and the installed engine shown in **About → Installed mining engine**.
- What you expected, what happened, and the steps to reproduce it.
- For connection problems, the pool test report. It excludes identifiers and raw logs.
- For heat or battery problems, the protection events from the run in History.

Do not paste wallet addresses, pool credentials or exported configuration files.

## Documentation

This site's pages live in `website/src/docs/content/` as Markdown, with navigation in `website/src/docs/nav.ts`. Component pages are generated; see [Components](/docs/components/overview).
