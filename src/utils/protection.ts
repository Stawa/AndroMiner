import type {
  ProtectionEvent,
  ProtectionSnapshot,
  ProtectionState,
  ProtectionTrigger
} from '../types/mining';

export interface Explanation {
  key: string;
  params: Record<string, string | number>;
  /** Message key of the reading the sentence names, for the component to translate. */
  readingKey?: string;
}

const READING_LABEL: Record<ProtectionTrigger, string> = {
  battery_temperature: 'protection.batteryTemp',
  thermal_status: 'protection.androidThermal',
  battery_level: 'protection.battery',
  cpu_temperature: 'protection.cpuTemp',
  sensor_stale: 'protection.sensor',
  sensor_unavailable: 'protection.sensor',
  power_disconnected: 'protection.battery',
  screen_off: 'protection.sensor',
  none: 'protection.sensor'
};

const SENSOR_LABEL: Record<string, string> = {
  batteryTemperature: 'protection.batteryTemp',
  batteryPercent: 'protection.battery',
  androidThermalStatus: 'protection.androidThermal',
  cpuTemperature: 'protection.cpuTemp'
};

/** Message key of the reading a trigger refers to, for use in the restored/lost sentences. */
export const triggerLabelKey = (trigger: ProtectionTrigger): string =>
  READING_LABEL[trigger] ?? 'protection.sensor';

const formatReading = (value: number | null, unit: string | null): string => {
  if (value === null || !Number.isFinite(value)) return '-';
  const rounded = Math.round(value * 10) / 10;
  return unit === 'level' ? String(Math.round(value)) : `${rounded}${unit ? ` ${unit}` : ''}`;
};

/**
 * Maps one native event to a message key plus its parameters. The native layer sends codes, never
 * prose, so every language explains the same facts.
 */
export const explainEvent = (event: ProtectionEvent): Explanation => {
  const params = {
    from: event.previousIntensity,
    to: event.newIntensity,
    value: formatReading(event.value, event.unit),
    threshold: formatReading(event.threshold, event.unit)
  };
  switch (event.type) {
    case 'intensity_reduced':
      return { key: `protection.event.reduced.${event.trigger}`, params };
    case 'intensity_restored':
      return {
        key:
          event.newState === 'normal'
            ? 'protection.event.restoredFull'
            : 'protection.event.restoredPartial',
        params,
        readingKey: triggerLabelKey(event.trigger)
      };
    case 'mining_stopped': {
      const known = [
        'battery_temperature',
        'thermal_status',
        'battery_level',
        'cpu_temperature',
        'power_disconnected',
        'screen_off'
      ];
      return {
        key: `protection.event.stopped.${known.includes(event.trigger) ? event.trigger : 'sensor'}`,
        params
      };
    }
    case 'monitoring_unavailable':
      return {
        key: 'protection.event.monitoringLost',
        params,
        readingKey: (event.sensor && SENSOR_LABEL[event.sensor]) || triggerLabelKey(event.trigger)
      };
    default:
      return { key: 'protection.event.monitoringRestored', params };
  }
};

/** Freshness of one reading: 'live', 'stale' or 'never'. Age is -1 when it never reported. */
export const freshness = (
  ageMs: number | undefined,
  staleAfterMs: number
): { status: 'live' | 'stale' | 'never'; seconds: number } => {
  if (ageMs === undefined || ageMs < 0) return { status: 'never', seconds: 0 };
  return {
    status: ageMs > staleAfterMs ? 'stale' : 'live',
    seconds: Math.round(ageMs / 1000)
  };
};

/**
 * Distance between the battery temperature and the user's limit. Only defensible when both exist;
 * a disabled limit (0) or a missing reading yields null instead of an invented number.
 */
export const thermalHeadroomC = (
  batteryTemperatureC: number | null,
  limitC: number
): number | null =>
  batteryTemperatureC === null || !Number.isFinite(batteryTemperatureC) || limitC <= 0
    ? null
    : Math.round((limitC - batteryTemperatureC) * 10) / 10;

export const stateTone = (state: ProtectionState | null): 'accent' | 'warn' | 'danger' | 'muted' =>
  state === 'critical'
    ? 'danger'
    : state === 'throttled' || state === 'caution'
      ? 'warn'
      : state === 'normal'
        ? 'accent'
        : 'muted';

export const isActiveProtection = (snapshot: ProtectionSnapshot | null): boolean =>
  snapshot !== null && snapshot.state !== 'normal';
