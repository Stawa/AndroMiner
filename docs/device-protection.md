# Device protection

The native foreground service (`MiningGuardService`) checks the device every 2 seconds while mining and runs `ProtectionEngine`. Enforcement doesn't depend on the WebView.

## States

| State     | Intensity | Entered when (any)                                                                                                                                                                                                |
| --------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal    | 100%      | Nothing below applies.                                                                                                                                                                                            |
| Caution   | 75%       | Battery temperature within 4 °C of your limit; Android thermal status Light; battery within 8 points of your stop level (on battery); CPU sensor at 75 °C.                                                        |
| Throttled | 40%       | Within 2 °C of your limit; thermal status Moderate; within 3 points of your stop level (on battery); CPU sensor at 85 °C; a required sensor is missing.                                                           |
| Critical  | stopped   | Battery temperature at your limit; thermal status Severe or worse; battery at your stop level; CPU sensor at 95 °C; charging-only and unplugged; screen off with that policy; a required sensor missing for 20 s. |

Your temperature limit and battery stop level are the existing settings. Step offsets, hysteresis and delays are fixed in `ProtectionEngine`.

- **Escalation** is immediate.
- **Recovery** needs the reading to clear its threshold by a margin (2 °C, 3 battery points, 3 °C for a CPU sensor) and hold for 30 s, then moves back one state at a time (40% → 75% → 100%).
- **Critical** ends the run; restart is manual.
- **A missing or stale required reading never disables protection:** Caution for up to 10 s, then Throttled, then stop after 20 s.

## What is measured

- **Battery temperature** (`BatteryManager`): the sensor your limit applies to.
- **Android thermal status** (`PowerManager`, Android 10+): "Not supported" below that.
- **CPU temperature:** used only when a thermal zone named for the CPU is readable and reports 10–110 °C. Many phones block `/sys/class/thermal`; then it shows "Not exposed by this phone" and is never estimated.
- **Headroom** is your limit minus battery temperature, hidden if either is missing. A reading older than 10 s is stale.

## Enforcement and history

XMRig can't change its thread count while running and a restart drops the pool connection, so below 100% the service pauses the miner (`SIGSTOP`) and resumes it (`SIGCONT`) in 1 s cycles; 40% runs 400 ms of each second. `MinerThrottle` times the real pauses and shows them as "Measured intensity". The process is always resumed before it is asked to exit. Hashrate and the HTTP API arrive in bursts while throttled.

Each change is saved with the session (SQLite, so it survives restarts): type, time, trigger, sensor, reading, threshold, old and new state and intensity, action and recovery. Only codes are stored; the UI writes the sentence in the app language. Up to 30 events per session are kept, plus time in Caution and Throttled. They show on the Device tab, in run details and in results exports (no wallet or pool data).

## Verification

`ProtectionEngineTest` covers the policy, hysteresis, missing sensors and events with injected readings. Duty-cycle enforcement, measured intensity, service lifecycle and sensor availability depend on the phone and **haven't been verified on hardware**.
