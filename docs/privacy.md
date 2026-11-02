# Privacy policy: anonymous usage statistics

AndroMiner works the same whether or not anonymous usage statistics are on. They are **on by default** in the Android app, and you can turn them off at any time in Settings → Privacy → Anonymous usage statistics. If you turn them off, nothing is sent. A build with no statistics service configured, and the web build, can't send anything at all.

## What is sent while statistics are on

The app sends at most one small request about every 24 hours. It contains exactly these fields:

| Field            | Example   | Notes                                                                                                                                        |
| ---------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `installationId` | 32 hex    | A random value made on your phone. Not based on your hardware or any wallet.                                                                 |
| `country`        | `ID`/null | Sent only if you pick a country. Never taken from GPS or your IP address.                                                                    |
| `appVersion`     | `1.4.0`   | Your AndroMiner version.                                                                                                                     |
| `androidMajor`   | `14`      | Your Android major version.                                                                                                                  |
| `variant`        | `tls`     | The APK variant: `tls`, `notls` or `download`.                                                                                               |
| `miningSeconds`  | `43200`   | Your local mining total. The service only uses it to see that you share activity; ranking uses the time it measures from heartbeats (below). |
| `acceptedShares` | `310`     | Your total accepted shares, summed over finished sessions.                                                                                   |

You choose which of `country`, `androidMajor`, `appVersion`, `variant` and the mining activity pair (`miningSeconds` and `acceptedShares`) are sent. In Settings → Privacy → Anonymous usage statistics, switch any of them off and it is sent as empty. Your choices apply to every later check-in. The random `installationId` is always included while sharing is on. Turn sharing off to stop all check-ins.

While your phone is mining and you share your mining activity, it also sends a **heartbeat** about once a minute. A heartbeat contains only the random `installationId` and a schema version, nothing about what you mine, your hashrate or your wallet. The service adds up the time between your heartbeats on its own clock, so the leaderboard shows time it measured rather than a figure your phone reports. Heartbeats stop when you stop or pause mining, or switch off Mining activity or usage statistics.

The service also records when it received the request, using its own clock. Your phone keeps the time of your last successful check-in so the settings screen can show it.

## What is never sent

- Wallet addresses, pool addresses and credentials, worker names
- Individual sessions, when you mine, hashrate, CPU temperature, battery readings
- Serial numbers, IMEI, Android ID, advertising IDs
- GPS or any precise location
- Any other personal information

No advertising or analytics SDK is included. The request is sent without cookies and without a referrer.

## The leaderboard

If you share your mining activity, you appear on a public leaderboard ranked by total mining time. Only the top 50 are shown. Each row shows a short **public ID** such as `7K3F-92QD`, the country flag if you chose a country, your measured mining time and your accepted shares. Mining time updates within a few minutes of mining. The same ID is shown to you in the app on the Statistics tab.

The public ID is a one-way hash of your random `installationId`. It can't be turned back into the `installationId`, which stays secret because it is what allows a record to be deleted. Nothing links the public ID to you, your phone or a wallet. Resetting your anonymous ID gives you a new public ID.

Switch off **Mining activity** in Settings to keep using the other statistics without appearing on the leaderboard. The totals are then kept only on your phone. Mining time is measured by the service from heartbeats, so it cannot grow faster than real time, but the service cannot see whether mining actually happened. Accepted shares are still reported by each app and are not verified, so the leaderboard is for fun and not proof of anything. The public instance may keep a leaderboard it has already computed for up to a minute, so a deleted record can stay visible for that long.

## Your IP address

Any HTTPS request shows your IP address to the server and to the networks in between. The service code does not store or log IP addresses. For rate limiting it keeps a keyed hash of the address in memory only. The key is random and changes on every restart, and the hash is never written to disk.

The host is a separate matter:

- The public instance runs on Vercel. Vercel may keep its own request logs that include IP addresses, under Vercel's retention and privacy terms.
- If you host the service yourself behind a reverse proxy or CDN, you are responsible for that layer's logs.

Every online request exposes an IP address, and this is why you choose your country yourself instead of the service looking it up from the address.

## Your controls

- **Turn off:** stops all future reports right away. Your choice is remembered, including after you update the app.
- **Reset anonymous ID:** creates a new random ID and asks the service to delete the old record.
- **Delete my data:** turns reporting off, removes the ID from your phone and asks the service to delete its record. If you are offline, the request stays on your phone and is retried the next time the app starts.
- **Retention:** records for inactive installations are deleted after the retention period (90 days by default, configurable). Published totals are aggregate counters. They can't be traced back to an installation, so they don't shrink when a record is deleted.
- Your anonymous ID and statistics setting are stored apart from your mining configuration and are not included when you export it.

## What gets published

Public pages show totals only, apart from the leaderboard described above. A country, Android version, app version or APK variant is listed by name only when at least 10 installations share it (the default minimum). Smaller groups are combined into "Other". For how the numbers are worked out, and where they fall short, see the [statistics methodology](statistics-methodology.md).

## Limits

Only installations that leave reporting on are counted, and nobody verifies the reports. Anyone could send made-up check-ins, so treat the figures as estimates. Download counts come from GitHub. They count downloads, not users or installations.
