# AndroMiner privacy policy: anonymous usage statistics

AndroMiner works fully without sending anything to anyone. **Anonymous usage statistics are off by default** and you must turn them on yourself in **Settings → Privacy → Anonymous usage statistics**. Builds that are not configured with a statistics service cannot send anything at all.

## What is sent when you opt in

At most one small request roughly every 24 hours, containing exactly these fields:

| Field            | Example   | Notes                                                                          |
| ---------------- | --------- | ------------------------------------------------------------------------------ |
| `installationId` | 32 hex    | Random value generated on your phone. Not derived from hardware or any wallet. |
| `country`        | `ID`/null | Only if **you** choose one. Never detected from GPS or your IP address.        |
| `appVersion`     | `1.4.0`   | Your AndroMiner version.                                                       |
| `androidMajor`   | `14`      | Android major version.                                                         |
| `variant`        | `tls`     | APK variant: `tls`, `notls` or `download`.                                     |

The service also learns the time it received the request (its own clock). The time of your last successful check-in is kept on your phone for the settings screen.

## What is never sent

Wallet addresses, pool addresses or credentials, worker names, whether you are mining, hashrate, CPU temperature, battery readings, serial numbers, IMEI, Android ID, advertising IDs, GPS or any precise location, and any personal information. No advertising or analytics SDK is included. The request is sent without cookies and without a referrer.

## Network metadata

Any HTTPS request reveals your IP address to the server and to network intermediaries. The service code **does not store or log IP addresses**. For rate limiting it keeps a keyed hash of the address in memory only, using a random key regenerated on each restart, and never writes it to disk. The platform it runs on is separate: the public instance is hosted on Vercel, which may keep its own request logs that include IP addresses, under Vercel's retention and privacy terms. Self-hosters behind a reverse proxy or CDN are responsible for configuring that layer's logs. This is the unavoidable exposure of any online request, and it is the reason the country is chosen by you instead of being looked up from the address.

## Control

- **Turn off:** immediately stops all future reports.
- **Reset anonymous ID:** creates a new random ID and asks the service to delete the old record.
- **Delete my data:** turns reporting off, forgets the ID on your phone, and asks the service to delete its record. If you are offline, the request is kept on your phone and retried at the next app start.
- **Retention:** records for inactive installations are deleted after the configured retention period (90 days by default). Published totals are aggregate counters that cannot be traced back to an installation and are not reduced when a record is deleted.
- The anonymous ID and statistics preference are stored separately from your mining configuration and are **not** included in configuration exports.

## Publication

Public pages show only aggregates. A country, Android version, app version or APK variant is listed individually only when at least a minimum number of installations (10 by default) share it; smaller groups are folded into "Other". See the [statistics methodology](statistics-methodology.md) for how figures are computed and their limits.

## Limits

Statistics come from volunteers and are not independently verified. Anyone could submit made-up check-ins, so the figures are estimates. Download counts come from GitHub and are not users or installations.
