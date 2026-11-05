# AndroMiner statistics service

A small Node.js service (Node 22.13+; dependency-free when self-hosted with SQLite) that receives optional anonymous check-ins from the AndroMiner app and publishes aggregate statistics. See the [privacy policy](../docs/privacy.md) and [usage statistics](../docs/statistics.md) (counting rules, API, design, contributing).

## Run

```bash
cd server
node src/index.mjs
npm test
```

## Deploy

Requirements: any host that runs Node 22.13+ or Docker, a persistent disk for the SQLite file, and **HTTPS in front of it** (Caddy, nginx, or a managed proxy). The app refuses plain `http://` except for localhost.

```bash
docker build -t androminer-stats server
docker run -d --name androminer-stats -p 127.0.0.1:8787:8787 -v androminer-stats:/data androminer-stats
```

Then:

1. Terminate TLS at the proxy and forward to the service. Disable access logs, or at least do not log client addresses or request paths (deletion requests carry the installation ID in the path).
2. If the proxy sets a trusted client-address header, set `CLIENT_IP_HEADER` so rate limiting does not see only the proxy. Otherwise leave it empty.
3. Set `CORS_ORIGIN` to the origin of your statistics page if you want to restrict browsers (the Android app is unaffected).
4. Build the app with `VITE_TELEMETRY_ENDPOINT=https://stats.example.org`. Build the public page with the same value: `npm run build:stats`, then host `dist-stats/` on any static host.
5. Back up `stats.sqlite` if you want to keep history; it contains no wallet or mining data.

## Deploy on Vercel with Firestore (free tier)

The repository root is a Vercel project: `vercel.json` builds the public page (`npm run build:stats` → `dist-stats/`), serves it at `/`, and routes `/v1/*` and `/healthz` to `api/index.mjs`, which runs this service on Firestore instead of SQLite. Everything below fits the free plans (Vercel Hobby, Firebase Spark).

1. In the [Firebase console](https://console.firebase.google.com) create a project and add **Firestore Database** (production mode). Publish `firestore.rules` (it denies all client access; the server uses a service account).
2. Project settings → Service accounts → **Generate new private key**. Keep the JSON file private.
3. Import the repository in Vercel and add the environment variables below. Paste the whole key JSON as `FIREBASE_SERVICE_ACCOUNT`.
4. Deploy. Build the app with `VITE_TELEMETRY_ENDPOINT=https://<your-project>.vercel.app` (and `VITE_STATS_PAGE_URL` pointing at the same address). The statistics page uses the same origin, so it needs no endpoint.
5. Check `https://<your-project>.vercel.app/healthz` and `/v1/stats`, then send one check-in with `curl -X POST -H 'Content-Type: application/json' -d '{"v":1,"installationId":"<32 hex chars>","country":null,"appVersion":"1.4.0","androidMajor":14,"variant":"tls"}' https://<your-project>.vercel.app/v1/checkin`.

| Variable                   | Required | Purpose                                                                                    |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `FIREBASE_SERVICE_ACCOUNT` | yes      | Service-account key JSON. Server-side only.                                                |
| `CRON_SECRET`              | yes      | Any long random string. Vercel Cron sends it to run the daily prune of expired data.       |
| `GITHUB_TOKEN`             | no       | Raises the GitHub API limit for download counts (shared Vercel IPs hit the anonymous one). |
| `STATS_CACHE_SECONDS`      | no       | How long computed figures are reused (default 3600). See quota below.                      |

Other settings in `.env.example` apply too (`MIN_GROUP_SIZE`, `RETENTION_DAYS`, …); `CLIENT_IP_HEADER` defaults to `x-real-ip` here.

**Quota.** Figures are recomputed from the installations active in the last 30 days at most once per `STATS_CACHE_SECONDS`, and the daily history at most every 6 hours. Each recompute reads one document per active installation, so the 50,000 reads/day free quota covers roughly 1,500 active installations at the default; raise `STATS_CACHE_SECONDS` for more. Writes (about four per installation per day at most) allow thousands of installations. **Privacy.** Vercel may keep request logs including IP addresses; the service itself never stores them (see [privacy](../docs/privacy.md)). Rate limiting is per serverless instance, so it is a best-effort guard; the body-size cap, the once-per-interval rule and the hourly new-installation cap still hold.

## Configuration

See `.env.example`. Notable settings: `RETENTION_DAYS` (at least 35, default 90) for per-installation rows, `AGGREGATE_RETENTION_DAYS` for counters, `MIN_GROUP_SIZE` for publication thresholds, and `GITHUB_REPO` / `GITHUB_TOKEN` for download counts. Set `GITHUB_REPO=` empty to disable GitHub access.

## Deleting data

A user's own deletion request removes their row. To erase everything, stop the service and delete the SQLite files (`stats.sqlite`, `-wal`, `-shm`), or delete the Firestore database.
