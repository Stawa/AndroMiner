# Device protection

The native foreground service (`MiningGuardService`) polls the device every 2 seconds while mining and runs `ProtectionEngine`. Enforcement does not depend on the WebView.

## States

| State     | Intensity (of configured) | Entered when (any)                                                                                                                                                                                                                  |
| --------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal    | 100%                      | Nothing below applies.                                                                                                                                                                                                              |
| Caution   | 75%                       | Battery temperature within 4 °C of your limit; Android thermal status Light; battery within 8 points of your stop level (on battery); CPU sensor at 75 °C.                                                                          |
| Throttled | 40%                       | Within 2 °C of your limit; Android thermal status Moderate; within 3 points of your stop level (on battery); CPU sensor at 85 °C; a required sensor is missing.                                                                     |
| Critical  | 0% (mining stops)         | Battery temperature at your limit; Android thermal status Severe or worse; battery at your stop level; CPU sensor at 95 °C; charging-only and unplugged; screen off with the screen-off policy; a required sensor missing for 20 s. |

Your temperature limit and battery stop level are the existing settings. The step offsets, hysteresis and delays are fixed constants in `ProtectionEngine`.

## Escalation and recovery

- Escalation is immediate.
- Recovery needs the reading to clear its threshold by a margin (2 °C, 3 battery points, 3 °C on a CPU sensor), then hold for 30 s. It moves back one state at a time, so 40% returns to 75% and then 100%, never straight to 100%.
- Critical is terminal for the run: mining stops and must be restarted manually, as before.

## What is measured

- **Battery temperature**: `BatteryManager`. This is the sensor your temperature limit applies to.
- **Android thermal status**: `PowerManager.getCurrentThermalStatus()` (Android 10+). Shown as "Not supported" below that.
- **CPU temperature**: shown and used only when a thermal zone whose type contains `cpu` is readable and reports 10-110 °C. Many phones block `/sys/class/thermal` for apps; then it reads "Not exposed by this phone" and is not estimated.
- **Headroom**: your limit minus battery temperature. Hidden when the limit is off or the reading is missing.
- **Freshness**: age of the last good reading per source. Older than 10 s is stale.

A missing or stale required reading never disables protection. It holds at Caution for up to 10 s, then Throttled, then stops mining after 20 s.

## How intensity is enforced

XMRig cannot change its thread count while running, and a restart drops the pool connection and RandomX dataset. Below 100% the service pauses the miner process (`SIGSTOP`) and resumes it (`SIGCONT`) in 1 s cycles, so 40% runs 400 ms of every second. `MinerThrottle` records the real time spent stopped and reports it as "Measured intensity", so the UI shows what was applied, not only the target. The process is always resumed before it is asked to exit.

Because the whole process pauses, hashrate and the XMRig API respond in bursts while throttled.

## Events and history

Each change writes an event to the session record (SQLite, so it survives restarts and recovery): type, time, trigger code, sensor, reading, threshold, previous and new state and intensity, action and recovery status. The native layer stores codes only; the UI turns them into sentences in the app language. Up to 30 events are kept per session, with time spent in Caution and Throttled. Events appear on the Device tab, in run details, and in the results export. Exports contain no wallet, pool or credential data.

## Not verified on hardware

The policy, hysteresis, missing-sensor handling and events are covered by JVM unit tests (`ProtectionEngineTest`) with injected readings. Duty-cycle enforcement, measured intensity, the foreground-service lifecycle and sensor availability depend on the device and must be checked on real phones.
