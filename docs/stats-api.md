# Statistics API

Base URL is wherever you host `server/`. All bodies are JSON. Requests are never logged.

## `POST /v1/checkin`

```json
{
  "v": 1,
  "installationId": "0123456789abcdef0123456789abcdef",
  "country": "ID",
  "appVersion": "1.4.0",
  "androidMajor": 14,
  "variant": "tls"
}
```

| Field            | Rules                                                    |
| ---------------- | -------------------------------------------------------- |
| `v`              | must be `1`                                              |
| `installationId` | 32 lowercase hex characters                              |
| `country`        | ISO 3166-1 alpha-2 code from the bundled list, or `null` |
| `appVersion`     | `MAJOR.MINOR[.PATCH][-suffix]`                           |
| `androidMajor`   | integer 5–40                                             |
| `variant`        | `tls`, `notls` or `download`                             |

Unknown fields are rejected. Body limit 1 KiB, `Content-Type: application/json` required.

Responses: `200 {"ok":true,"counted":true|false}` (`false` = duplicate within the minimum interval); `400` invalid; `413` too large; `415` wrong content type; `429` rate limited (`Retry-After` header).

## `DELETE /v1/installations/{installationId}`

Deletes the record. Always `204` for a well-formed ID whether or not it existed. `400` for a malformed ID.

## `GET /v1/stats`

Public, cacheable for 5 minutes. Returns `active.{daily,weekly,monthly}`, the breakdowns `countries`, `androidVersions`, `appVersions` and `variants` (each `{published, groups[{key,count,share}], other, unshared}`), `history.{daily,monthly,appVersionsByDay}`, `downloads` (`total`, `byVariant`, `releases[]`, `history[]`, `fetchedAt`, `stale`) and `minGroupSize`. Breakdowns are empty and `published:false` below the threshold.

## `GET /healthz`

`{"ok":true}`.

## Rate limits

`RATE_LIMIT_PER_MINUTE` writes per address per minute (default 30) and four times that for reads. `MAX_NEW_INSTALLS_PER_HOUR` caps previously unseen IDs globally.
