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

The app sends a small check-in to the service. The service validates it, applies rate limits, stores one row per installation, and serves public totals to the statistics page.

## Design decisions

- **Backend:** a Node.js service with no dependencies, using the built-in `node:sqlite`. One small process and one file keep it cheap, easy to audit and easy to self-host. Alternatives we rejected:
  - Cloudflare Workers + D1: cheap, but it ties hosting to one vendor, and "no IP in logs" would depend on their platform.
  - Plausible or Umami: full analytics products built around page views, which is more than we need.
  - GitHub data only: it gives no installation data.
- **Public instance:** it runs the same app on Vercel and stores data in Firestore (`server/src/firestoreStore.mjs`), because Vercel has no persistent disk. Both stores implement the same async interface and publish through the same code (`tallyInstalls`, `computeStats`).
- **Client:** all logic is in `src/utils/telemetryClient.ts`. Storage and network are passed in, so it can be tested without Android. It adds no native code and has no connection to the mining engine, CPU protection or the background service.
- **Country:** chosen by the user. Nothing in the system looks up a location from an IP address, so no raw address is processed for location.
- **Default on:** a fresh install has reporting on and creates its random ID at first start. A saved choice always wins: turning it off, or deleting data, persists across restarts and updates, and an unreadable saved record is treated as off.
- **Public ID and leaderboard:** the installation ID is the secret that authorizes deletion, so the leaderboard shows `publicIdOf(id)`, a 40-bit SHA-256 derivation shown as `XXXX-XXXX`. The phone computes the same code to show it to the user (`derivePublicId`). Both are checked against one test vector. The phone adds each finished session to local totals once (a watermark on the end time), so clearing session history doesn't reset them. The server stores the latest totals per installation and serves the top 50. Totals are self-reported and unverified.
- **Identity:** a 128-bit random ID from `crypto.getRandomValues`, stored under its own `localStorage` key. It is left out of configuration exports, can be reset, and is never linked to a wallet or session.
- **No heartbeat:** the app checks a local timestamp every hour and sends only after 24 hours have passed. After a failure it waits one hour before trying again. A fixed delay after startup means it never slows down launch.
- **Per-field opt-out:** the user can switch off country, Android version, app version, APK type and mining activity individually. The client sends an off field as `null`, the server stores `NULL`, and public breakdowns count it as "not shared". Mining sessions, hashrate and uptime are not part of the check-in at all. Installations that share no app version are left out of the daily version history. Existing SQLite databases are rebuilt once on startup so those columns accept `NULL`.
- **Strict schema:** the server rejects unknown fields, so extra data can't slip into a request through a mistake or a future bug.

## Data schema (SQLite)

| Table                             | Columns                                                                                                                          | Purpose                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `installs`                        | `id`, `country`, `app_version`, `android_major`, `variant`, `first_seen_ts`, `last_seen_ts`, `mining_seconds`, `accepted_shares` | One row per ID. Deleted on request or after the retention period. |
| `daily_active` / `monthly_active` | day or month, count                                                                                                              | Aggregate trend counters.                                         |
| `daily_versions`                  | day, app version, count                                                                                                          | How fast new releases are adopted (aggregate).                    |
| `download_snapshots`              | day, total, per-variant JSON                                                                                                     | Download history.                                                 |

## Risks and how we handle them

| Risk                               | Mitigation                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| IP address retention               | The service doesn't store or log IPs. Rate limits use an in-memory keyed hash. Host or proxy logs may exist and are documented. |
| Small groups reveal individuals    | A minimum group size with a guard against subtraction. Per-row data is never exposed.                                           |
| Tracking across resets or linkage  | The ID is random and local. Resetting deletes the old record. Nothing links it to a wallet or hardware.                         |
| Fake or flooded check-ins          | Strict validation, a per-address rate limit and an hourly cap on new installations. Figures are labeled as estimates.           |
| Secrets in the APK                 | None. The client knows only a public HTTPS URL. The optional GitHub token stays on the server.                                  |
| Backend outage affecting the app   | Every call is best effort with a 10 s timeout and ignores errors. Nothing waits on them at startup.                             |
| Accidentally collecting more       | A fixed function builds the payload with eight fields, and tests check the exact set of keys.                                   |
| Cross-site abuse of the public API | Public endpoints return totals only. Writes need a well-formed random ID and are rate limited.                                  |

## Build-time configuration

| Variable                  | Effect                                                                       |
| ------------------------- | ---------------------------------------------------------------------------- |
| `VITE_TELEMETRY_ENDPOINT` | Base URL of the service. **If unset, the feature is left out of the build.** |
| `VITE_STATS_PAGE_URL`     | Optional link to the public statistics page, shown in Settings.              |
