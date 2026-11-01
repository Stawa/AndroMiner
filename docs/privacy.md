# Privacy policy: anonymous usage statistics

AndroMiner works fully without sending anything. Anonymous usage statistics are **off by default**. You turn them on yourself in Settings → Privacy → Anonymous usage statistics. A build with no statistics service configured can't send anything at all.

## What is sent if you opt in

The app sends at most one small request about every 24 hours. It contains exactly these fields:

| Field            | Example   | Notes                                                                        |
| ---------------- | --------- | ---------------------------------------------------------------------------- |
| `installationId` | 32 hex    | A random value made on your phone. Not based on your hardware or any wallet. |
| `country`        | `ID`/null | Sent only if you pick a country. Never taken from GPS or your IP address.    |
| `appVersion`     | `1.4.0`   | Your AndroMiner version.                                                     |
| `androidMajor`   | `14`      | Your Android major version.                                                  |
| `variant`        | `tls`     | The APK variant: `tls`, `notls` or `download`.                               |

You choose which of `country`, `androidMajor`, `appVersion` and `variant` are sent. In Settings → Privacy → Anonymous usage statistics, switch any of them off and it is sent as empty. Your choices apply to every later check-in. The random `installationId` is always included while sharing is on. Turn sharing off to stop all check-ins.

The service also records when it received the request, using its own clock. Your phone keeps the time of your last successful check-in so the settings screen can show it.

## What is never sent

- Wallet addresses, pool addresses and credentials, worker names
- Whether you are mining, hashrate, CPU temperature, battery readings
- Serial numbers, IMEI, Android ID, advertising IDs
- GPS or any precise location
- Any other personal information

No advertising or analytics SDK is included. The request is sent without cookies and without a referrer.

## Your IP address

Any HTTPS request shows your IP address to the server and to the networks in between. The service code does not store or log IP addresses. For rate limiting it keeps a keyed hash of the address in memory only. The key is random and changes on every restart, and the hash is never written to disk.

The host is a separate matter:

- The public instance runs on Vercel. Vercel may keep its own request logs that include IP addresses, under Vercel's retention and privacy terms.
- If you host the service yourself behind a reverse proxy or CDN, you are responsible for that layer's logs.

Every online request exposes an IP address, and this is why you choose your country yourself instead of the service looking it up from the address.

## Your controls

- **Turn off:** stops all future reports right away.
- **Reset anonymous ID:** creates a new random ID and asks the service to delete the old record.
- **Delete my data:** turns reporting off, removes the ID from your phone and asks the service to delete its record. If you are offline, the request stays on your phone and is retried the next time the app starts.
- **Retention:** records for inactive installations are deleted after the retention period (90 days by default, configurable). Published totals are aggregate counters. They can't be traced back to an installation, so they don't shrink when a record is deleted.
- Your anonymous ID and statistics setting are stored apart from your mining configuration and are not included when you export it.

## What gets published

Public pages show totals only. A country, Android version, app version or APK variant is listed by name only when at least 10 installations share it (the default minimum). Smaller groups are combined into "Other". For how the numbers are worked out, and where they fall short, see the [statistics methodology](statistics-methodology.md).

## Limits

Only volunteers report, and nobody verifies the reports. Anyone could send made-up check-ins, so treat the figures as estimates. Download counts come from GitHub. They count downloads, not users or installations.
