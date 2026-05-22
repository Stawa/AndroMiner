# AndroMiner

AndroMiner is an Android-focused cryptocurrency mining app built with Vue 3, TypeScript, Vite, Tailwind CSS, Capacitor, and a native Android miner bridge. The app is designed around real pool mining, Android device safety, reusable mining profiles, foreground status notifications, and direct control of an XMRig-compatible native miner process.

## Project Requirements

| Requirement                | Version / Notes                |
| -------------------------- | ------------------------------ |
| Node.js                    | 20+                            |
| npm                        | 10+                            |
| JDK                        | 17+                            |
| Android Studio / SDK tools | Required for Android builds    |
| Android SDK Platform       | 35                             |
| Gradle                     | Wrapper included in `android/` |

## Device Requirements

| Requirement     | Minimum           | Recommended          |
| --------------- | ----------------- | -------------------- |
| Android version | 6.0+              | 10+                  |
| Architecture    | -                 | ARM64                |
| CPU             | 4 threads         | 4+ threads           |
| RAM             | 2 GB              | 4 GB                 |
| Power           | Battery supported | Plugged-in preferred |
| Thermal state   | Safe temperature  | Stable/cool device   |
| Internet        | Required          | Stable connection    |

> [!NOTE]
> Official XMRig releases do not ship Android binaries. Real mining starts only when you build an Android-compatible miner from source and package it with the APK as `libxmrig.so`.

## Actual Mining Backend

The Android app registers a native `NativeMiner` Capacitor plugin that:

- Finds a packaged XMRig-compatible Android binary from the app native library directory as `libxmrig.so`.
- Starts the miner with real pool arguments: `--algo`, `--url`, `--user`, `--pass`, `--threads`, `--tls` when required, and `--print-time=5`.
- Reads miner stdout and updates real hashrate, accepted shares, rejected shares, active thread count, and uptime.
- Refuses to fake a mining session on the web build or when the native binary is missing.

To package a miner binary, compile XMRig or an XMRig-compatible fork for the target Android ABI with the Android NDK and place the executable here:

| Location                                               | Use case                                                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `android/app/src/main/jniLibs/arm64-v8a/libxmrig.so`   | Bundled ARM64 release builds. The Gradle config uses legacy JNI packaging so the binary can be executed. |
| `android/app/src/main/jniLibs/armeabi-v7a/libxmrig.so` | Optional 32-bit ARM builds if you intentionally support older devices.                                   |

The app cannot safely download and execute a miner binary after install on modern Android. Apps targeting Android 10+ cannot execute files from writable app storage, and official XMRig does not publish Android binaries anyway. If you want a user-installable miner without bundling native code, the realistic route is a separate Termux-based setup rather than this APK launching a downloaded executable.

## Compatible Cryptocurrencies

The in-app catalog intentionally ships with only realistic Android CPU mining targets.

| Status        | Coin                   | Algorithm        | Miner backend              | Notes                                                                  |
| ------------- | ---------------------- | ---------------- | -------------------------- | ---------------------------------------------------------------------- |
| Supported     | Monero (XMR)           | RandomX          | XMRig `rx/0`               | Primary supported coin and default profile.                            |
| Extendable    | RandomX-family coins   | RandomX variants | XMRig-supported algorithms | Add a catalog entry and make sure the bundled miner supports the algo. |
| Not supported | Bitcoin (BTC)          | SHA-256          | ASIC only                  | Android CPU mining is not practical.                                   |
| Not supported | Litecoin (LTC)         | Scrypt           | ASIC only                  | Android CPU mining is not practical.                                   |
| Not supported | Ethereum (ETH)         | -                | -                          | Ethereum no longer uses proof-of-work mining.                          |
| Not supported | Ethereum Classic (ETC) | Etchash          | GPU miner                  | Not targeted by the current Android CPU backend.                       |
| Not supported | Ravencoin (RVN)        | KawPow           | GPU-focused                | Not targeted by the current Android CPU backend.                       |

XMRig documents itself as a RandomX, KawPow, CryptoNight, and GhostRider CPU/GPU miner, but this app only enables coins that make sense for phone CPU mining by default.

## Pool Compatibility

AndroMiner uses standard XMRig-style pool settings: pool URL, port, wallet/user, password, worker name, protocol, and thread count. Confirm a pool's current ports and payout rules on the pool website before mining.

| Pool / endpoint   | Coin paid | Example host              | Example port | Protocol      | Notes                                                                |
| ----------------- | --------- | ------------------------- | ------------ | ------------- | -------------------------------------------------------------------- |
| P2Pool local node | XMR       | `127.0.0.1`               | `3333`       | `stratum+tcp` | Decentralized option when running Monero node and P2Pool separately. |
| SupportXMR        | XMR       | `pool.supportxmr.com`     | `3333`       | `stratum+tcp` | Centralized XMR pool with a web dashboard.                           |
| MoneroOcean       | XMR       | `gulf.moneroocean.stream` | `10032`      | `stratum+tcp` | Algo-switching pool that pays in XMR.                                |
| Nanopool          | XMR       | `xmr-eu1.nanopool.org`    | `14444`      | `stratum+tcp` | Centralized XMR pool; verify regional endpoint.                      |

Useful references:

- [XMRig command-line options](https://xmrig.com/docs/miner/command-line-options)
- [XMRig algorithms](https://xmrig.com/docs/algorithms)
- [Monero docs: mine on P2Pool with XMRig](https://docs.getmonero.org/interacting/mining/guides/p2pool/xmrig-p2pool/)
- [SupportXMR dashboard](https://www.supportxmr.com/)
- [MoneroOcean dashboard](https://moneroocean.stream/)

## Project Status

- [x] Frontend Vue + Capacitor
- [x] System requirements checks and the onboarding procedure
- [x] UI for mining setup, profiles, statistics, and session history
- [x] Support for Android debug APK builds
- [x] Native Android process bridge for XMRig-compatible miners
- [ ] Light theme support
- [ ] Bundle prebuilt miner binaries per Android ABI
- [ ] Full XMRig JSON/API telemetry support
- [ ] Signing production builds and packaging releases

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
