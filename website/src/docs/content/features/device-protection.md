# Device protection

The native foreground service (`MiningGuardService`) checks the device every 2 seconds while mining and runs `ProtectionEngine`. Enforcement does not depend on the WebView.

## States

| State     | Intensity | Entered when (any)                                                                                                                                               |
| --------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal    | 100%      | Nothing below applies.                                                                                                                                           |
| Caution   | 75%       | Battery temperature within 4 °C of your limit; thermal status Light; battery within 8 points of your stop level on battery; CPU sensor at 75 °C.                 |
| Throttled | 40%       | Within 2 °C of your limit; thermal status Moderate; within 3 points of the stop level; CPU sensor at 85 °C; a required sensor is missing.                        |
| Critical  | stopped   | Temperature at your limit; thermal status Severe or worse; battery at the stop level; CPU sensor at 95 °C; charging-only and unplugged; sensor missing for 20 s. |

Escalation is immediate. Recovery needs the reading to clear its threshold by a margin and hold for 30 seconds, then moves back one state at a time. Critical ends the run and restart is manual. A missing or stale required reading never disables protection.

## What is measured

- Battery temperature (`BatteryManager`), the sensor your limit applies to.
- Android thermal status (`PowerManager`, Android 10 and later).
- CPU temperature, only when a thermal zone named for the CPU is readable and reports 10 to 110 °C. Otherwise it shows "Not exposed by this phone" and is never estimated.

## Your settings

Set the temperature limit and battery stop level in **Miner → Safety** and **Settings → Power & protection**. Step offsets, hysteresis and delays are fixed in `ProtectionEngine`.

## Enforcement

XMRig cannot change its thread count while running, so below 100% the service pauses the miner (`SIGSTOP`) and resumes it (`SIGCONT`) in one-second cycles. `MinerThrottle` times the real pauses and reports them as measured intensity. This has not been verified on every device, and the app says so.

## Where it shows up

`ProtectionPanel` and `ProtectionEventList` display state, headroom and events. Events are kept with the run in History, including the stop reason. Interface helpers are in `src/utils/protection.ts`.

Full reference: `docs/device-protection.md` in the repository.
