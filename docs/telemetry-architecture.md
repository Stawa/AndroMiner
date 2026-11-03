# Telemetry architecture

```
Android app (WebView)                 Statistics service (server/)            Public page
  Settings toggle (on)                                                        (stats.html)
  telemetryClient.ts        POST /v1/checkin  ┌───────────────┐  GET /v1/stats     │
   random ID, country,  ─────────HTTPS───────▶│ validate      │◀───────────────────┘
   version, variant     DELETE /v1/installations │ rate limit  │
                                              │ SQLite (WAL)  │── GitHub Releases API (cached)
                                              └───────────────┘
```

The app sends a small check-in. The service validates it, applies rate limits, stores one row per installation and serves public totals.

## Design decisions

- **Backend:** a dependency-free Node.js service using the built-in `node:sqlite`. One small process and one file: cheap, easy to audit, easy to self-host. Rejected:
  - Cloudflare Workers + D1: ties hosting to one vendor, and "no IP in logs" would depend on their platform.
  - Plausible or Umami: full analytics products built around page views; more than needed.
  - GitHub data only: no installation data.
- **Public instance:** the same app on Vercel, storing data in Firestore (`server/src/firestoreStore.mjs`) because Vercel has no persistent disk. Both stores implement one async interface and publish through the same code (`tallyInstalls`, `computeStats`).
- **Client:** all logic is in `src/utils/telemetryClient.ts`, with storage and network passed in so it's testable without Android. No native code, and no connection to the mining engine, CPU protection or background service.
- **Country:** chosen by the user. Nothing looks up a location from an IP address.
- **Default on:** a fresh install has reporting on and creates its random ID at first start. A saved choice always wins: turning it off or deleting data persists across restarts and updates, and an unreadable saved record counts as off.
- **Identity:** a 128-bit ID from `crypto.getRandomValues`, stored under its own `localStorage` key, left out of configuration exports, resettable, and never linked to a wallet or session.
- **Public ID and leaderboard:** the installation ID authorizes deletion, so the leaderboard shows `publicIdOf(id)`, a 40-bit SHA-256 derivation shown as `XXXX-XXXX`. The phone computes the same code (`derivePublicId`); both are checked against one test vector. The phone adds each finished session to its local totals once (a watermark on end time), so clearing history doesn't reset them. The server keeps the latest totals per installation and serves the top 50.
- **Check-ins:** the app checks a local timestamp hourly and sends only after 24 hours. After a failure it waits an hour. A fixed delay after startup keeps launch fast. Changing any share toggle makes a check-in due immediately, and the service applies the new choice even inside its minimum interval (without counting it again).
- **Mining heartbeat:** while the miner is `mining` or `reconnecting` and activity is shared, the app sends `POST /v1/heartbeat` (ID only) every 60 seconds. The service credits the gap since the previous beat on its own clock (`server/src/heartbeat.mjs`: under 30 s ignored, up to 300 s credited, longer only restarts the clock). Leaderboard time therefore can't outrun the clock, and a check-in's `miningSeconds` only signals whether activity is shared. Heartbeats never create records or undo an opt-out. The service can't tell whether mining ran, so a bot that beats for 24 hours still ranks: this raises the cost of cheating, not removes it. Accepted shares are self-reported.
- **Per-field opt-out:** country, Android version, app version, APK type and mining activity can each be switched off. The client sends an off field as `null`, the server stores `NULL`, and public breakdowns count it as "not shared". Sessions, hashrate and uptime are never in the check-in. Installations sharing no app version are left out of the daily version history. Existing SQLite databases are rebuilt once at startup so those columns accept `NULL`.
- **Strict schema:** unknown fields are rejected, so extra data can't slip in through a mistake or future bug.

## Data schema (SQLite)

| Table                             | Columns                                                                                                                                            | Purpose                                                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `installs`                        | `id`, `country`, `app_version`, `android_major`, `variant`, `first_seen_ts`, `last_seen_ts`, `verified_seconds`, `last_beat_ts`, `accepted_shares` | One row per ID. Deleted on request or after retention. (`mining_seconds`, the old self-reported total, is no longer read.) |
| `daily_active` / `monthly_active` | day or month, count                                                                                                                                | Aggregate trend counters.                                                                                                  |
| `daily_versions`                  | day, app version, count                                                                                                                            | Release adoption (aggregate).                                                                                              |
| `download_snapshots`              | day, total, per-variant JSON                                                                                                                       | Download history.                                                                                                          |

## Risks and mitigations

| Risk                               | Mitigation                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| IP address retention               | The service doesn't store or log IPs. Rate limits use an in-memory keyed hash. Host or proxy logs may exist.       |
| Small groups reveal individuals    | Minimum group size with a guard against subtraction. Per-row data is never exposed.                                |
| Tracking across resets or linkage  | The ID is random and local. Resetting deletes the old record. Nothing links it to a wallet or hardware.            |
| Fake or flooded check-ins          | Strict validation, per-address rate limit, hourly cap on new installations. Figures are labeled as estimates.      |
| Inflated leaderboard time          | The server measures time between heartbeats and caps each beat, so it can't outrun the clock. Bots can still beat. |
| Secrets in the APK                 | None. The client knows only a public HTTPS URL. The optional GitHub token stays on the server.                     |
| Backend outage affecting the app   | Every call is best effort with a 10 s timeout and ignores errors. Nothing waits on them at startup.                |
| Accidentally collecting more       | One fixed function builds the eight-field payload, and tests check the exact keys.                                 |
| Cross-site abuse of the public API | Public endpoints return totals only. Writes need a well-formed random ID and are rate limited.                     |

## Build-time configuration

| Variable                  | Effect                                                                       |
| ------------------------- | ---------------------------------------------------------------------------- |
| `VITE_TELEMETRY_ENDPOINT` | Base URL of the service. **If unset, the feature is left out of the build.** |
| `VITE_STATS_PAGE_URL`     | Optional link to the public statistics page, shown in Settings.              |
