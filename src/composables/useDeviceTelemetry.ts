import { Device } from '@capacitor/device';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { onMounted, onUnmounted, reactive } from 'vue';
import type { DeviceTelemetry } from '../types/mining';

interface WebBatteryManager {
  level: number;
  charging: boolean;
}

type NavigatorWithBattery = Navigator & {
  getBattery?: () => Promise<WebBatteryManager>;
};

interface NativeDeviceStatus {
  batteryLevel: number;
  isCharging: boolean;
  cpuThreads: number;
  cpuName?: string;
  cpuClockGhz?: number | null;
  cpuClockLabel?: string;
  gpuName?: string;
  gpuClockMhz?: number | null;
  gpuClockLabel?: string;
  temperatureC?: number;
  temperatureSource?: DeviceTelemetry['thermalSource'];
  temperatureSensor?: string;
  thermalStatus: DeviceTelemetry['thermalStatus'];
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

const estimateThermalStatus = (
  batteryLevel: number,
  isCharging: boolean
): DeviceTelemetry['thermalStatus'] => {
  if (isCharging && batteryLevel > 85) {
    return 'warm';
  }

  return 'normal';
};

export const useDeviceTelemetry = () => {
  let refreshHandle = 0;

  const device = reactive<DeviceTelemetry>({
    platform: 'web',
    model: 'Android device',
    operatingSystem: 'unknown',
    osVersion: '',
    manufacturer: 'unknown',
    batteryLevel: 100,
    isCharging: false,
    cpuThreads: getHardwareConcurrency(),
    cpuName: 'Android CPU',
    cpuClockGhz: null,
    cpuClockLabel: '-',
    gpuName: 'Android GPU',
    gpuClockMhz: null,
    gpuClockLabel: '-',
    deviceMemoryGb: getDeviceMemory(),
    temperatureC: null,
    thermalStatus: 'unknown',
    thermalSource: 'estimated',
    thermalSensorName: null
  });

  const refresh = async (): Promise<void> => {
    try {
      const [info, battery, webBattery, nativeStatus] = await Promise.all([
        Device.getInfo(),
        Device.getBatteryInfo(),
        getWebBattery(),
        getNativeDeviceStatus()
      ]);
      const nativeLevel =
        typeof nativeStatus?.batteryLevel === 'number'
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
      device.model = info.model || 'Android device';
      device.operatingSystem = info.operatingSystem;
      device.osVersion = info.osVersion;
      device.manufacturer = info.manufacturer || 'unknown';
      device.cpuThreads = nativeStatus?.cpuThreads || getHardwareConcurrency();
      device.cpuName =
        nativeStatus?.cpuName ||
        [info.manufacturer, info.model].filter(Boolean).join(' ') ||
        'Android CPU';
      device.cpuClockGhz =
        typeof nativeStatus?.cpuClockGhz === 'number' ? nativeStatus.cpuClockGhz : null;
      device.cpuClockLabel = nativeStatus?.cpuClockLabel || '-';
      device.gpuName = nativeStatus?.gpuName || 'Android GPU';
      device.gpuClockMhz =
        typeof nativeStatus?.gpuClockMhz === 'number' ? nativeStatus.gpuClockMhz : null;
      device.gpuClockLabel = nativeStatus?.gpuClockLabel || '-';
      device.deviceMemoryGb = getDeviceMemory();
      device.batteryLevel = nativeLevel ?? capacitorLevel ?? webLevel ?? device.batteryLevel;
      device.isCharging = nativeStatus?.isCharging ?? Boolean(capacitorCharging || webCharging);
      device.temperatureC =
        typeof nativeStatus?.temperatureC === 'number'
          ? Number(nativeStatus.temperatureC.toFixed(1))
          : nativeStatus
            ? null
            : device.temperatureC;
      device.thermalStatus =
        nativeStatus?.thermalStatus ||
        estimateThermalStatus(device.batteryLevel, device.isCharging);
      device.thermalSource =
        nativeStatus?.temperatureSource || (nativeStatus ? 'native' : 'estimated');
      device.thermalSensorName = nativeStatus?.temperatureSensor || null;
    } catch {
      device.cpuThreads = getHardwareConcurrency();
      device.cpuName = 'Android CPU';
      device.cpuClockGhz = null;
      device.cpuClockLabel = '-';
      device.gpuName = 'Android GPU';
      device.gpuClockMhz = null;
      device.gpuClockLabel = '-';
      device.deviceMemoryGb = getDeviceMemory();
      device.temperatureC = null;
      device.thermalStatus = 'unavailable';
      device.thermalSource = 'unavailable';
      device.thermalSensorName = null;
    }
  };

  onMounted(() => {
    void refresh();
    refreshHandle = window.setInterval(() => {
      void refresh();
    }, 10000);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    });
  });

  onUnmounted(() => {
    window.clearInterval(refreshHandle);
  });

  return {
    device,
    refresh
  };
};
