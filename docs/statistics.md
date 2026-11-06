# Usage statistics

How the optional anonymous statistics work: what the numbers mean, the service API, design choices and contributor rules. What users are told is in the [privacy policy](privacy.md).

The app sends a small check-in. `server/` validates it, rate-limits it, keeps one row per installation and serves public totals to `stats.html`. It is a dependency-free Node service on `node:sqlite`; the public instance runs on Vercel with Firestore (`server/src/firestoreStore.mjs`) because Vercel has no persistent disk. Both stores share one interface and one publishing path.

## What the numbers mean

| Metric                          | Meaning                                                                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Release downloads               | Sum of `download_count` for `.apk` files on non-draft GitHub releases. Counts repeats, mirrors and bots. Not users or devices.             |
| Daily / weekly / monthly active | Installations with reporting on whose last accepted check-in was within 24 hours / 7 days / 30 days. "Estimated active" is the monthly figure. |

Every installation figure is a lower bound: only installations that leave reporting on are counted.

- One random ID per installation; one row per ID, updated in place, no check-in history.
- A check-in within 20 hours (configurable) of the last accepted one is acknowledged but not counted. It still applies the user's sharing choices.
- Daily and monthly series add one when an ID's previous check-in was on an earlier UTC day or month. Windows use the server clock; client clocks are never sent or trusted.
- Version, Android and variant breakdowns cover installations active in the last 30 days, each under its latest report. Download history is a daily snapshot taken when the service refreshes its cached GitHub data.
- Small groups: a breakdown is published only when at least `MIN_GROUP_SIZE` (default 10) installations are active; smaller groups are merged into "Other". If "Other" is still below the minimum, the next-smallest group joins it, so subtracting groups from the total can't reveal a small group. No country shows as "Country not shared".

Limits: self-selection bias; no identity checks (IDs can be reset or faked, rate limits only reduce it); reinstalling creates a new ID and the old one counts until it ages out; country is unverified; deleting a record doesn't change past days.

## API

Bodies are JSON, the service doesn't log requests, and unknown fields are rejected (max 1 KiB, `Content-Type: application/json`).

### `POST /v1/checkin`

```json
{
  "v": 1,
  "installationId": "0123456789abcdef0123456789abcdef",
  "country": "ID",
  "appVersion": "1.4.0",
  "androidMajor": 14,
  "variant": "tls",
  "miningSeconds": 43200,
  "acceptedShares": 310
}
```

| Field            | Rule                                                 |
| ---------------- | ---------------------------------------------------- |
| `v`              | `1`                                                  |
| `installationId` | 32 lowercase hex characters                          |
| `country`        | ISO 3166-1 alpha-2 from the bundled list, or `null`  |
| `appVersion`     | `MAJOR.MINOR[.PATCH][-suffix]`                       |
| `androidMajor`   | integer 5–40                                         |
| `variant`        | `tls`, `notls` or `download`                         |
| `miningSeconds`  | integer up to 10 years in seconds, or `null`/omitted |
| `acceptedShares` | integer up to 10,000,000,000, or `null`/omitted      |

`miningSeconds` is never stored or ranked; only whether it is `null` matters. `null` means activity isn't shared (off the leaderboard, measured time cleared, restarts from zero when re-enabled); not `null` means shared and heartbeats count. This applies on every check-in, even one inside the minimum interval.

Responses: `200 {"ok":true,"counted":bool}` (`false` = duplicate inside the interval), `400` invalid, `413` too large, `415` wrong type, `429` rate limited (`Retry-After`).

### `POST /v1/heartbeat`

`{"v":1,"installationId":"…"}`, about once a minute while mining and sharing activity. The service credits the gap since the previous beat on its own clock: under 30 s ignored, up to 5 min credited, longer restarts the clock with nothing credited. It never creates a record or undoes an opt-out. Responses: `200 {"ok":true,"counted":bool}`, `400`, `429`.

### `POST /v1/benchmark`

One opt-in speed result from the app's benchmark. No installation ID; unknown fields are rejected.

```json
{
  "v": 1,
  "device": "Google Pixel 8",
  "soc": "Tensor G3",
  "abi": "arm64-v8a",
  "cpuThreads": 9,
  "engine": "xmrig",
  "engineVersion": "6.26.0",
  "appVersion": "1.4.0",
  "hashrate": 812.4
}
```

`device` and `soc` are short labels (letters, digits and ` ._+-/()`), `abi` is `arm64-v8a` or `armeabi-v7a`, `engine` is `xmrig` or `xmrigcc`, `hashrate` is 1 to 1,000,000 H/s. Responses: `200 {"ok":true}`, `400`, `413`, `415`, `429` (per-address limit, or `MAX_BENCHMARKS_PER_HOUR` reached across all addresses). Rows older than `RETENTION_DAYS` are pruned.

