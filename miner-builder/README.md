# Android miner builder

Builds the CPU-only XMRig executable used by AndroMiner. The default target is
`arm64-v8a`, Android API 29, with TLS enabled.

The app can download prebuilt miners from the
[`miner-builder` branch](https://github.com/Stawa/AndroMiner/tree/miner-builder).
Build locally when you need a different XMRig version or build configuration.

The downloader now uses an immutable revision and SHA-256 pins embedded in
`MinerIntegrity.java`, rather than executing the current mutable branch head.
Publishing a new binary does not automatically authorize existing APKs to run it.
Review the binary's source/version, independently verify both variant hashes, and
update the APK pins when approving a new engine. APK signing authenticates those pins;
this is not a replacement for reproducible builds or signed build provenance.

## Requirements

- Android SDK and NDK, Git, CMake, and Ninja. The Bash builder also requires pkg-config.
- TLS builds also need `make` and a full Perl installation. On Windows, use MSYS2
  Perl; Git for Windows Perl and Strawberry Perl are not supported by this TLS build.

Set `ANDROID_HOME` or `ANDROID_SDK_ROOT` to the SDK directory. The scripts detect
an installed NDK, or you can select one with `ANDROID_NDK_HOME`.

## Build

Run from the repository root.

Windows:

```powershell
.\miner-builder\build-xmrig-android.ps1
```

Linux or WSL, using a Linux SDK/NDK:

```bash
bash miner-builder/build-xmrig-android.sh
```

| Option                                         | PowerShell         | Bash environment  |
| ---------------------------------------------- | ------------------ | ----------------- |
| Disable TLS                                    | `-NoTls`           | `WITH_TLS=OFF`    |
| Build without copying into the Android project | `-SkipInstall`     | `SKIP_INSTALL=1`  |
| Show compiler output                           | `-ShowBuildOutput` | `QUIET=OFF`       |
| Limit parallel build jobs                      | `-Jobs 4`          | `JOBS=4`          |
| Select an XMRig tag or branch                  | `-XmrigRef <ref>`  | `XMRIG_REF=<ref>` |

The Bash builder pins XMRig to `v6.26.0` (the PowerShell builder defaults to `master`);
libuv defaults to `v1.48.0`, and OpenSSL to
`openssl-4.0.0`. TLS builds link OpenSSL statically. A no-TLS binary cannot connect
to encrypted pools.

CI uses Ubuntu 24.04, NDK `27.2.12479018`, `arm64-v8a`, and API 29 for both miners.
Native build directories and dependency installation prefixes are rebuilt rather
than cached. Only the release job's Gradle dependencies are cached.

## Output

By default, the builder copies the executable to:

```text
android/app/src/main/jniLibs/arm64-v8a/libxmrig.so
```

AndroMiner runs this file as a separate process. The `.so` name lets Android
package it as a native library. TLS and no-TLS builds write to the same destination,
so the last installed build determines which variant the APK contains.

With `-SkipInstall` or `SKIP_INSTALL=1`, the executable stays under
`miner-builder/work/build/xmrig-arm64-v8a/`; the script prints its exact path.
Treat `work/` as generated: rebuilds reset its source checkouts.

## Bundle in an APK

From the repository root:

```powershell
npm run android:sync
.\android\gradlew.bat -p android assembleDebug -PbundleMiner=true
```

Direct Gradle builds require `-PbundleMiner=true` to include the miner. The
PowerShell release helper, `.\scripts\build-release-apk.ps1`, bundles it by
default and requires release signing credentials; see the [project README](../README.md).

## Build failures

The Bash builder saves logs in `miner-builder/work/logs/<ABI>-<ON|OFF>/`;
the PowerShell builder uses `miner-builder/work/logs/`. Quiet builds print the last
120 lines when a build step fails. Use `-ShowBuildOutput` or `QUIET=OFF` to stream output.

The Bash builder restricts pkg-config to the Android dependency prefixes. CMake's
`FindOpenSSL` otherwise reads host `openssl.pc` metadata even when Android archives
are supplied explicitly. This can add Ubuntu-only static dependencies such as
`libjitterentropy.a` and `libzstd` to the Android link command.

OpenSSL is configured with `no-jitter no-zstd` and `--with-rand-seed=os`.
Android's OS entropy seeds the random generator; TLS, certificate verification,
and the default cryptographic algorithms remain available. The builder records
OpenSSL configuration, static dependency flags, and Ninja commands, then uses the
NDK's LLVM tools to check the executable's architecture, Android loader, runtime
dependencies, and TLS symbols before copying it into the app. Both CI workflows
upload these diagnostics on failure.

If Windows blocks the final copy, rerun with `-SkipInstall` to keep the build
separate from the Android project. Check the antivirus detection and confirm
`android/app/src/main/jniLibs/arm64-v8a/libxmrig.so` exists before bundling an APK.

XMRig is distributed under GPLv3.
