# Statistics API

The base URL is wherever you host `server/`. Bodies are JSON. The service doesn't log requests.

## `POST /v1/checkin`

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

| Field            | Rule                                                         |
| ---------------- | ------------------------------------------------------------ |
| `v`              | Must be `1`.                                                 |
| `installationId` | 32 lowercase hex characters.                                 |
| `country`        | An ISO 3166-1 alpha-2 code from the bundled list, or `null`. |
| `appVersion`     | `MAJOR.MINOR[.PATCH][-suffix]`                               |
| `androidMajor`   | Integer, 5 to 40.                                            |
| `variant`        | `tls`, `notls` or `download`.                                |
| `miningSeconds`  | Integer, 0 to 10 years in seconds, or `null`.                |
| `acceptedShares` | Integer, 0 to 10,000,000,000, or `null`.                     |

`miningSeconds` and `acceptedShares` are optional; omitting one is the same as `null`.

The value of `miningSeconds` is never stored or ranked. Only whether it is `null` matters:

- `null` means the installation shares no activity. It isn't on the leaderboard, and its measured time is cleared. Turning activity back on starts from zero.
- Not `null` means activity is shared, and heartbeats start counting.

This is applied on every check-in, even one inside the minimum interval. Ranked time comes only from `POST /v1/heartbeat`.

Unknown fields are rejected. The body is at most 1 KiB and needs `Content-Type: application/json`.

| Status | Meaning                                                                                                                |
| ------ | ---------------------------------------------------------------------------------------------------------------------- |
| `200`  | `{"ok":true,"counted":true}`. `"counted":false` means a duplicate inside the minimum interval; it isn't counted again. |
| `400`  | Invalid body.                                                                                                          |
| `413`  | Body too large.                                                                                                        |
| `415`  | Wrong content type.                                                                                                    |
| `429`  | Rate limited. `Retry-After` says when to retry.                                                                        |

## `POST /v1/heartbeat`

Sent about once a minute while the app is mining. Body: `{"v":1,"installationId":"…"}`. No other field is accepted.

The service credits the seconds since the previous heartbeat, on its own clock:

- Under 30 seconds after the previous one: ignored.
- Up to 5 minutes: credited in full.
- Longer: restarts the clock and credits nothing.

Heartbeats count only for installations that already checked in and share activity, and never create a record. Responses: `200` with `{"ok":true,"counted":true|false}`, `400` invalid body, `429` rate limited.

## `DELETE /v1/installations/{installationId}`

Deletes the record. Returns `204` for any well-formed ID, whether or not a record existed, and `400` for a malformed ID.

## `GET /v1/stats`

Public, cacheable for 5 minutes. Contains:

- `active.{daily,weekly,monthly}`: active installation counts.
- `countries`, `androidVersions`, `appVersions`, `variants`: breakdowns shaped `{published, groups[{key,count,share}], other, unshared}`. Below the minimum group size a breakdown is empty and `published` is `false`.
- `history.{daily,monthly,appVersionsByDay}`: trends.
- `downloads`: `total`, `byVariant`, `releases[]`, `history[]`, `fetchedAt`, `stale`.
- `minGroupSize`: the minimum in use.

## `GET /v1/leaderboard`

Public, cacheable for 1 minute. Returns `{generatedAt, entries[]}`: at most 50 entries, longest measured mining time first. Each entry is `{rank, id, country, miningSeconds, acceptedShares}`. `id` is a public code (`XXXX-XXXX`, Crockford base32) from a SHA-256 hash of the installation ID, so the installation ID is never returned. `country` and `acceptedShares` can be `null`.

## `GET /healthz`

Returns `{"ok":true}`.

## Rate limits

- Writes: `RATE_LIMIT_PER_MINUTE` per address per minute (default 30).
- Reads: four times the write limit.
- New installations: `MAX_NEW_INSTALLS_PER_HOUR` caps previously unseen IDs across all addresses.
