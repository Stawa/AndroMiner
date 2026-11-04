import { Device } from '@capacitor/device';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { onMounted, onUnmounted, reactive } from 'vue';
import type { DeviceTelemetry } from '../types/mining';
import { t } from '../i18n';

interface WebBatteryManager {
  level: number;
  charging: boolean;
}

type NavigatorWithBattery = Navigator & {
  getBattery?: () => Promise<WebBatteryManager>;
};

interface NativeDeviceStatus {
  batteryLevel?: number | null;
  isCharging: boolean;
  cpuThreads: number;
  cpuName?: string;
  cpuClockGhz?: number | null;
  cpuClockLabel?: string;
  cpuMaxClockGhz?: number | null;
  cpuMaxClockLabel?: string;
  gpuName?: string;
  batteryCurrentMa?: number | null;
  batteryVoltageV?: number | null;
  powerDrawW?: number | null;
  temperatureC?: number;
  temperatureSource?: DeviceTelemetry['thermalSource'];
  temperatureSensor?: string;
  thermalStatus: DeviceTelemetry['thermalStatus'];
  sampledAt?: number;
  batteryTemperatureC?: number | null;
  androidThermalStatus?: DeviceTelemetry['androidThermalStatus'];
  cpuTemperatureC?: number | null;
  cpuTemperatureSensor?: string | null;
}

interface DeviceStatusPlugin {
  getStatus: () => Promise<NativeDeviceStatus>;
}

const DeviceStatus = registerPlugin<DeviceStatusPlugin>('DeviceStatus');

const getHardwareConcurrency = (): number =>
  typeof navigator !== 'undefined' && navigator.hardwareConcurrency
    ? navigator.hardwareConcurrency
    : 4;

const getDeviceMemory = (): number | null => {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null;
};

const getWebBattery = async (): Promise<WebBatteryManager | null> => {
  const nav = navigator as NavigatorWithBattery;

  if (typeof nav.getBattery !== 'function') {
    return null;
  }

  try {
    return await nav.getBattery();
  } catch {
    return null;
  }
};

const getNativeDeviceStatus = async (): Promise<NativeDeviceStatus | null> => {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    return await DeviceStatus.getStatus();
  } catch {
    return null;
  }
};

