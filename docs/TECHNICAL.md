# AndroMiner Technical Guide

This guide explains the project details that are easy to confuse: which APK to use, why some builds target different Android SDK versions, how the miner is downloaded or bundled, and how to build the app locally.

It is written for GitHub users who want the practical answer first. Deeper implementation details are near the bottom.

## Quick Answers

- **Most users should use `androminer-tls-<tag>.apk`.**
  It includes the miner, supports encrypted pool connections, and targets SDK 35.

- **Use `androminer-notls-<tag>.apk` only if you need plain TCP pools.**
  It also includes the miner and targets SDK 35.

- **Use `androminer-download-<tag>.apk` if you want the app to ask before downloading the miner.**
  This APK does not include `libxmrig.so`. It targets SDK 28 so it can run the downloaded miner after user consent.

- **Android 6 support does not mean target SDK 28.**
  Android 6 support comes from `minSdkVersion 23`. Target SDK controls Android behavior rules.

- **Antivirus warnings are expected.**
  XMRig is mining software, so VirusTotal, Windows Defender, and other antivirus tools may flag it.

## Which Version Should I Use?

Use this order:

1. Choose `androminer-tls-<tag>.apk` for the normal recommended build.
2. Choose `androminer-notls-<tag>.apk` if your pool only needs plain TCP and you do not want TLS support.
3. Choose `androminer-download-<tag>.apk` if you specifically want the miner to be downloaded only after the first-run warning.

Release APK summary:

| APK                             | Miner                | Target SDK |
| ------------------------------- | -------------------- | ---------- |
| `androminer-tls-<tag>.apk`      | Bundled TLS miner    | 35         |
| `androminer-notls-<tag>.apk`    | Bundled no-TLS miner | 35         |
| `androminer-download-<tag>.apk` | No bundled miner     | 28         |

> [!NOTE]
> Bundled means the miner binary is inside the APK. Downloaded means the APK starts without the miner and asks before downloading it.

## Why Are There Different SDK Versions?

Android has two SDK concepts that sound similar but do different things.

- `minSdkVersion` is the oldest Android version that can install the app.
- `targetSdkVersion` controls which Android behavior rules the app must follow.

Current values:

- `minSdkVersion = 23`, so the app can install on Android 6.0+.
- normal builds target SDK 35.
- the downloader release uses target SDK 28.

The downloader APK needs target SDK 28 because Android blocks target SDK 29+ apps from executing binaries downloaded into writable app-private storage.

Bundled miner APKs do not need that workaround because the miner is packaged with the app.

## How The Miner Works

AndroMiner does not fake mining. It runs an ARM64 XMRig-compatible binary from the Android app.

Runtime flow:

1. The app checks whether `libxmrig.so` already exists.
2. If the miner is missing, the downloader APK shows a warning first.
3. The user chooses TLS or no-TLS.
4. The app downloads the selected miner from the `miner-builder` branch.
5. The native Android plugin starts the miner process.
6. The app passes pool, wallet, worker, protocol, donation, and thread settings to XMRig.
7. The UI reads live miner telemetry from XMRig's local HTTP API.

Supported ABI:

```text
arm64-v8a
```

Published miner paths:

```text
lib/arm64-v8a/tls/libxmrig.so
lib/arm64-v8a/notls/libxmrig.so
```

32-bit Android devices are not supported right now.

## How To Build

Normal debug APK without bundled miner:

```powershell
npm install
npm run android:sync
cd android
.\gradlew.bat assembleDebug
```

Build miner locally, then bundle it:

```powershell
.\miner-builder\build-xmrig-android.ps1
npm run android:sync
cd android
.\gradlew.bat assembleDebug -PbundleMiner=true
```

Build release downloader APK:

```powershell
cd android
.\gradlew.bat assembleRelease -PtargetSdkVersionOverride=28
```

Build release APK with bundled miner:

```powershell
cd android
.\gradlew.bat assembleRelease -PbundleMiner=true
```

> [!IMPORTANT]
> Local builds exclude `libxmrig.so` unless you pass `-PbundleMiner=true`.

## Miner Builder Commands

PowerShell:

```powershell
.\miner-builder\build-xmrig-android.ps1
.\miner-builder\build-xmrig-android.ps1 -NoTls
.\miner-builder\build-xmrig-android.ps1 -SkipInstall
.\miner-builder\build-xmrig-android.ps1 -ShowBuildOutput
```

Bash / WSL:

```bash
bash miner-builder/build-xmrig-android.sh
WITH_TLS=OFF bash miner-builder/build-xmrig-android.sh
SKIP_INSTALL=1 bash miner-builder/build-xmrig-android.sh
QUIET=OFF bash miner-builder/build-xmrig-android.sh
```

If install is not skipped, the local miner is copied here:

```text
android/app/src/main/jniLibs/arm64-v8a/libxmrig.so
```

## Antivirus Notes

Miner binaries are often flagged by antivirus tools because they can be abused by malware.

You may see detections such as:

- cryptocurrency miner
- potentially unwanted software
- malware
- trojan

That does not automatically mean this project is stealing data. AndroMiner is open source, and the downloader APK asks before downloading or running the miner.

If Windows Defender blocks a local build:

- use `-SkipInstall` to build without copying the miner into the Android project
- whitelist the parent project folder only if you trust your checkout
- use the builder prompt to download the published miner from the `miner-builder` branch

## Current Native Build

The current miner build uses:

- XMRig `v6.26.0`
- libuv `v1.48.0`
- OpenSSL `openssl-4.0.0`
- ABI `arm64-v8a`

OpenSSL 4 needs a small compatibility patch for XMRig `v6.26.0`. The builder patches `TlsGen.cpp` after checkout so TLS builds compile with `openssl-4.0.0`.

## GitHub Actions

The project has two main Android workflows:

- `.github/workflows/binary-build.yml`
  Builds TLS and no-TLS `libxmrig.so` files, then publishes them to the `miner-builder` branch.

- `.github/workflows/release-build.yml`
  Builds the downloader APK, TLS bundled APK, and no-TLS bundled APK for GitHub releases.

## Pool Notes

AndroMiner uses normal XMRig-style pool settings:

- pool URL
- port
- wallet/user
- password
- worker name
- protocol
- thread count

Always check your pool website for current ports, TLS support, payout rules, and wallet format.

Useful references:

- [XMRig command-line options](https://xmrig.com/docs/miner/command-line-options)
- [XMRig algorithms](https://xmrig.com/docs/algorithms)
- [Monero P2Pool with XMRig](https://docs.getmonero.org/interacting/mining/guides/p2pool/xmrig-p2pool/)
