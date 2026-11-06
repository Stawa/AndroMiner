# Statistics

AndroMiner works the same with statistics on or off. They are on by default in the Android app and can be switched off in Settings → Privacy.

## What is sent

At most one small request about every 24 hours: a random installation ID, app version, Android major version, APK variant, an optional country you choose, and optional mining totals. Each field has its own switch. A heartbeat of about once a minute (installation ID only) is sent while you mine and share activity.

Never sent: wallet addresses, pool addresses or credentials, worker names, individual sessions, live hashrate, temperatures, serial numbers, advertising IDs or location. No analytics SDK is included.

Benchmark results are separate. They leave the phone only if you press Share, after reading what will be sent.

## The public page

[/stats](/stats) shows aggregate totals from the service plus GitHub release download counts.

| Metric            | Meaning                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| Release downloads | Sum of `download_count` for `.apk` files. Counts repeats, mirrors and bots     |
| Active installs   | Installations with reporting on whose last check-in was within 24 h, 7 d, 30 d |

Every installation figure is a lower bound. A breakdown is published only when at least ten installations share it.

## Code

| Piece       | Location                                                          |
| ----------- | ----------------------------------------------------------------- |
| App client  | `src/composables/useTelemetry.ts`, `src/utils/telemetryClient.ts` |
| Settings UI | `UsageStatisticsCard`, `LeaderboardCard`                          |
| Service     | `server/src/` (SQLite or Firestore store)                         |
| Public page | `website/src/stats/StatsPage.vue`                                 |

Read `docs/statistics.md` for the API and `docs/privacy.md` for the policy before changing any of it.
