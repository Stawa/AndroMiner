import { FieldValue } from '@google-cloud/firestore';
import { dayOf, monthOf } from './dates.mjs';
import { creditHeartbeat } from './heartbeat.mjs';
import { publicIdOf } from './identity.mjs';
import { HISTORY_DAYS, tallyInstalls } from './stats.mjs';

const DAY = 86_400;
const BATCH_SIZE = 400;
// Daily history only changes through the day's own counters, so it is re-read rarely.
const HISTORY_CACHE_SECONDS = 6 * 3600;
// The leaderboard follows live heartbeats, so it is recomputed at most once a minute.
const LEADERBOARD_CACHE_SECONDS = 60;

/**
 * Firestore storage for hosts without a persistent disk (Vercel); same contract as the SQLite store.
 * Firestore has no GROUP BY, so figures are tallied in memory and cached in `meta/*` to stay within
 * the free read quota. Only server credentials may touch these collections (see firestore.rules).
 */
export const createFirestoreStore = ({ firestore, statsCacheSeconds = 3600 }) => {
  const installs = firestore.collection('installs');
  const dailyActive = firestore.collection('daily_active');
  const monthlyActive = firestore.collection('monthly_active');
  const dailyVersions = firestore.collection('daily_versions');
  const snapshots = firestore.collection('download_snapshots');
  const benchmarks = firestore.collection('benchmarks');
  const meta = firestore.collection('meta');

  const cached = async (name, ttlSeconds, nowSeconds, compute) => {
    const ref = meta.doc(name);
    const snap = await ref.get();
    if (snap.exists && nowSeconds - snap.get('computedAt') < ttlSeconds) {
      return JSON.parse(snap.get('value'));
    }
    const value = await compute();
    await ref.set({ computedAt: nowSeconds, value: JSON.stringify(value) });
    return value;
  };

  const deleteWhere = async (query) => {
    for (;;) {
      const snap = await query.limit(BATCH_SIZE).get();
      if (snap.empty) return;
      const batch = firestore.batch();
      for (const doc of snap.docs) batch.delete(doc.ref);
      await batch.commit();
    }
  };

  return {
    async checkin(checkin, nowSeconds, { minIntervalSeconds, maxNewPerHour }) {
      const ref = installs.doc(checkin.installationId);
      if (!(await ref.get()).exists) {
        const recent = await installs
          .where('firstSeen', '>=', nowSeconds - 3600)
          .count()
          .get();
        if (recent.data().count >= maxNewPerHour) return { busy: true };
      }
      return firestore.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const existing = snap.exists ? snap.data() : null;
        if (existing && nowSeconds - existing.lastSeen < minIntervalSeconds) {
          // Never counted again, but a change to what the user shares applies immediately: turning
          // activity on must start crediting heartbeats, and turning anything off must erase it.
          const sharesActivity = checkin.miningSeconds !== null;
          const wasSharing = existing.verifiedSeconds != null;
          tx.set(
            ref,
            {
              country: checkin.country,
              appVersion: checkin.appVersion,
              androidMajor: checkin.androidMajor,
              variant: checkin.variant,
              verifiedSeconds: sharesActivity ? (existing.verifiedSeconds ?? 0) : null,
              acceptedShares:
                sharesActivity && wasSharing ? existing.acceptedShares : checkin.acceptedShares
            },
            { merge: true }
          );
          return { counted: false };
        }
        const today = dayOf(nowSeconds);
        const month = monthOf(nowSeconds);
        tx.set(ref, {
          country: checkin.country,
          appVersion: checkin.appVersion,
          androidMajor: checkin.androidMajor,
          variant: checkin.variant,
          // The reported miningSeconds only says whether activity is shared (null means it is not).
          // Ranked time comes from heartbeats alone, so a client cannot write it here.
          verifiedSeconds: checkin.miningSeconds === null ? null : (existing?.verifiedSeconds ?? 0),
          lastBeat: existing?.lastBeat ?? null,
          acceptedShares: checkin.acceptedShares,
          firstSeen: existing?.firstSeen ?? nowSeconds,
          lastSeen: nowSeconds
        });
        if (!existing || dayOf(existing.lastSeen) !== today) {
          tx.set(
            dailyActive.doc(today),
            { day: today, count: FieldValue.increment(1) },
            { merge: true }
          );
          if (checkin.appVersion !== null) {
            tx.set(
              dailyVersions.doc(`${today}_${checkin.appVersion}`),
              { day: today, appVersion: checkin.appVersion, count: FieldValue.increment(1) },
              { merge: true }
            );
          }
        }
        if (!existing || monthOf(existing.lastSeen) !== month) {
          tx.set(
            monthlyActive.doc(month),
            { month, count: FieldValue.increment(1) },
            { merge: true }
          );
        }
        return { counted: true, isNew: !existing };
      });
    },

    /** Credits one heartbeat. Never creates a record or revives an opt-out. */
    async heartbeat(id, nowSeconds) {
      const ref = installs.doc(id);
      return firestore.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : null;
        if (!data || data.verifiedSeconds == null) return { counted: false };
        const credit = creditHeartbeat(data.lastBeat ?? null, nowSeconds);
        if (credit === null) return { counted: false };
        tx.set(
          ref,
          { verifiedSeconds: data.verifiedSeconds + credit, lastBeat: nowSeconds },
          { merge: true }
        );
        return { counted: true };
      });
    },

    async deleteInstallation(id) {
      await installs.doc(id).delete();
    },

    async readStatsInputs(nowSeconds) {
      const [live, history] = await Promise.all([
        cached('live', statsCacheSeconds, nowSeconds, async () => {
          const snap = await installs
            .where('lastSeen', '>=', nowSeconds - 30 * DAY)
            .select('lastSeen', 'country', 'appVersion', 'androidMajor', 'variant')
            .get();
          return tallyInstalls(
            snap.docs.map((doc) => doc.data()),
            nowSeconds
          );
        }),
        cached('history', HISTORY_CACHE_SECONDS, nowSeconds, async () => {
          const historyFrom = dayOf(nowSeconds - HISTORY_DAYS * DAY);
          const [daily, monthly, versions, downloads] = await Promise.all([
            dailyActive.where('day', '>=', historyFrom).orderBy('day').get(),
            monthlyActive.orderBy('month').get(),
            dailyVersions.where('day', '>=', historyFrom).orderBy('day').get(),
            snapshots.orderBy('day').get()
          ]);
          return {
            dailyActive: daily.docs.map((doc) => ({
              day: doc.get('day'),
              count: doc.get('count')
            })),
            monthlyActive: monthly.docs.map((doc) => ({
              month: doc.get('month'),
              count: doc.get('count')
            })),
            versionRows: versions.docs.map((doc) => ({
              day: doc.get('day'),
              appVersion: doc.get('appVersion'),
              count: doc.get('count')
            })),
            downloadHistory: downloads.docs.map((doc) => ({
              day: doc.get('day'),
              total: doc.get('total')
            }))
          };
        })
      ]);
      return { ...live, ...history };
    },

    async readLeaderboard(limit, nowSeconds) {
      return cached('leaderboard', LEADERBOARD_CACHE_SECONDS, nowSeconds, async () => {
        const snap = await installs
          .orderBy('verifiedSeconds', 'desc')
          .limit(limit)
          .select('country', 'verifiedSeconds', 'acceptedShares')
          .get();
        return snap.docs
          .filter((doc) => (doc.get('verifiedSeconds') ?? 0) > 0)
          .map((doc) => ({
            id: publicIdOf(doc.id),
            country: doc.get('country') ?? null,
            miningSeconds: doc.get('verifiedSeconds'),
            acceptedShares: doc.get('acceptedShares') ?? null
          }));
      });
    },

    /** `busy` means the hourly cap on submissions is reached. */
    async addBenchmark(benchmark, nowSeconds, { maxPerHour }) {
      const recent = await benchmarks
        .where('ts', '>=', nowSeconds - 3600)
        .count()
        .get();
      if (recent.data().count >= maxPerHour) return { busy: true };
      await benchmarks.add({ ts: nowSeconds, ...benchmark });
      return { stored: true };
    },

    async readBenchmarkRows(sinceSeconds, nowSeconds) {
      // Cached with the other figures: every submission is a document, so each read is costly.
      return cached('benchmarks', statsCacheSeconds, nowSeconds, async () => {
        const snap = await benchmarks
          .where('ts', '>=', sinceSeconds)
          .select('device', 'soc', 'abi', 'cpuThreads', 'hashrate')
          .get();
        return snap.docs.map((doc) => doc.data());
      });
    },

    async saveDownloadSnapshot(day, total, byVariant) {
      await snapshots.doc(day).set({ day, total, byVariant });
    },

    async prune(nowSeconds, config) {
      await deleteWhere(installs.where('lastSeen', '<', nowSeconds - config.retentionDays * DAY));
      await deleteWhere(benchmarks.where('ts', '<', nowSeconds - config.retentionDays * DAY));
      const cutoffDay = dayOf(nowSeconds - config.aggregateRetentionDays * DAY);
      for (const collection of [dailyActive, dailyVersions, snapshots]) {
        await deleteWhere(collection.where('day', '<', cutoffDay));
      }
      await deleteWhere(monthlyActive.where('month', '<', cutoffDay.slice(0, 7)));
    }
  };
};
