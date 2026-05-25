import { defineStore } from 'pinia';

const settingsKey = 'androminer-settings';

export interface NotificationSettings {
  miningStatus: boolean;
  shareAccepted: boolean;
  thermalWarning: boolean;
  batteryWarning: boolean;
  poolDisconnect: boolean;
}

export interface BatterySafetySettings {
  stopBelowPercent: number;
  mineOnlyCharging: boolean;
}

export interface PerformanceSettings {
  preferLittleCores: boolean;
  backgroundThrottle: boolean;
  adaptiveIntensity: boolean;
  animationsEnabled: boolean;
}

export interface UpdateSettings {
  autoUpdate: boolean;
}

export interface SettingsState {
  notifications: NotificationSettings;
  autoStart: boolean;
  autoResume: boolean;
  thermalThreshold: number;
  batterySafety: BatterySafetySettings;
  performance: PerformanceSettings;
  updates: UpdateSettings;
}

const defaultSettings = (): SettingsState => ({
  notifications: {
    miningStatus: true,
    shareAccepted: true,
    thermalWarning: true,
    batteryWarning: true,
    poolDisconnect: true
  },
  autoStart: false,
  autoResume: true,
  thermalThreshold: 72,
  batterySafety: {
    stopBelowPercent: 25,
    mineOnlyCharging: false
  },
  performance: {
    preferLittleCores: true,
    backgroundThrottle: true,
    adaptiveIntensity: true,
    animationsEnabled: true
  },
  updates: {
    autoUpdate: true
  }
});

const normalizeSettings = (settings: Partial<SettingsState>): SettingsState => {
  const defaults = defaultSettings();

  return {
    ...defaults,
    ...settings,
    notifications: {
      ...defaults.notifications,
      ...settings.notifications
    },
    batterySafety: {
      ...defaults.batterySafety,
      ...settings.batterySafety
    },
    performance: {
      ...defaults.performance,
      ...settings.performance
    },
    updates: {
      ...defaults.updates,
      ...settings.updates
    }
  };
};

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => defaultSettings(),
  actions: {
    load(): void {
      try {
        const raw = localStorage.getItem(settingsKey);
        if (!raw) {
          return;
        }

        const parsed = JSON.parse(raw) as Partial<SettingsState>;
        this.$patch(normalizeSettings(parsed));
      } catch {
        this.$patch(defaultSettings());
      }
    },
    persist(): void {
      localStorage.setItem(settingsKey, JSON.stringify(this.$state));
    },
    replace(next: SettingsState): void {
      this.$patch(normalizeSettings(next));
      this.persist();
    }
  }
});
