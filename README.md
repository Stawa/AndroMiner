# AndroMiner

AndroMiner is an Android crypto mining app built with Vue 3, TypeScript, Vite, Tailwind CSS, Capacitor, and a native Android miner bridge. Designed for real Android mining with a native ARM64 XMRig-compatible backend, live telemetry, and direct miner process integration.

> [!CAUTION]
> Mining keeps the CPU busy for long periods. It can heat the phone, drain battery, reduce battery health, and make some devices unstable.
> The maintainers are not responsible for device damage, data loss, instability, or issues caused by installation, use, modified builds, or third-party distributions.
> **Use it at your own risk.**

> [!TIP]
> For maximum transparency and safety, clone the repository and build the app yourself rather than relying on prebuilt binaries.

## Which APK Should I Use?

GitHub releases publish three Android APKs:

| APK                             | Includes miner?   | Target SDK | Use this when                                                                |
| ------------------------------- | ----------------- | ---------- | ---------------------------------------------------------------------------- |
| `androminer-tls-<tag>.apk`      | Yes, TLS miner    | 35         | You want the recommended modern Android build with encrypted pool support.   |
| `androminer-notls-<tag>.apk`    | Yes, no-TLS miner | 35         | You only need plain TCP pool connections.                                    |
| `androminer-download-<tag>.apk` | No                | 28         | You want the app to ask before downloading TLS or no-TLS miner on first run. |

The downloader APK targets SDK 28 because Android blocks target SDK 29+ apps from executing downloaded app-private binaries. The bundled TLS and no-TLS APKs target SDK 35 and avoid that runtime download limitation.

## Device Requirements

| Requirement        | Minimum               | Recommended         |
| ------------------ | --------------------- | ------------------- |
| Android OS install | Android 6.0+ / API 23 | Android 10+         |
| Architecture       | ARM64 / `arm64-v8a`   | ARM64 / `arm64-v8a` |
| CPU                | 4 threads             | 4+ threads          |
| RAM                | 2 GB                  | 4 GB+               |
| Power              | Battery supported     | Plugged in          |
| Internet           | Required              | Stable connection   |

> [!NOTE]
> 32-bit Android devices are not supported. I don't have access to a 32-bit device for testing, and XMRig's Android support focuses on ARM64. Pull requests to add 32-bit support are welcome, but it is not a priority for this project.

## Miner Download And Safety

Official XMRig releases do not ship Android binaries. AndroMiner builds XMRig from source in this repo and publishes TLS and no-TLS `libxmrig.so` files to the [`miner-builder`](https://github.com/Stawa/AndroMiner/tree/miner-builder) branch.

If you use the downloader APK, the app asks before downloading or running the miner for the first time. You choose TLS or no-TLS in the app.

> [!NOTE]
> VirusTotal and antivirus products may flag XMRig or APKs that include it as malware, trojan, or cryptocurrency miner software. That is common for miner binaries. AndroMiner is open source, the miner download requires user consent, and the app is intended to mine only to the wallet and pool settings you enter.

## Build Locally

> [!IMPORTANT]
> If you want to build the app yourself, you must also build the miner locally. Windows are sensitive with miner binaries, I suggest to turn off Windows Defender real-time or add an exclusion for the `android/` and `miner-builder/` directories while building and testing.

### Requirements

| Tool                       | Version / Notes                |
| -------------------------- | ------------------------------ |
| Node.js                    | 22+                            |
| npm                        | 10+                            |
| JDK                        | 21+                            |
| Android Studio / SDK tools | Required                       |
| Android SDK Platform       | 35                             |
| Gradle                     | Wrapper included in `android/` |

Build the web app and Android debug APK:

```powershell
npm install
npm run android:sync
cd android
.\gradlew.bat assembleDebug
```

Build with a locally bundled miner:

```powershell
.\miner-builder\build-xmrig-android.ps1
npm run android:sync
cd android
.\gradlew.bat assembleDebug -PbundleMiner=true
```

Build the downloader release variant:

```powershell
cd android
.\gradlew.bat assembleRelease -PtargetSdkVersionOverride=28
```

More build details are in [docs/TECHNICAL.md](docs/TECHNICAL.md) and [miner-builder/README.md](miner-builder/README.md).

## Supported Mining

AndroMiner is focused on phone CPU mining. The default catalog is intentionally small:

| Coin         | Algorithm        | Notes                               |
| ------------ | ---------------- | ----------------------------------- |
| Monero (XMR) | RandomX / `rx/0` | CPU-minable and supported by XMRig. |

Bitcoin, Litecoin, Ethereum Classic, Ravencoin, and other GPU/ASIC-focused coins are not practical targets for this Android CPU miner.

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

## More Documentation

- [Technical notes](docs/TECHNICAL.md)
- [Miner builder](miner-builder/README.md)
- [XMRig command-line options](https://xmrig.com/docs/miner/command-line-options)
- [XMRig algorithms](https://xmrig.com/docs/algorithms)

## License

This project is licensed under the [MIT License](LICENSE).

## Contributors

<a href="https://github.com/Stawa/AndroMiner/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Stawa/AndroMiner" />
</a>
