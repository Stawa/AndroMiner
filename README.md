# AndroMiner

AndroMiner is a current cryptocurrencies mining software design for Android that was created using Vue 3, TypeScript, Vite, Tailwind CSS, and Capacitor. Inspired by Material Design 3, Verus Mobile Miner, Android system monitoring apps, and useful mining configuration routines, the project focuses on a refined mobile experience.

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
> Mining is not implemented yet. The app currently uses simulated telemetry while the native backend is still in development.

## Project Status

- [x] Frontend Vue + Capacitor
- [x] System requirements checks and the onboarding procedure
- [x] UI for mining setup, profiles, statistics, and session history
- [x] Support for Android debug APK builds
- [ ] Light theme support
- [ ] Integration of native mining backends
- [ ] Real-time pool telemetry and reporting
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
