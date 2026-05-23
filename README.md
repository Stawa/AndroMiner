# AndroMiner

AndroMiner is a crypto mining app dedicated exclusively to Android from scratch, using Vue 3, TypeScript, Vite, Tailwind CSS, and Capacitor + Android (native) miner bridge. Made for real pool mining — full cross-platform frontend integrated with native Android to connect directly to a XMRig-compatible miner process. The features include device capability checking, reusable mining profiles, foreground notifications, live miner telemetry and a bundled native miner backend.

> [!CAUTION]
> Use this project at your own risk. Mining workloads can generate sustained CPU usage, increased power consumption, thermal stress, and accelerated battery wear.
>
> The maintainers are not responsible for device damage, data loss, instability, or issues caused by installation, use, modified builds, or third-party distributions.
>
> While the application has been tested on the maintainer's personal devices, results may vary across hardware, Android versions, and custom builds.

> [!TIP]
> For maximum transparency and safety, clone the repository and build the application yourself rather than relying on prebuilt binaries.

## Project Requirements

| Requirement                | Version / Notes                |
| -------------------------- | ------------------------------ |
| Node.js                    | 22+                            |
| npm                        | 10+                            |
| JDK                        | 21+                            |
| Android Studio / SDK tools | Required for Android builds    |
| Android SDK Platform       | 35                             |
| Gradle                     | Wrapper included in `android/` |

## Device Requirements

| Requirement     | Minimum           | Recommended          |
| --------------- | ----------------- | -------------------- |
| Android version | 6.0+              | 10+                  |
| Architecture    | ARM64             | ARM64                |
| CPU             | 4 threads         | 4+ threads           |
| RAM             | 2 GB              | 4 GB                 |
| Power           | Battery supported | Plugged-in preferred |
| Thermal state   | Safe temperature  | Stable/cool device   |
| Internet        | Required          | Stable connection    |

AndroMiner currently packages and supports only the `arm64-v8a` Android ABI. 32-bit Android devices are not supported by the app as shipped.

> [!NOTE]
> Official XMRig releases do not ship Android binaries. AndroMiner handles this by building XMRig from source and packaging it into the APK as `libxmrig.so`; GitHub release builds include this bundled miner automatically.

## Actual Mining Backend

AndroMiner does not simulate mining. The Android app launches a packaged ARM64 XMRig binary through a native Capacitor plugin.

The bundled miner is built from source with [`miner-builder/`](miner-builder/) and packaged as:

```text
android/app/src/main/jniLibs/arm64-v8a/libxmrig.so
```

Current bundled miner:

| Component               | Version / source                                     |
| ----------------------- | ---------------------------------------------------- |
| XMRig                   | `v6.26.0` from `xmrig/xmrig`                         |
| Commit                  | `b2ca72480c58d197e18c885d9fc1a0c8d517e60a`           |
| libuv                   | `v1.48.0`                                            |
| OpenSSL builder target  | `openssl-3.3.2`                                      |
| ABI                     | `arm64-v8a`                                          |
| Output                  | `android/app/src/main/jniLibs/arm64-v8a/libxmrig.so` |
| Current packaged binary | OpenSSL/TLS-enabled ARM64 XMRig                      |

For published GitHub releases, the workflow in [`.github/workflows/release-build.yml`](.github/workflows/release-build.yml) builds the native miner first, then packages release APKs with the miner already included. Local builds can use the same helper scripts.

Runtime flow:

1. The app finds `libxmrig.so` inside the APK's native library directory.
2. The native `NativeMiner` plugin starts XMRig as a local Android process.
3. Pool, wallet, CPU, donation, and TLS settings are converted into XMRig command-line flags.
4. XMRig's loopback HTTP API is enabled for structured JSON telemetry.
5. The UI displays API telemetry first, with stdout log parsing kept as a fallback.
6. If the app is running on the web, or if the native binary is missing, the app refuses to fake a mining session.

The app currently reads these real miner values: hashrate, accepted shares, rejected shares, active threads, uptime, pool difficulty, pool latency, per-thread rates, and recent miner logs.

Frontend settings currently wired into the native miner:

| App setting              | Native miner behavior                                                          |
| ------------------------ | ------------------------------------------------------------------------------ |
| Coin / algorithm         | Passed as the XMRig algorithm, for example `rx/0` for Monero.                  |
| Pool URL, port, protocol | Converted into the XMRig `--url` endpoint.                                     |
| Wallet, worker, password | Passed as `--user` and `--pass`; worker names are appended as `wallet.worker`. |
| Thread count             | Passed directly as `--threads=N`.                                              |
| CPU priority             | Passed as `--cpu-priority=0`, `1`, or `2`.                                     |
| Donate settings          | Passed as `--donate-level=N` and `--donate-over-proxy=N`.                      |

CPU affinity and huge pages are still UI-only/reserved settings.

To rebuild the miner binary, compile XMRig or an XMRig-compatible fork for ARM64 Android with the Android NDK and place the executable here:

| Location                                             | Use case                                                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `android/app/src/main/jniLibs/arm64-v8a/libxmrig.so` | Bundled ARM64 release builds. The Gradle config uses legacy JNI packaging so the binary can be executed. |

The app cannot safely download and execute a miner binary after install on modern Android. Apps targeting Android 10+ cannot execute files from writable app storage, and official XMRig does not publish Android binaries. For a miner that is not bundled into the APK, a Termux-based setup is more realistic than this app downloading an executable at runtime.