export const useDeviceTelemetry = () => {
  let refreshHandle = 0;
  let refreshing = false;
  let disposed = false;
  const refreshIntervalMs = 3000;

  const device = reactive<DeviceTelemetry>({
    platform: 'web',
    model: t('device.androidDevice'),
    operatingSystem: 'unknown',
    osVersion: '',
    manufacturer: 'unknown',
    batteryLevel: null,
    isCharging: false,
    cpuThreads: getHardwareConcurrency(),
    cpuName: t('device.androidCpu'),
    cpuClockGhz: null,
    cpuClockLabel: '-',
    cpuMaxClockGhz: null,
    cpuMaxClockLabel: '-',
    gpuName: 'Android GPU',
    batteryCurrentMa: null,
    batteryVoltageV: null,
    powerDrawW: null,
    deviceMemoryGb: getDeviceMemory(),
    temperatureC: null,
    thermalStatus: 'unknown',
    thermalSource: 'unavailable',
    thermalSensorName: null,
    batteryTemperatureC: null,
    androidThermalStatus: 'unavailable',
    cpuTemperatureC: null,
    cpuTemperatureSensor: null,
    sampledAt: null
  });

  const refresh = async (): Promise<void> => {
    if (refreshing || disposed || document.visibilityState === 'hidden') return;
    refreshing = true;
    try {
      const [info, battery, webBattery, nativeStatus] = await Promise.all([
        Device.getInfo(),
        Device.getBatteryInfo().catch(() => ({ batteryLevel: undefined, isCharging: undefined })),
        getWebBattery(),
        getNativeDeviceStatus()
      ]);
      const nativeLevel =
        typeof nativeStatus?.batteryLevel === 'number' &&
        Number.isFinite(nativeStatus.batteryLevel) &&
        nativeStatus.batteryLevel >= 0 &&
        nativeStatus.batteryLevel <= 1
          ? Math.round(nativeStatus.batteryLevel * 100)
          : null;
      const capacitorLevel =
        typeof battery.batteryLevel === 'number' ? Math.round(battery.batteryLevel * 100) : null;
      const webLevel =
        typeof webBattery?.level === 'number' ? Math.round(webBattery.level * 100) : null;
      const capacitorCharging =
        typeof battery.isCharging === 'boolean' ? battery.isCharging : undefined;
      const webCharging =
        typeof webBattery?.charging === 'boolean' ? webBattery.charging : undefined;

      device.platform = info.platform;
      device.model = info.model || t('device.androidDevice');
      device.operatingSystem = info.operatingSystem;
      device.osVersion = info.osVersion;
      device.manufacturer = info.manufacturer || 'unknown';
      device.cpuThreads = nativeStatus?.cpuThreads || getHardwareConcurrency();
      device.cpuName =
        nativeStatus?.cpuName ||
        [info.manufacturer, info.model].filter(Boolean).join(' ') ||
        t('device.androidCpu');
      device.cpuClockGhz =
        typeof nativeStatus?.cpuClockGhz === 'number' ? nativeStatus.cpuClockGhz : null;
      device.cpuClockLabel = nativeStatus?.cpuClockLabel || '-';
      device.cpuMaxClockGhz =
        typeof nativeStatus?.cpuMaxClockGhz === 'number' ? nativeStatus.cpuMaxClockGhz : null;
      device.cpuMaxClockLabel = nativeStatus?.cpuMaxClockLabel || '-';
      device.gpuName = nativeStatus?.gpuName || 'Android GPU';
      device.batteryCurrentMa =
        typeof nativeStatus?.batteryCurrentMa === 'number'
          ? Number(nativeStatus.batteryCurrentMa.toFixed(0))
          : null;
      device.batteryVoltageV =
        typeof nativeStatus?.batteryVoltageV === 'number'
          ? Number(nativeStatus.batteryVoltageV.toFixed(2))
          : null;
      device.powerDrawW =
        typeof nativeStatus?.powerDrawW === 'number'
          ? Number(nativeStatus.powerDrawW.toFixed(2))
          : null;
      device.deviceMemoryGb = getDeviceMemory();
      device.batteryLevel = nativeStatus ? nativeLevel : (capacitorLevel ?? webLevel ?? null);
      device.isCharging = nativeStatus?.isCharging ?? Boolean(capacitorCharging || webCharging);
      device.temperatureC =
        typeof nativeStatus?.temperatureC === 'number'
          ? Number(nativeStatus.temperatureC.toFixed(1))
          : null;
      device.thermalStatus = nativeStatus?.thermalStatus || 'unavailable';
      device.thermalSource = nativeStatus?.temperatureSource || 'unavailable';
      device.thermalSensorName = nativeStatus?.temperatureSensor || null;
      device.batteryTemperatureC =
        typeof nativeStatus?.batteryTemperatureC === 'number'
          ? Number(nativeStatus.batteryTemperatureC.toFixed(1))
          : null;
      device.androidThermalStatus = nativeStatus?.androidThermalStatus || 'unavailable';
      device.cpuTemperatureC =
        typeof nativeStatus?.cpuTemperatureC === 'number'
          ? Number(nativeStatus.cpuTemperatureC.toFixed(1))
          : null;
      device.cpuTemperatureSensor = nativeStatus?.cpuTemperatureSensor || null;
      device.sampledAt =
        typeof nativeStatus?.sampledAt === 'number' ? nativeStatus.sampledAt : null;
    } catch {
      device.batteryLevel = null;
      device.cpuThreads = getHardwareConcurrency();
      device.cpuName = t('device.androidCpu');
      device.cpuClockGhz = null;
      device.cpuClockLabel = '-';
      device.cpuMaxClockGhz = null;
      device.cpuMaxClockLabel = '-';
      device.gpuName = 'Android GPU';
      device.batteryCurrentMa = null;
      device.batteryVoltageV = null;
      device.powerDrawW = null;
      device.deviceMemoryGb = getDeviceMemory();
      device.temperatureC = null;
      device.thermalStatus = 'unavailable';
      device.thermalSource = 'unavailable';
      device.thermalSensorName = null;
      device.batteryTemperatureC = null;
      device.androidThermalStatus = 'unavailable';
      device.cpuTemperatureC = null;
      device.cpuTemperatureSensor = null;
      device.sampledAt = null;
    } finally {
      refreshing = false;
    }
  };

  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') void refresh();
  };

  onMounted(() => {
    void refresh();
    refreshHandle = window.setInterval(() => {
      void refresh();
    }, refreshIntervalMs);

    document.addEventListener('visibilitychange', onVisibilityChange);
  });

  onUnmounted(() => {
    disposed = true;
    window.clearInterval(refreshHandle);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  });

  return {
    device,
    refresh
  };
};
