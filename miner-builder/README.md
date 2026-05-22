# AndroMiner XMRig Builder

Simple helper scripts for building XMRig for Android and copying it into the app as:

```text
android/app/src/main/jniLibs/arm64-v8a/libxmrig.so
```

The `.so` name is intentional. The app launches this packaged file as the native miner process.

## Current Build

| Item    | Value                        |
| ------- | ---------------------------- |
| ABI     | `arm64-v8a`                  |
| XMRig   | `v6.26.0` from `xmrig/xmrig` |
| libuv   | `v1.48.0`                    |
| OpenSSL | `openssl-3.3.2`              |
| TLS     | Enabled by default           |
| hwloc   | Disabled                     |
| GPU     | Disabled                     |

This builder now targets TLS-enabled XMRig, so encrypted pool protocols like `stratum+ssl` and `stratum+tls` can work after the miner is rebuilt.

## Requirements

- Android Studio with SDK, NDK, and CMake
- Git
- CMake / Ninja
- Unix-like Perl, such as MSYS2 Perl or WSL/Ubuntu Perl
- PowerShell on Windows, or Bash on Linux/WSL

Git for Windows Perl is too small for OpenSSL, and Strawberry Perl is `MSWin32`, which OpenSSL rejects for Android targets. Use MSYS2 Perl or WSL/Ubuntu Perl for TLS builds.

## Build On Windows

From the repository root:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\miner-builder\build-xmrig-android.ps1
```

To intentionally build without TLS:

```powershell
.\miner-builder\build-xmrig-android.ps1 -NoTls
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

To intentionally build without TLS:

```bash
WITH_TLS=OFF bash miner-builder/build-xmrig-android.sh
```

## Verify

The APK should contain:

```text
lib/arm64-v8a/libxmrig.so
```

In the Android app, the Mining setup screen should show `Native miner ready`.

## Notes

- Official XMRig does not publish Android binaries, so this compiles from source.
- OpenSSL is statically linked into the miner binary; no separate OpenSSL `.so` file should be required in the APK.
- XMRig is GPLv3. If you distribute an APK with XMRig bundled, follow GPLv3 license and source availability requirements.