### `GET /v1/benchmarks` (cache 5 min)

`{generatedAt, minSamples, totalSubmissions, devices[]}`, one entry per device and architecture with at least `MIN_BENCHMARK_SAMPLES` (default 3) results: `{device, soc, abi, cpuThreads, samples, median, min, max}`, highest median first. The median resists a few bogus or throttled results, but nothing verifies submissions, so treat the table as indicative.

### Other endpoints

- `DELETE /v1/installations/{id}`: deletes the record; `204` for any well-formed ID, `400` for a malformed one.
- `GET /v1/stats` (cache 5 min): `active.{daily,weekly,monthly}`; `countries`, `androidVersions`, `appVersions`, `variants` as `{published, groups[{key,count,share}], other, unshared}` (empty and `published:false` below the minimum); `history.{daily,monthly,appVersionsByDay}`; `downloads` (`total`, `byVariant`, `releases[]`, `history[]`, `fetchedAt`, `stale`); `minGroupSize`.
- `GET /v1/leaderboard` (cache 1 min): `{generatedAt, entries[]}`, at most 50 by measured mining time, each `{rank, id, country, miningSeconds, acceptedShares}`. `id` is a public `XXXX-XXXX` code (Crockford base32, 40-bit SHA-256 of the installation ID); the installation ID is never returned.
- `GET /healthz`: `{"ok":true}`.

Rate limits: writes `RATE_LIMIT_PER_MINUTE` per address (default 30), reads four times that, and `MAX_NEW_INSTALLS_PER_HOUR` caps unseen IDs across all addresses. Limits use an in-memory keyed hash of the address, never stored.

## Design

- Client (`src/utils/telemetryClient.ts`): storage and network are injected so it tests without Android. No native code, no link to the engine, protection or background service.
- Default on, choice wins: a fresh install reports and creates its ID at first start. Turning it off or deleting data persists across restarts and updates; an unreadable saved record counts as off.
- Identity: 128-bit ID from `crypto.getRandomValues`, stored under its own key, excluded from config exports, resettable, never linked to a wallet or session.
- Cadence: a local timestamp is checked hourly and a check-in is sent after 24 hours; after a failure it waits an hour. Changing any share toggle makes one due immediately.
- Per-field opt-out: country, Android version, app version, APK type and mining activity can each be switched off; the client sends `null`, the server stores `NULL`, breakdowns count it as "not shared".
- Leaderboard: the phone adds each finished session to local totals once (a watermark on end time, so clearing history doesn't reset them). Time comes from heartbeats so it can't outrun the clock, but the service can't tell whether mining happened and shares are self-reported: this raises the cost of cheating, it doesn't remove it.
- Country is chosen by the user; nothing looks up a location from an IP address.
- Failure: every call is best effort with a 10 s timeout and ignores errors; nothing waits on it at startup.

Schema (SQLite): `installs` (`id`, `country`, `app_version`, `android_major`, `variant`, `first_seen_ts`, `last_seen_ts`, `verified_seconds`, `last_beat_ts`, `accepted_shares`; deleted on request or after retention), `daily_active` and `monthly_active` (counters), `daily_versions` (day, version, count), `download_snapshots` (day, total, per-variant JSON).

Benchmark: `src/utils/benchmarkClient.ts` builds and sends the result; the engine runs `--bench=1M` offline in `MinerBenchmark.java` and stops after enough speed readings. It is independent of the check-in state and never reads or sends the installation ID.

Build-time: `VITE_TELEMETRY_ENDPOINT` is the service URL, and if it is unset the feature is left out of the build. `VITE_STATS_PAGE_URL` optionally links the public page from Settings.

## Contributing

AndroMiner must stay fully usable without telemetry.

1. It is on by default only in the Android app, stays visible, revocable and deletable in Settings, and never overrides a saved opt-out.
2. Don't add payload fields without opening an issue first. A new field needs a stated purpose, an update to `privacy.md`, the strict server schema and a test listing the exact keys.
3. Never read wallet, pool, worker, mining state, live hashrate, sensors, hardware identifiers or location for telemetry. The one exception is the benchmark result, which the user sends by hand after seeing the exact payload (see `benchmarkClient.ts`).
4. Don't await telemetry on a startup or mining path; ignore its errors; never log identifiers.
5. No analytics SDKs, accounts, advertising IDs or fingerprinting.
6. Don't touch the engine, device protection or the background service.

```bash
npm test && npm run lint     # app and server tests
npm run build:stats          # public page → dist-stats/
cd server && node src/index.mjs   # Node 22.13+; set VITE_TELEMETRY_ENDPOINT=http://localhost:8787 for a dev app
```

Plain HTTP is accepted only for localhost. Tests: `server/tests/` and `tests/telemetry-client.test.mjs`.
