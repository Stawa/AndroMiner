# Contributing to usage statistics

Privacy is more important than statistics. Changes in this area must keep AndroMiner fully usable without telemetry.

## Rules

1. Telemetry stays **off by default**, opt-in, revocable and absent from builds without `VITE_TELEMETRY_ENDPOINT`.
2. Do not add fields to the payload. If you believe one is necessary, open an issue first. It needs a stated purpose, an update to `docs/privacy.md`, the strict server schema, and a changed test that lists the exact key set.
3. Never read wallet, pool, worker, mining state, hashrate, sensors, hardware identifiers or location for telemetry.
4. Telemetry code must not be awaited on a startup or mining path, must swallow its own errors, and must not log identifiers.
5. No analytics SDKs, accounts, advertising IDs or fingerprinting.
6. Keep the engine, CPU protection and background service untouched.

## Working on it

```bash
npm test                 # app + server tests
npm run lint
npm run build            # web build
npm run build:stats      # public statistics page → dist-stats/
cd server && node src/index.mjs   # run the service (Node 22.13+)
```

Point a development app at a local service with `VITE_TELEMETRY_ENDPOINT=http://localhost:8787` (plain HTTP is accepted only for localhost). Server tests live in `server/tests/`, client tests in `tests/telemetry-client.test.mjs`.
