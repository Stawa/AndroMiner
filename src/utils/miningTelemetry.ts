/** XMRig total[0] is the 10-second speed. Zero is valid; null is warming up. */
export const nonNegative = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

export const readHashrates = (value: unknown) => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const totals = Array.isArray(record.total) ? record.total : [];
  return {
    current: nonNegative(totals[0]),
    average: nonNegative(totals[1]),
    peak: nonNegative(record.highest)
  };
};

export const isFresh = (timestamp: unknown, now: number, maxAge = 10000): boolean =>
  typeof timestamp === 'number' && timestamp > 0 && now >= timestamp && now - timestamp <= maxAge;

export const formatSensor = (value: number | null, unit: string): string =>
  nonNegative(value) === null ? '—' : `${Math.round(value!)}${unit}`;

export const formatHashrate = (value: number | null): string => {
  if (nonNegative(value) === null) return '—';
  value = value!;
  const divisor = value >= 1e6 ? 1e6 : value >= 1e3 ? 1e3 : 1;
  return `${(value / divisor).toFixed(1)} ${divisor === 1e6 ? 'MH/s' : divisor === 1e3 ? 'kH/s' : 'H/s'}`;
};
