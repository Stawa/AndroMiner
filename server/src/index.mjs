import { createApp } from './app.mjs';
import { loadConfig } from './config.mjs';
import { createSqliteStore } from './sqliteStore.mjs';

const config = loadConfig();
const app = createApp({ config, store: createSqliteStore(config.databasePath) });
const prune = () => app.prune().catch(() => {});
await prune();
setInterval(prune, 3_600_000).unref();

const server = app.listen();
server.on('listening', () => {
  console.log(`AndroMiner stats service listening on ${config.host}:${config.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
