# Development setup

## Requirements

| Tool                   | Version                       | Needed for                   |
| ---------------------- | ----------------------------- | ---------------------------- |
| Node.js                | 24 (matches CI)               | Frontend, tests, public site |
| Bun                    | current                       | Installing from `bun.lock`   |
| JDK                    | 21                            | Android builds               |
| Android SDK            | platform 36                   | Android builds               |
| NDK, CMake, Ninja, Git | see `miner-builder/README.md` | Building miner binaries only |

The frontend build does not compile XMRig. You only need the NDK toolchain to rebuild the miners.

## Run the frontend

```bash
bun install --frozen-lockfile
npm run dev
```

The dev server starts on port 5173. The browser preview cannot mine; it shows the interface with no native plugins.

## Build the frontend

```bash
npm run build
```

This runs `vue-tsc --noEmit` and then `vite build` into `dist/`.

## Run the public site

The landing page, `/docs` and `/stats` are a separate build that is never bundled into the Android app.

```bash
bun run dev:site
```

This serves `/`, `/docs/...` and `/stats` on port 5174 with the same rewrites as `vercel.json`. Use `npm run build:site` and `bun run preview:site` to check the production build. Release data comes from the GitHub API; statistics need `VITE_TELEMETRY_ENDPOINT` or show their error state.

## Build the Android app

Sync the web build into the Capacitor project, then build with Gradle. From the repository root in PowerShell:

```powershell
npm run android:sync
.\android\gradlew.bat -p android assembleDebug -PbundleMiner=true -PminerVariant=tls
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`. Use `-PminerVariant=notls` for the no-TLS label. On Linux or macOS use `./android/gradlew`.

`npm run android:open` opens the project in Android Studio.

Bundled builds need a miner binary at `android/app/src/main/jniLibs/<abi>/`. Build it with `miner-builder/build-xmrig-android.sh` or `miner-builder/build-all-engines.sh`; see [Mining engine](/docs/architecture/mining-engine).

## Signed release APK

Set `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`, then:

```powershell
npm run android:sync
.\android\gradlew.bat -p android clean assembleRelease -PbundleMiner=true -PminerVariant=tls
```

Keep the keystore private and keep using the same key for future updates.
