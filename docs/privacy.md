# Privacy policy: anonymous usage statistics

AndroMiner works the same with statistics on or off. They are **on by default** in the Android app. Turn them off any time in Settings → Privacy → Anonymous usage statistics and nothing is sent. Builds with no statistics service configured, and the web build, can't send anything.

## What is sent

At most one small request about every 24 hours, with exactly these fields:

| Field            | Example   | Notes                                                                                                                      |
| ---------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| `installationId` | 32 hex    | Random, made on your phone. Not based on hardware or any wallet.                                                           |
| `country`        | `ID`/null | Only if you pick one. Never taken from GPS or your IP address.                                                             |
| `appVersion`     | `1.4.0`   | Your AndroMiner version.                                                                                                   |
| `androidMajor`   | `14`      | Your Android major version.                                                                                                |
| `variant`        | `tls`     | APK variant: `tls`, `notls` or `download`.                                                                                 |
| `miningSeconds`  | `43200`   | Your local mining total. The service only uses it to see that you share activity. Ranking uses heartbeat time (see below). |
| `acceptedShares` | `310`     | Your total accepted shares across finished sessions.                                                                       |

You choose which of `country`, `androidMajor`, `appVersion`, `variant` and the mining activity pair (`miningSeconds`, `acceptedShares`) are sent. Switch any off in Settings → Privacy and it is sent as empty. A change applies right away: the app sends a new check-in and the service updates or clears the stored values. The random `installationId` is always sent while sharing is on.

Heartbeat. While you mine and share mining activity, the phone sends a heartbeat about once a minute containing only the `installationId` and a schema version: nothing about what you mine, your hashrate or your wallet. The service adds up the time between heartbeats on its own clock. Heartbeats stop when you stop or pause mining, or switch off Mining activity or usage statistics.

The service records when it received each request, on its own clock. Your phone keeps the time of your last successful check-in to show in Settings.

## Speed benchmark results

Separate from the statistics above. The benchmark on the Device tab runs offline and sends nothing. Only if you press "Share anonymously", after the app shows a warning and the exact JSON, one request goes to the statistics service. It works even when usage statistics are off, and it carries no installation ID:

| Field        | Example          | Notes                                                       |
| ------------ | ---------------- | ----------------------------------------------------------- |
| `device`     | `Google Pixel 8` | Manufacturer and model reported by Android.                 |
| `soc`        | `Tensor G3`      | Chip name (Android 12+), or empty.                          |
| `abi`        | `arm64-v8a`      | CPU architecture of the miner that ran.                     |
| `cpuThreads` | `9`              | Threads Android reports.                                    |
| `engine`     | `xmrig`          | Engine that ran, plus its version in `engineVersion`.       |
| `appVersion` | `1.4.0`          | Your AndroMiner version.                                    |
| `hashrate`   | `812.4`          | Median speed in H/s over about 30 seconds of the benchmark. |

Results are stored without any identifier, so they cannot be linked to you and cannot be deleted individually; they expire after the retention period (90 days by default). A device is listed publicly, as a median, only once at least three results exist for it. Your IP address is visible to the service and its host like any request; it is used only for in-memory rate limiting.

## What is never sent

- Wallet addresses, pool addresses and credentials, worker names
- Individual sessions, when you mine, live hashrate, CPU temperature, battery readings. (The only speed ever sent is a benchmark result you choose to share, described above.)
- Serial numbers, IMEI, Android ID, advertising IDs
- GPS or any precise location
- Any other personal information

No advertising or analytics SDK is included. Requests carry no cookies and no referrer.

## The leaderboard

If you share mining activity, you appear on a public leaderboard of the top 50 by mining time. Each row shows a short public ID such as `7K3F-92QD`, your country flag if you chose a country, your measured mining time and your accepted shares. The Statistics tab shows you your own ID.

The public ID is a one-way hash of your `installationId`. It can't be reversed, and the `installationId` stays secret because it authorizes deletion. Nothing links the public ID to you, your phone or a wallet. Resetting your anonymous ID gives you a new one. Switch off Mining activity to keep the other statistics without appearing on the leaderboard; totals then stay only on your phone.

Time is measured from heartbeats, so it can't grow faster than real time, but the service can't see whether mining actually happened, and accepted shares are reported by each app and not verified. The leaderboard is for fun, not proof. The public instance may cache it for up to a minute, so a deleted record can stay visible that long.

## Your IP address

Every HTTPS request shows your IP address to the server and the networks in between. The service doesn't store or log IP addresses. For rate limiting it keeps a keyed hash in memory only; the key is random, changes on every restart, and the hash is never written to disk. Because every request exposes an IP address, you choose your country yourself instead of the service looking it up.

The host is separate: the public instance runs on Vercel, which may keep its own request logs under its own terms. If you self-host behind a proxy or CDN, that layer's logs are your responsibility.

## Your controls

- Turn off: stops all future reports at once, and the choice is remembered across updates.
- Reset anonymous ID: creates a new random ID and asks the service to delete the old record.
- Delete my data: turns reporting off, removes the ID from your phone and asks the service to delete its record. If you're offline, the request is retried the next time the app starts.
- Retention: records of inactive installations are deleted after 90 days by default (configurable). Published totals are aggregate counters that can't be traced to an installation, so they don't shrink when a record is deleted.
- Your anonymous ID and statistics setting are stored apart from your mining configuration and aren't included when you export it.

## What gets published

Public pages show totals only, apart from the leaderboard. A country, Android version, app version or APK variant is named only when at least 10 installations share it; smaller groups are combined into "Other". How numbers are counted, and their limits, is in [usage statistics](statistics.md). Only installations that leave reporting on are counted and nobody verifies reports, so treat figures as estimates. Download counts come from GitHub and count downloads, not users.
