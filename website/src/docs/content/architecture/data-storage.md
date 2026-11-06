# Data storage

Everything the app keeps stays on the phone. Automatic Android app backup is disabled, and clearing app data removes saved setups and history.

## Interface storage (`localStorage`)

| Key                          | Owner                                    | Contents                                              |
| ---------------------------- | ---------------------------------------- | ----------------------------------------------------- |
| `androminer-profiles`        | `src/stores/profiles.ts`                 | Saved setups (`SavedMiningProfile`) and the active id |
| `androminer-settings`        | `src/stores/settings.ts`                 | Notification, battery-safety and performance settings |
| `androminer-session-history` | `src/composables/useMiningController.ts` | Session history shown in History                      |
| `androminer-theme`           | `src/composables/useTheme.ts`            | Theme preference                                      |

Reads and writes are wrapped so that corrupt or missing data falls back to defaults; the profiles store exposes a `storageError` string for the interface.

## Native storage

`SessionJournal` is a SQLite database with one bounded row per run. It keeps up to 100 runs and 50 state events per run. Transactions preserve the previous checkpoint if a write fails. After an interruption the end time is the last saved observation, not the exact crash time.

## Saved setup shape

```ts
interface SavedMiningProfile {
  id: string;
  name: string;
  coinId: string;
  createdAt: string;
  updatedAt: string;
  config: MiningConfig;
}
```

`MiningConfig` is defined in `src/types/mining.ts`. Wallet and pool settings are part of it, so configuration exports contain them. Review an export before sharing it.

## Export and import

The drawer exports and imports configuration as a file. History results have a separate JSON export that omits pool identifiers unless you select them.

## What leaves the device

Only the optional statistics check-in and a benchmark result you choose to share. See the [Statistics](/docs/features/statistics) page and the [privacy policy](/privacy).
