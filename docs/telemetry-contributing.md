# Contributing to usage statistics

Privacy comes before statistics. Any change here must leave AndroMiner fully usable without telemetry.

## Rules

1. Telemetry is on by default only in the Android app, and it must stay visible in Settings, revocable and deletable. A saved opt-out is never overridden. Builds without `VITE_TELEMETRY_ENDPOINT` must not contain it.
2. Don't add fields to the payload. If you think one is needed, open an issue first. A new field needs a stated purpose, an update to `docs/privacy.md`, a change to the strict server schema, and a test change that lists the exact keys.
3. Never read wallet, pool, worker, mining state, hashrate, sensors, hardware identifiers or location for telemetry.
4. Telemetry code must not be awaited on a startup or mining path. It must ignore its own errors and must not log identifiers.
5. No analytics SDKs, accounts, advertising IDs or fingerprinting.
6. Don't touch the engine, CPU protection or the background service.

## Working on it

```bash
npm test                 # app + server tests
npm run lint
npm run build            # web build
npm run build:stats      # public statistics page → dist-stats/
cd server && node src/index.mjs   # run the service (Node 22.13+)
```

To point a development app at a local service, set `VITE_TELEMETRY_ENDPOINT=http://localhost:8787`. Plain HTTP is accepted only for localhost. Server tests are in `server/tests/` and client tests are in `tests/telemetry-client.test.mjs`.
