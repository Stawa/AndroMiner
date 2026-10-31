# Telemetry architecture

```
Android app (WebView)                 Statistics service (server/)            Public page
  Settings toggle (opt-in)                                                     (stats.html)
  telemetryClient.ts        POST /v1/checkin  ┌───────────────┐  GET /v1/stats     │
   random ID, country,  ─────────HTTPS───────▶│ validate      │◀───────────────────┘
   version, variant     DELETE /v1/installations │ rate limit  │
                                              │ SQLite (WAL)  │── GitHub Releases API (cached)
                                              └───────────────┘
```

## Decisions

- **Backend:** a dependency-free Node.js service with built-in `node:sqlite`. Alternatives considered: Cloudflare Workers + D1 (cheap, but ties hosting to one vendor and makes "no IP in logs" depend on their platform), Plausible/Umami (full analytics products with a page-view model, heavier than needed), and a GitHub-only approach (no installation data at all). One small process and one file meet the cost, auditability and self-hosting goals. The public instance runs the same app on Vercel with Firestore as the store (`server/src/firestoreStore.mjs`), because Vercel has no persistent disk; both stores implement one async interface and publish through the same code (`tallyInstalls`, `computeStats`).
- **Client:** all logic lives in `src/utils/telemetryClient.ts`, a pure module with injected storage and network, so it is testable without Android. It adds no native code and is not connected to the mining engine, CPU protection or the background service.
- **Country:** user-selected only. No IP geolocation is performed anywhere, so no raw address is processed for location.
- **Identity:** 128-bit random ID from `crypto.getRandomValues`, stored under its own `localStorage` key, excluded from configuration export, resettable, never linked to a wallet or session.
- **No heartbeat:** the app compares a local timestamp hourly and transmits only when 24 hours have passed, with a one-hour backoff after failures. A fixed delay after startup means it never blocks launch.
- **Strict schema:** the server rejects unknown fields, so extra data cannot be smuggled into a request by accident or a future bug.

## Data schema (SQLite)

| Table                             | Columns                                                                                     | Purpose                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `installs`                        | `id`, `country`, `app_version`, `android_major`, `variant`, `first_seen_ts`, `last_seen_ts` | One row per ID; deleted on request or after the retention period |
| `daily_active` / `monthly_active` | day or month, count                                                                         | Aggregate trend counters                                         |
| `daily_versions`                  | day, app version, count                                                                     | Release adoption over time (aggregate)                           |
| `download_snapshots`              | day, total, per-variant JSON                                                                | Download history                                                 |

## Risks and mitigations

| Risk                               | Mitigation                                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| IP address retention               | Not stored or logged by the service; in-memory keyed hash for rate limits; host/proxy logs may exist and are documented |
| Small groups reveal individuals    | Minimum group size with a subtraction guard; per-row data never exposed                                                 |
| Tracking across resets / linkage   | ID is random and local; resetting deletes the old record; no link to wallet or hardware                                 |
| Fake or flooded check-ins          | Strict validation, per-address rate limit, hourly new-installation cap; figures are estimates                           |
| Secrets in the APK                 | None. The client only knows a public HTTPS URL; the optional GitHub token lives on the server                           |
| Backend outage affecting the app   | All calls are best effort with a 10 s timeout and swallow errors; nothing awaits them at startup                        |
| Accidentally collecting more       | Payload built by a fixed six-field function; tests assert the exact key set                                             |
| Cross-site abuse of the public API | Public endpoints return aggregates only; writes need a well-formed random ID and are rate limited                       |

## Build-time configuration

| Variable                  | Effect                                                                    |
| ------------------------- | ------------------------------------------------------------------------- |
| `VITE_TELEMETRY_ENDPOINT` | Base URL of the service. **Unset = the feature is absent from the build** |
| `VITE_STATS_PAGE_URL`     | Optional link to the public statistics page shown in Settings             |
