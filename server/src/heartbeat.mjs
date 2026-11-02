// The app sends a heartbeat every 60 s while it mines. Mining time is whatever the server measures
// between heartbeats, never a number the client reports, so it cannot grow faster than the clock.
const MIN_GAP_SECONDS = 30;
const MAX_GAP_SECONDS = 300;

/**
 * Decides what a heartbeat is worth, given the previous one's server time (or null).
 * Returns null when it came too soon to count (nothing is written), otherwise the seconds to add.
 * The first beat after a long silence only starts the clock: the gap before it is not credited.
 */
export const creditHeartbeat = (lastBeat, nowSeconds) => {
  if (lastBeat === null) return 0;
  const gap = nowSeconds - lastBeat;
  if (gap < MIN_GAP_SECONDS) return null;
  return gap <= MAX_GAP_SECONDS ? gap : 0;
};