The helper scripts in [`miner-builder/`](miner-builder/) compile XMRig from source and install the result into `android/app/src/main/jniLibs/arm64-v8a/libxmrig.so`.

Quick build flow:

```powershell
.\miner-builder\build-xmrig-android.ps1
npm run android:sync
cd android
.\gradlew.bat assembleDebug
```

If PowerShell blocks local scripts:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

## Compatible Cryptocurrencies

AndroMiner is built for phone CPU mining, so the default catalog is intentionally small.

### Supported Coins

| Coin         | Algorithm | XMRig flag    | Why it is included                                                  |
| ------------ | --------- | ------------- | ------------------------------------------------------------------- |
| Monero (XMR) | RandomX   | `--algo=rx/0` | CPU-minable, supported by XMRig, and realistic for Android testing. |

### Possible Coins to Add

| Coin type             | Requirement                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| RandomX-family coins  | Add the coin to `src/data/miningCatalog.ts` and use an XMRig-supported algo. |
| Other XMRig CPU algos | Only add them if the bundled Android XMRig binary supports the algorithm.    |

### Incompatible Coins

| Coin                   | Reason                                                                 |
| ---------------------- | ---------------------------------------------------------------------- |
| Bitcoin (BTC)          | SHA-256 mining is ASIC-dominated; Android CPU mining is not practical. |
| Litecoin (LTC)         | Scrypt mining is ASIC-dominated; Android CPU mining is not practical.  |
| Ethereum (ETH)         | Ethereum no longer uses proof-of-work mining.                          |
| Ethereum Classic (ETC) | Requires GPU-focused Etchash mining, not this Android CPU backend.     |
| Ravencoin (RVN)        | Uses KawPow, which is GPU-focused and not targeted by this app.        |

XMRig supports more algorithms than this app exposes. A coin being supported by XMRig does not automatically mean it is a good fit for Android phones, the bundled binary, or this app's UI.

## Pool Compatibility

AndroMiner uses standard XMRig-style pool settings: pool URL, port, wallet/user, password, worker name, protocol, and thread count. Confirm a pool's current ports and payout rules on the pool website before mining.

| Pool / endpoint   | Coin paid | Example host              | Example port | Protocol      | Notes                                                                |
| ----------------- | --------- | ------------------------- | ------------ | ------------- | -------------------------------------------------------------------- |
| P2Pool local node | XMR       | Phone-accessible LAN host | `3333`       | `stratum+tcp` | Decentralized option when running Monero node and P2Pool separately. |
| SupportXMR        | XMR       | `pool.supportxmr.com`     | `3333`       | `stratum+tcp` | Centralized XMR pool with a web dashboard.                           |
| MoneroOcean       | XMR       | `gulf.moneroocean.stream` | `10032`      | `stratum+tcp` | Algo-switching pool that pays in XMR.                                |
| Nanopool          | XMR       | `xmr-eu1.nanopool.org`    | `14444`      | `stratum+tcp` | Centralized XMR pool; verify regional endpoint.                      |

> [!IMPORTANT]
> The current bundled ARM64 miner is OpenSSL/TLS-enabled. Rebuilding this binary requires MSYS2 Perl or WSL/Ubuntu Perl; Strawberry Perl and Git for Windows Perl are not suitable for the OpenSSL Android build.

Useful references:

- [XMRig command-line options](https://xmrig.com/docs/miner/command-line-options)
- [XMRig algorithms](https://xmrig.com/docs/algorithms)
- [Monero docs: mine on P2Pool with XMRig](https://docs.getmonero.org/interacting/mining/guides/p2pool/xmrig-p2pool/)
- [SupportXMR dashboard](https://www.supportxmr.com/)
- [MoneroOcean dashboard](https://moneroocean.stream/)

## Project Status

### Core App

- [x] Vue + Capacitor frontend foundation
- [x] Device compatibility checks & onboarding flow
- [x] Mining setup and profile management UI
- [x] Statistics dashboard & session history
- [x] Light theme support
- [x] Configuration import/export

### Android Integration

- [x] Android debug APK support
- [x] Native Android miner process bridge
- [x] Foreground mining notifications
- [x] Live mining logs

### Native Miner Support

- [x] ARM64 XMRig build pipeline
- [x] Embedded XMRig binary packaging
- [x] OpenSSL/TLS-enabled miner support
- [x] OpenSSL-enabled Android XMRig builds

### Remaining

- [x] Full XMRig API & telemetry integration
- [ ] Production signing & release packaging

## App Overview

| System Check                                                                | Dashboard                                                             |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| <img src="overview/system-check.png" alt="System check screen" width="220"> | <img src="overview/dashboard.png" alt="Dashboard screen" width="220"> |

| Mining Setup                                                                | Statistics                                                              |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| <img src="overview/mining-setup.png" alt="Mining setup screen" width="220"> | <img src="overview/statistics.png" alt="Statistics screen" width="220"> |

| Live Session                                                                       |
| ---------------------------------------------------------------------------------- |
| <img src="overview/live-session.png" alt="Live mining session screen" width="220"> |

---

## License

This project is licensed under the [MIT License](LICENSE).

## Contributors

<a href="https://github.com/Stawa/AndroMiner/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Stawa/AndroMiner" />
</a>
