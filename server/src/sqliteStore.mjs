import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { dayOf, monthOf } from './dates.mjs';
import { creditHeartbeat } from './heartbeat.mjs';
import { publicIdOf } from './identity.mjs';
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
  last_seen_ts INTEGER NOT NULL,
  mining_seconds INTEGER,
  accepted_shares INTEGER
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
      INSERT INTO installs (id, country, app_version, android_major, variant, first_seen_ts, last_seen_ts)
        SELECT id, country, app_version, android_major, variant, first_seen_ts, last_seen_ts
        FROM installs_old;
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
 * Databases created before the leaderboard gain its nullable columns in place. `mining_seconds` is
 * the retired self-reported total; `verified_seconds` and `last_beat_ts` come from heartbeats.
 */
const migrateActivityColumns = (db) => {
  const columns = db.prepare('PRAGMA table_info(installs)').all();
  for (const name of ['mining_seconds', 'accepted_shares', 'verified_seconds', 'last_beat_ts']) {
    if (!columns.some((column) => column.name === name)) {
      db.exec(`ALTER TABLE installs ADD COLUMN ${name} INTEGER`);
    }
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
  migrateActivityColumns(db);

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

        // The reported miningSeconds only says whether activity is shared (null means it is not).
        // Ranked time comes from heartbeats alone, so a client cannot write it here.
        const sharesActivity = checkin.miningSeconds !== null;
        db.prepare(
          `INSERT INTO installs (id, country, app_version, android_major, variant, first_seen_ts, last_seen_ts,
                                 verified_seconds, accepted_shares)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET country = excluded.country, app_version = excluded.app_version,
             android_major = excluded.android_major, variant = excluded.variant,
             last_seen_ts = excluded.last_seen_ts,
             verified_seconds = CASE WHEN excluded.verified_seconds IS NULL THEN NULL
                                     ELSE COALESCE(installs.verified_seconds, 0) END,
             accepted_shares = excluded.accepted_shares`
        ).run(
          checkin.installationId,
          checkin.country,
          checkin.appVersion,
          checkin.androidMajor,
          checkin.variant,
          nowSeconds,
          nowSeconds,
          sharesActivity ? 0 : null,
          checkin.acceptedShares
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

    /**
     * Credits mining time for one heartbeat. Only installations that already checked in and share
     * their activity count, so a heartbeat can never create a record or revive an opt-out.
     */
    async heartbeat(id, nowSeconds) {
      const row = db
        .prepare(
          'SELECT verified_seconds AS seconds, last_beat_ts AS lastBeat FROM installs WHERE id = ?'
        )
        .get(id);
      if (!row || row.seconds === null) return { counted: false };
      const credit = creditHeartbeat(row.lastBeat, nowSeconds);
      if (credit === null) return { counted: false };
      db.prepare(
        'UPDATE installs SET verified_seconds = verified_seconds + ?, last_beat_ts = ? WHERE id = ?'
      ).run(credit, nowSeconds, id);
      return { counted: true };
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

    /** The installations that share their activity, longest measured mining time first. */
    async readLeaderboard(limit) {
      return db
        .prepare(
          `SELECT id, country, verified_seconds AS miningSeconds, accepted_shares AS acceptedShares
           FROM installs WHERE verified_seconds > 0
           ORDER BY verified_seconds DESC, first_seen_ts ASC, id ASC LIMIT ?`
        )
        .all(limit)
        .map(({ id, ...entry }) => ({ id: publicIdOf(id), ...entry }));
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
