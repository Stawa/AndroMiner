import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { dayOf, monthOf } from './dates.mjs';
import { HISTORY_DAYS, tallyInstalls } from './stats.mjs';

const DAY = 86_400;

const schema = `
CREATE TABLE IF NOT EXISTS installs (
  id TEXT PRIMARY KEY,
  country TEXT,
  app_version TEXT,
  android_major INTEGER,
  variant TEXT,
  first_seen_ts INTEGER NOT NULL,
  last_seen_ts INTEGER NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS installs_last_seen ON installs (last_seen_ts);
CREATE TABLE IF NOT EXISTS daily_active (day TEXT PRIMARY KEY, count INTEGER NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS monthly_active (month TEXT PRIMARY KEY, count INTEGER NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS daily_versions (
  day TEXT NOT NULL, app_version TEXT NOT NULL, count INTEGER NOT NULL,
  PRIMARY KEY (day, app_version)
) STRICT;
CREATE TABLE IF NOT EXISTS download_snapshots (
  day TEXT PRIMARY KEY, total INTEGER NOT NULL, by_variant TEXT NOT NULL
) STRICT;
`;

/**
 * Older databases declared the shareable columns NOT NULL. SQLite cannot drop that constraint in
 * place, so the table is rebuilt once, keeping every row.
 */
const migrateNullableInstallColumns = (db) => {
  const strict = db.prepare('PRAGMA table_info(installs)').all();
  if (!strict.some((column) => column.notnull === 1 && column.name === 'app_version')) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      ALTER TABLE installs RENAME TO installs_old;
      DROP INDEX IF EXISTS installs_last_seen;
      CREATE TABLE installs (
        id TEXT PRIMARY KEY,
        country TEXT,
        app_version TEXT,
        android_major INTEGER,
        variant TEXT,
        first_seen_ts INTEGER NOT NULL,
        last_seen_ts INTEGER NOT NULL
      ) STRICT;
      INSERT INTO installs SELECT * FROM installs_old;
      DROP TABLE installs_old;
      CREATE INDEX installs_last_seen ON installs (last_seen_ts);
    `);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

/**
 * Self-hosted storage on a single SQLite file. Every method is async so it is interchangeable with
 * the Firestore store; `db` is exposed for tests and tooling.
 */
export const createSqliteStore = (path) => {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  db.exec(schema);
  migrateNullableInstallColumns(db);

  return {
    db,

    /**
     * Records one check-in. `counted` is false when the installation already checked in within the
     * minimum interval, so repeated requests never inflate any figure. `busy` is true when a new
     * installation would exceed the hourly cap.
     */
    async checkin(checkin, nowSeconds, { minIntervalSeconds, maxNewPerHour }) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const existing = db
          .prepare('SELECT last_seen_ts FROM installs WHERE id = ?')
          .get(checkin.installationId);
        if (existing && nowSeconds - existing.last_seen_ts < minIntervalSeconds) {
          db.exec('COMMIT');
          return { counted: false };
        }
        if (!existing) {
          const recent = db
            .prepare('SELECT COUNT(*) AS n FROM installs WHERE first_seen_ts >= ?')
            .get(nowSeconds - 3600).n;
          if (recent >= maxNewPerHour) {
            db.exec('COMMIT');
            return { busy: true };
          }
        }
        const today = dayOf(nowSeconds);
        const month = monthOf(nowSeconds);
        const newDay = !existing || dayOf(existing.last_seen_ts) !== today;
        const newMonth = !existing || monthOf(existing.last_seen_ts) !== month;

        db.prepare(
          `INSERT INTO installs (id, country, app_version, android_major, variant, first_seen_ts, last_seen_ts)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET country = excluded.country, app_version = excluded.app_version,
             android_major = excluded.android_major, variant = excluded.variant,
             last_seen_ts = excluded.last_seen_ts`
        ).run(
          checkin.installationId,
          checkin.country,
          checkin.appVersion,
          checkin.androidMajor,
          checkin.variant,
          nowSeconds,
          nowSeconds
        );
        if (newDay) {
          db.prepare(
            `INSERT INTO daily_active (day, count) VALUES (?, 1)
             ON CONFLICT(day) DO UPDATE SET count = count + 1`
          ).run(today);
          if (checkin.appVersion !== null) {
            db.prepare(
              `INSERT INTO daily_versions (day, app_version, count) VALUES (?, ?, 1)
               ON CONFLICT(day, app_version) DO UPDATE SET count = count + 1`
            ).run(today, checkin.appVersion);
          }
        }
        if (newMonth) {
          db.prepare(
            `INSERT INTO monthly_active (month, count) VALUES (?, 1)
             ON CONFLICT(month) DO UPDATE SET count = count + 1`
          ).run(month);
        }
        db.exec('COMMIT');
        return { counted: true, isNew: !existing };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },

    /** Removes the installation record. Published aggregate counters are not attributable to it. */
    async deleteInstallation(id) {
      db.prepare('DELETE FROM installs WHERE id = ?').run(id);
    },

    async readStatsInputs(nowSeconds) {
      const installs = db
        .prepare(
          `SELECT last_seen_ts AS lastSeen, country, app_version AS appVersion,
                  android_major AS androidMajor, variant
           FROM installs WHERE last_seen_ts >= ?`
        )
        .all(nowSeconds - 30 * DAY);
      const historyFrom = dayOf(nowSeconds - HISTORY_DAYS * DAY);
      return {
        ...tallyInstalls(installs, nowSeconds),
        dailyActive: db
          .prepare('SELECT day, count FROM daily_active WHERE day >= ? ORDER BY day')
          .all(historyFrom),
        monthlyActive: db.prepare('SELECT month, count FROM monthly_active ORDER BY month').all(),
        versionRows: db
          .prepare(
            'SELECT day, app_version AS appVersion, count FROM daily_versions WHERE day >= ? ORDER BY day'
          )
          .all(historyFrom),
        downloadHistory: db.prepare('SELECT day, total FROM download_snapshots ORDER BY day').all()
      };
    },

    async saveDownloadSnapshot(day, total, byVariant) {
      db.prepare(
        `INSERT INTO download_snapshots (day, total, by_variant) VALUES (?, ?, ?)
         ON CONFLICT(day) DO UPDATE SET total = excluded.total, by_variant = excluded.by_variant`
      ).run(day, total, JSON.stringify(byVariant));
    },

    async prune(nowSeconds, config) {
      db.prepare('DELETE FROM installs WHERE last_seen_ts < ?').run(
        nowSeconds - config.retentionDays * DAY
      );
      const cutoffDay = dayOf(nowSeconds - config.aggregateRetentionDays * DAY);
      db.prepare('DELETE FROM daily_active WHERE day < ?').run(cutoffDay);
      db.prepare('DELETE FROM daily_versions WHERE day < ?').run(cutoffDay);
      db.prepare('DELETE FROM download_snapshots WHERE day < ?').run(cutoffDay);
      db.prepare('DELETE FROM monthly_active WHERE month < ?').run(cutoffDay.slice(0, 7));
    }
  };
};
