# Statistics API

The base URL is wherever you host `server/`. All request and response bodies are JSON. The service doesn't log requests.

## `POST /v1/checkin`

Example body:

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
| `androidMajor`   | An integer from 5 to 40.                                     |
| `variant`        | `tls`, `notls` or `download`.                                |
| `miningSeconds`  | An integer from 0 to 10 years in seconds, or `null`.         |
| `acceptedShares` | An integer from 0 to 10,000,000,000, or `null`.              |

`miningSeconds` and `acceptedShares` are optional. Omitting them is the same as sending `null`, and an installation with `miningSeconds: null` is not on the leaderboard.

Unknown fields are rejected. The body can be at most 1 KiB, and `Content-Type: application/json` is required.

Responses:

| Status | Meaning                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------ |
| `200`  | `{"ok":true,"counted":true}`, or `"counted":false` if this is a duplicate inside the minimum interval. |
| `400`  | The body is invalid.                                                                                   |
| `413`  | The body is too large.                                                                                 |
| `415`  | Wrong content type.                                                                                    |
| `429`  | Rate limited. The `Retry-After` header says when to retry.                                             |

## `DELETE /v1/installations/{installationId}`

Deletes the record. Returns `204` for any well-formed ID, whether or not a record existed. Returns `400` if the ID is malformed.

## `GET /v1/stats`

Public. Responses can be cached for 5 minutes. The response contains:

- `active.{daily,weekly,monthly}`: active installation counts.
- `countries`, `androidVersions`, `appVersions`, `variants`: breakdowns. Each has the shape `{published, groups[{key,count,share}], other, unshared}`. Below the minimum group size, a breakdown is empty and `published` is `false`.
- `history.{daily,monthly,appVersionsByDay}`: trend data.
- `downloads`: `total`, `byVariant`, `releases[]`, `history[]`, `fetchedAt` and `stale`.
- `minGroupSize`: the minimum group size in use.

## `GET /v1/leaderboard`

Public. Responses can be cached for 5 minutes. Returns `{generatedAt, entries[]}` with at most 50 entries, longest mining time first. Each entry is `{rank, id, country, miningSeconds, acceptedShares}`. `id` is a public code (`XXXX-XXXX`, Crockford base32) made from a SHA-256 hash of the installation ID, so the installation ID itself is never returned. `country` and `acceptedShares` can be `null`.

## `GET /healthz`

Returns `{"ok":true}`.

## Rate limits

- Writes: `RATE_LIMIT_PER_MINUTE` per address per minute (default 30).
- Reads: four times the write limit.
- New installations: `MAX_NEW_INSTALLS_PER_HOUR` caps previously unseen IDs across all addresses.
