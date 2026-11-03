# Contributing to usage statistics

Privacy comes first. AndroMiner must stay fully usable without telemetry.

## Rules

1. Telemetry is on by default only in the Android app. It must stay visible in Settings, revocable and deletable, and a saved opt-out is never overridden. Builds without `VITE_TELEMETRY_ENDPOINT` must not contain it.
2. Don't add payload fields. If you think one is needed, open an issue first. A new field needs a stated purpose, an update to `docs/privacy.md`, a change to the strict server schema, and a test change listing the exact keys.
3. Never read wallet, pool, worker, mining state, hashrate, sensors, hardware identifiers or location for telemetry.
4. Don't await telemetry on a startup or mining path. It must ignore its own errors and never log identifiers.
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

To point a development app at a local service, set `VITE_TELEMETRY_ENDPOINT=http://localhost:8787`. Plain HTTP is accepted only for localhost. Server tests are in `server/tests/`, client tests in `tests/telemetry-client.test.mjs`.
