# Mining

Mining is a native session. The interface starts it, the foreground service owns it, and the interface can disappear without stopping it.

## Session lifecycle

1. **Validate.** `validateMiningSetup` (`src/utils/configValidation.ts`) checks the coin, wallet, pool and engine before the start button works.
2. **Confirm.** `StartMiningWarningSheet` shows the workload and asks for confirmation every time.
3. **Start.** `NativeMiner.start` launches the miner under `MiningGuardService` with an ongoing notification that has a Stop control.
4. **Run.** Hashrate, shares and miner output stream into the session view; device readings update beside them.
5. **Stop.** Manual stop, a session deadline or device protection ends the run and saves it to History.

Pausing ends and saves the current run. Resuming starts a new run after confirmation.

## What you see

- Measured hashrate and the session peak (`HashrateRing`).
- Accepted and rejected shares per run.
- Miner output lines.
- Temperature, battery, charging state and protection state.

Values the phone or miner has not reported show as waiting, stale or not reported. They are never shown as zero.

## Session limits

In **Miner → Safety**, set a maximum duration from 1 to 1440 minutes. `0` means no deadline. Android enforces the countdown while the interface is hidden. Timer, manual and protection stops never resume automatically.

## Crash handling

If the miner exits unexpectedly the app asks whether to restart it (`CrashRestartPrompt`) and restarts it automatically after 30 seconds without an answer. This is configurable under Settings → Reliability.

## Supported coins

Monero, Zephyr, Wownero, Salvium, Tari, Raptoreum, Yerbas, GSP Coin, Conceal and Scala. The catalog is `src/data/miningCatalog.ts`. Salvium and Tari are experimental. See [Mining engine](/docs/architecture/mining-engine).

## Benchmark

The Device tab runs an offline RandomX benchmark with the installed engine. Running it sends nothing. Sharing the result is optional and shown to you first.
