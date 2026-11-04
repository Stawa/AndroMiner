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
  liteSessionMode: boolean;
}

export interface UpdateSettings {
  autoUpdate: boolean;
}

export interface SettingsState {
  notifications: NotificationSettings;
  autoStart: boolean;
  autoResume: boolean;
  /** Offer a restart after an unexpected miner exit and do it automatically if unanswered. */
  autoRestartOnCrash: boolean;
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
  autoRestartOnCrash: true,
  thermalThreshold: 42,
  batterySafety: {
    stopBelowPercent: 25,
    mineOnlyCharging: false
  },
  performance: {
    preferLittleCores: true,
    backgroundThrottle: true,
    adaptiveIntensity: true,
    animationsEnabled: true,
    liteSessionMode: false
  },
  updates: {
    autoUpdate: true
  }
});

const normalizeSettings = (settings: Partial<SettingsState>): SettingsState => {
  const defaults = defaultSettings();
  const floor = settings?.batterySafety?.stopBelowPercent;

  return {
    ...defaults,
    ...settings,
    notifications: {
      ...defaults.notifications,
      ...settings.notifications
    },
    batterySafety: {
      stopBelowPercent:
        typeof floor === 'number' && Number.isFinite(floor)
          ? Math.min(50, Math.max(0, Math.round(floor)))
          : defaults.batterySafety.stopBelowPercent,
      mineOnlyCharging:
        typeof settings?.batterySafety?.mineOnlyCharging === 'boolean'
          ? settings.batterySafety.mineOnlyCharging
          : defaults.batterySafety.mineOnlyCharging
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
    persist(): boolean {
      try {
        localStorage.setItem(settingsKey, JSON.stringify(this.$state));
        return true;
      } catch {
        return false;
      }
    },
    replace(next: SettingsState): void {
      this.$patch(normalizeSettings(next));
      this.persist();
    }
  }
});
