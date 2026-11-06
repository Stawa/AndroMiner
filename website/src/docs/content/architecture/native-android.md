# Native Android

Native code is in `android/app/src/main/java/com/androminer/dashboard/`. The interface reaches it through Capacitor plugins.

## Plugins

| Plugin name     | Class                      | Used from                                                                         |
| --------------- | -------------------------- | --------------------------------------------------------------------------------- |
| `NativeMiner`   | `NativeMinerPlugin`        | `useMiningController`, `useNativeMinerInfo`, `useBenchmark`, `PoolConnectionTest` |
| `DeviceStatus`  | `DeviceStatusPlugin`       | `useDeviceTelemetry`                                                              |
| `ImmersiveMode` | `ImmersiveModePlugin`      | `MiningSessionView`                                                               |
| (notifications) | `MiningNotificationPlugin` | Mining notification controls                                                      |

`NativeMinerPlugin` exposes these methods: `start`, `status`, `info`, `download`, `stop`, `pause`, `updateSafety`, `deleteHistory`, `benchmark`, `cancelBenchmark` and `testPool`. It also declares the `notifications` permission alias for `POST_NOTIFICATIONS`.

## Runtime

| Class                 | Role                                                                      |
| --------------------- | ------------------------------------------------------------------------- |
| `NativeMiningRuntime` | Single runtime that survives bridge recreation; serialises start and stop |
| `MiningGuardService`  | Foreground service; checks the device every 2 seconds                     |
| `OwnedMinerProcess`   | Launches and supervises the miner process                                 |
| `ProtectionEngine`    | Maps readings and your limits to Normal, Caution, Throttled, Critical     |
| `MinerThrottle`       | Pauses and resumes the process to reduce intensity                        |
| `SessionJournal`      | SQLite store of runs and events                                           |
| `SessionClock`        | Monotonic time for durations and deadlines                                |
| `CrashRestartPolicy`  | Decides when to offer or perform a restart                                |
| `PoolProbe`           | DNS, TCP and TLS reachability test                                        |
| `MinerBenchmark`      | Offline benchmark with the installed engine                               |
| `MinerIntegrity`      | Verifies downloaded miner files against embedded hashes                   |

## Adding a plugin method

1. Add a `@PluginMethod` to the plugin class and resolve or reject the `PluginCall`.
2. Add the method to the TypeScript interface next to the `registerPlugin` call that uses it.
3. Call it from a composable, not directly from a component.
4. Add an instrumented or unit test under `android/app/src/androidTest` or `src/test`.

## Checks

```bash
android/gradlew -p android :app:testDebugUnitTest :app:lintDebug spotlessCheck
```

Format Kotlin and Java with Spotless (`scripts/format-android.ps1` is available in the repository). Real device behaviour such as Doze, screen-off protection and manufacturer restrictions is not covered by these checks.
