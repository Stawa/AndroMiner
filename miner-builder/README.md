# AndroMiner XMRig Builder

This folder builds the Android ARM64 XMRig binary used by AndroMiner.
Most users do not need to run this manually. GitHub Actions builds the miner and publishes ready-to-download binaries to the `miner-builder` branch.

## Quick Answers

- **Default build is TLS-enabled.**
  Use this for encrypted pool protocols like `stratum+ssl` and `stratum+tls`.

- **The output file is named `libxmrig.so` on purpose.**
  Android packaging treats it like a native library, but the app runs it as the miner process.

- **Local APKs do not bundle the miner by default.**
  Pass `-PbundleMiner=true` when building the APK if you want to include the local `libxmrig.so`.

- **Windows Defender may block the miner.**
  Miner binaries are commonly flagged. Use `-SkipInstall` if you only want to verify that the native build works.

## What Gets Built?

Current native stack:

- XMRig `v6.26.0`
- libuv `v1.48.0`
- OpenSSL `openssl-4.0.0`
- ABI `arm64-v8a`
- hwloc disabled
- GPU backends disabled
- TLS enabled by default

Local install output, when install is not skipped:

```text
android/app/src/main/jniLibs/arm64-v8a/libxmrig.so
```

Published GitHub branch outputs:

```text
lib/arm64-v8a/tls/libxmrig.so
lib/arm64-v8a/notls/libxmrig.so
```

The Android app can ask the user which branch payload to download on first run.

## Requirements

Install these before building locally:

- Android Studio with SDK, NDK, and CMake
- Git
- CMake and Ninja
- PowerShell on Windows, or Bash on Linux/WSL
- MSYS2 Perl or WSL/Ubuntu Perl for TLS builds

> [!IMPORTANT]
> Git for Windows Perl is too small for OpenSSL, and Strawberry Perl is rejected by OpenSSL's Android target. Use MSYS2 Perl or WSL/Ubuntu Perl for TLS builds.

## Build On Windows

Run from the repository root:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\miner-builder\build-xmrig-android.ps1
```

Build without TLS:

```powershell
.\miner-builder\build-xmrig-android.ps1 -NoTls
```

Build without copying the miner into the Android project:

```powershell
.\miner-builder\build-xmrig-android.ps1 -SkipInstall
```

Show full compiler output:

```powershell
.\miner-builder\build-xmrig-android.ps1 -ShowBuildOutput
```

## Build On Linux / WSL

Run from the repository root:

```bash
bash miner-builder/build-xmrig-android.sh
```

Build without TLS:

```bash
WITH_TLS=OFF bash miner-builder/build-xmrig-android.sh
```

Build without copying the miner into the Android project:

```bash
SKIP_INSTALL=1 bash miner-builder/build-xmrig-android.sh
```

Show full compiler output:

```bash
QUIET=OFF bash miner-builder/build-xmrig-android.sh
```

or:

```bash
VERBOSE=1 bash miner-builder/build-xmrig-android.sh
```

## Build The App With The Local Miner

After building the miner, sync and build Android:

```powershell
npm run android:sync
cd android
.\gradlew.bat assembleDebug -PbundleMiner=true
```

For a local release APK with the bundled miner:

```powershell
cd android
.\gradlew.bat assembleRelease -PbundleMiner=true
```

> [!NOTE]
> Without `-PbundleMiner=true`, Gradle excludes `libxmrig.so` from the APK.

## Logs And Troubleshooting

The builder is quiet by default. It shows high-level progress and writes detailed logs to:

```text
miner-builder/work/logs/
```

If a build step fails, the script prints the last 120 lines from the matching log file.

### Windows Defender

Windows Defender may flag local miner binaries as potentially unwanted software.

If the final copy step is blocked, the PowerShell builder can:

- continue without installing the local artifact
- download the published TLS or no-TLS miner from the `miner-builder` branch
- exit cleanly

If you insist on building locally, whitelist the parent project folder only if you trust your checkout.

## Notes

- Official XMRig releases do not publish Android binaries, so this builder compiles from source.
- OpenSSL is statically linked into the miner binary; no separate OpenSSL `.so` file should be needed in the APK.
- OpenSSL 4 needs a small XMRig compatibility patch. The builder patches `TlsGen.cpp` after checkout.
- XMRig is GPLv3. If you distribute the miner binary, follow GPLv3 license and source availability requirements.
