# Pull requests

## Before opening

Run the same checks CI runs (`.github/workflows/validation.yml`):

```bash
npm run format:check
npm run lint
npm run i18n:check
npm test
npm run build
npm run build:site
```

For native changes also run:

```bash
android/gradlew -p android :app:testDebugUnitTest :app:lintDebug spotlessCheck
```

## What to include

- **What and why** in the description, not just a list of files.
- **Screenshots** for visible changes, taken from a real run, with placeholder wallets only.
- **Tests** for new logic in `src/utils`, `server/` or native code.
- **Docs**: update the matching page here or in `docs/` when behaviour changes. If you changed a component's props or emits, run `npm run docs:components` and commit the result.
- **Device notes** for anything touching protection, throttling, lifecycle or notifications: which phone and Android version you tried, or an explicit statement that it was not tried on a device.

## Review expectations

- Small, focused changes are reviewed fastest.
- A change that alters what leaves the phone needs a privacy review and updates to `website/src/legal/privacy.md`.
- CI builds the TLS, No-TLS and Download APK variants for pull requests, so a variant-specific failure will show up there.

## Merging

Maintainers merge into `main`. Releases are cut from tags and built by `.github/workflows/release-build.yml`, which attaches the APKs, `SHA256SUMS` and checksums in the release notes.
