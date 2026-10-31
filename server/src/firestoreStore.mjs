import { FieldValue } from '@google-cloud/firestore';
import { dayOf, monthOf } from './dates.mjs';
import { HISTORY_DAYS, tallyInstalls } from './stats.mjs';

const DAY = 86_400;
const BATCH_SIZE = 400;
// Daily history only changes through the day's own counters, so it is re-read rarely.
const HISTORY_CACHE_SECONDS = 6 * 3600;

/**
 * Storage on Firestore, for hosts without a persistent disk (Vercel). Same contract as the SQLite
 * store. Firestore has no GROUP BY, so figures are tallied in memory from the recently active
 * installations and cached in `meta/*` documents; this keeps reads within the free daily quota.
 * Only server credentials may touch these collections (see firestore.rules).
 */
export const createFirestoreStore = ({ firestore, statsCacheSeconds = 3600 }) => {
  const installs = firestore.collection('installs');
  const dailyActive = firestore.collection('daily_active');
  const monthlyActive = firestore.collection('monthly_active');
  const dailyVersions = firestore.collection('daily_versions');
  const snapshots = firestore.collection('download_snapshots');
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
          return { counted: false };
        }
        const today = dayOf(nowSeconds);
        const month = monthOf(nowSeconds);
        tx.set(ref, {
          country: checkin.country,
          appVersion: checkin.appVersion,
          androidMajor: checkin.androidMajor,
          variant: checkin.variant,
          firstSeen: existing?.firstSeen ?? nowSeconds,
          lastSeen: nowSeconds
        });
        if (!existing || dayOf(existing.lastSeen) !== today) {
          tx.set(
            dailyActive.doc(today),
            { day: today, count: FieldValue.increment(1) },
            { merge: true }
          );
          tx.set(
            dailyVersions.doc(`${today}_${checkin.appVersion}`),
            { day: today, appVersion: checkin.appVersion, count: FieldValue.increment(1) },
            { merge: true }
          );
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

    async saveDownloadSnapshot(day, total, byVariant) {
      await snapshots.doc(day).set({ day, total, byVariant });
    },

    async prune(nowSeconds, config) {
      await deleteWhere(installs.where('lastSeen', '<', nowSeconds - config.retentionDays * DAY));
      const cutoffDay = dayOf(nowSeconds - config.aggregateRetentionDays * DAY);
      for (const collection of [dailyActive, dailyVersions, snapshots]) {
        await deleteWhere(collection.where('day', '<', cutoffDay));
      }
      await deleteWhere(monthlyActive.where('month', '<', cutoffDay.slice(0, 7)));
    }
  };
};
