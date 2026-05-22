# AndroMiner XMRig Builder

Simple helper scripts for building XMRig for Android and copying it into the app as:

```text
android/app/src/main/jniLibs/arm64-v8a/libxmrig.so
```

The `.so` name is intentional. The app launches this packaged file as the native miner process.

## Current Build

| Item  | Value                        |
| ----- | ---------------------------- |
| ABI   | `arm64-v8a`                  |
| XMRig | `v6.26.0` from `xmrig/xmrig` |
| libuv | `v1.48.0`                    |
| TLS   | Disabled                     |
| hwloc | Disabled                     |
| GPU   | Disabled                     |

This build is for plain TCP pools, for example `pool.supportxmr.com:3333`. TLS/SSL pool ports need a future OpenSSL-enabled build.

## Requirements

- Android Studio with SDK, NDK, and CMake
- Git
- CMake / Ninja
- PowerShell on Windows, or Bash on Linux/WSL

## Build On Windows

From the repository root:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\miner-builder\build-xmrig-android.ps1
```

Then rebuild the app:

```powershell
npm run android:sync
cd android
.\gradlew.bat assembleDebug
```

## Build On Linux / WSL

```bash
bash miner-builder/build-xmrig-android.sh
npm run android:sync
cd android
./gradlew assembleDebug
```

## Verify

The APK should contain:

```text
lib/arm64-v8a/libxmrig.so
```

In the Android app, the Mining setup screen should show `Native miner ready`.

## Notes

- Official XMRig does not publish Android binaries, so this compiles from source.
- XMRig is GPLv3. If you distribute an APK with XMRig bundled, follow GPLv3 license and source availability requirements.
