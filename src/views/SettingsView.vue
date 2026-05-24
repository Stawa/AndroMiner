<script setup lang="ts">
import { computed, ref } from 'vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import ToggleRow from '../components/ToggleRow.vue';
import { useTheme } from '../composables/useTheme';
import { useSheetDrag } from '../composables/useSheetDrag';
import { useSettingsStore } from '../stores/settings';

type SettingsSection = 'alerts' | 'power' | 'performance' | 'data';
type ThemeMode = 'light' | 'dark';

interface SettingsSectionItem {
  id: SettingsSection;
  label: string;
  icon: string;
  title: string;
  description: string;
}

interface ThemeOption {
  id: ThemeMode;
  label: string;
  icon: string;
}

const settings = useSettingsStore();
const { theme, setTheme } = useTheme();
const aboutOpen = ref(false);
const settingsSection = ref<SettingsSection>('alerts');

const settingsSections: SettingsSectionItem[] = [
  {
    id: 'alerts',
    label: 'Alerts',
    icon: 'notifications',
    title: 'Alerts',
    description: 'Choose which mining and device events should notify you.'
  },
  {
    id: 'power',
    label: 'Power',
    icon: 'battery_charging_full',
    title: 'Power',
    description: 'Startup, resume, battery floor, and charging behavior.'
  },
  {
    id: 'performance',
    label: 'Perf',
    icon: 'speed',
    title: 'Performance',
    description: 'Background mining behavior, CPU preference, and heat guard.'
  },
  {
    id: 'data',
    label: 'Data',
    icon: 'folder_managed',
    title: 'Data',
    description: 'Export, restore, and view app information.'
  }
];

const themeOptions: ThemeOption[] = [
  { id: 'dark', label: 'Dark', icon: 'dark_mode' },
  { id: 'light', label: 'Light', icon: 'light_mode' }
];

const themeLabel = computed(() => (theme.value === 'light' ? 'Light' : 'Dark'));
const themeIcon = computed(() => (theme.value === 'light' ? 'light_mode' : 'dark_mode'));
const batteryModeLabel = computed(() =>
  settings.batterySafety.mineOnlyCharging ? 'Charging only' : 'Battery only'
);
const performanceModeLabel = computed(() =>
  settings.performance.adaptiveIntensity ? 'Adaptive' : 'Manual'
);

const emit = defineEmits<{
  exportConfig: [];
  importConfig: [];
}>();

const selectTheme = (mode: ThemeMode): void => {
  setTheme(mode);
};

const openAbout = (): void => {
  aboutOpen.value = true;
};

const closeAbout = (): void => {
  aboutOpen.value = false;
};

const { sheetDragStyle, startSheetDrag, moveSheetDrag, endSheetDrag } = useSheetDrag(closeAbout);
</script>

<template>
  <div class="phone-page">
    <section class="app-card overflow-hidden">
      <div class="p-4">
        <div class="flex items-start gap-3">
          <div
            class="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-app-green-dim text-app-green"
          >
            <MaterialIcon name="settings" :size="27" filled />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[12px] font-semibold uppercase leading-4 text-app-green">Settings</p>
            <h2 class="mt-1 text-[22px] font-semibold leading-7 text-white">Preferences</h2>
            <p class="mt-0.5 text-[13px] leading-5 text-app-muted">
              Android mining behavior and app safety
            </p>
          </div>
        </div>

        <div class="mt-4 rounded-lg border border-app-line bg-app-elevated p-3">
          <div class="flex items-center gap-3">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-app-card">
              <MaterialIcon class="text-app-green" :name="themeIcon" :size="21" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[14px] font-semibold leading-5 text-white">Appearance</span>
              <span class="block truncate text-[12px] leading-4 text-app-muted">Display mode</span>
            </span>
            <span
              class="shrink-0 rounded-full bg-app-card px-2.5 py-1 text-[12px] font-semibold text-app-muted"
            >
              {{ themeLabel }}
            </span>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-1 rounded-full bg-app-card p-1">
            <button
              v-for="option in themeOptions"
              :key="option.id"
              class="ripple flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full px-3 text-[13px] font-semibold transition-colors"
              :class="
                theme === option.id
                  ? 'bg-app-green-dim text-app-green'
                  : 'text-app-muted active:bg-app-elevated'
              "
              type="button"
              :aria-pressed="theme === option.id"
              @click="selectTheme(option.id)"
            >
              <MaterialIcon :name="option.icon" :size="18" :filled="theme === option.id" />
              <span class="truncate">{{ option.label }}</span>
            </button>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2">
          <button
            v-for="section in settingsSections"
            :key="section.id"
            class="ripple min-h-[92px] min-w-0 rounded-lg border p-3 text-left transition-colors"
            :class="
              settingsSection === section.id
                ? 'border-app-green/35 bg-app-green-dim text-app-green'
                : 'border-app-line bg-app-elevated text-app-muted'
            "
            type="button"
            :aria-pressed="settingsSection === section.id"
            @click="settingsSection = section.id"
          >
            <span class="mb-3 flex items-center justify-between gap-2">
              <span
                class="grid h-9 w-9 place-items-center rounded-full"
                :class="settingsSection === section.id ? 'bg-app-card/80' : 'bg-app-card'"
              >
                <MaterialIcon
                  :name="section.icon"
                  :size="20"
                  :filled="settingsSection === section.id"
                />
              </span>
              <MaterialIcon
                v-if="settingsSection === section.id"
                class="shrink-0"
                name="check_circle"
                :size="19"
              />
            </span>
            <span class="block truncate text-[14px] font-semibold leading-5">
              {{ section.title }}
            </span>
            <span
              class="mt-1 block max-h-8 overflow-hidden text-[11px] leading-4"
              :class="settingsSection === section.id ? 'text-app-green' : 'text-app-muted'"
            >
              {{ section.description }}
            </span>
          </button>
        </div>
      </div>
    </section>

    <section v-if="settingsSection === 'alerts'" class="app-card overflow-hidden">
      <div class="flex min-h-14 items-center justify-between gap-3 px-4">
        <div class="flex min-w-0 items-center gap-3">
          <MaterialIcon class="shrink-0 text-app-green" name="notifications" :size="21" />
          <div class="min-w-0">
            <h3 class="text-[15px] font-semibold leading-5 text-white">Notifications</h3>
            <p class="mt-0.5 text-[12px] leading-4 text-app-muted">Mining events and warnings</p>
          </div>
        </div>
      </div>
      <div class="border-t border-app-line">
        <ToggleRow
          v-model="settings.notifications.miningStatus"
          icon="monitor_heart"
          label="Mining status"
          supporting-text="Keep an Android notification while mining is active"
        />
        <ToggleRow
          v-model="settings.notifications.shareAccepted"
          icon="done_all"
          label="Accepted shares"
          supporting-text="Notify when a pool share is accepted"
        />
        <ToggleRow
          v-model="settings.notifications.thermalWarning"
          icon="device_thermostat"
          label="Thermal warning"
          supporting-text="Warn before the device reaches your heat limit"
        />
        <ToggleRow
          v-model="settings.notifications.batteryWarning"
          icon="battery_alert"
          label="Battery warning"
          supporting-text="Alert when battery safety pauses mining"
        />
        <ToggleRow
          v-model="settings.notifications.poolDisconnect"
          icon="wifi_off"
          label="Pool disconnect"
          supporting-text="Notify when pool connection is lost"
        />
      </div>
    </section>

    <section v-else-if="settingsSection === 'power'" class="space-y-3">
      <section class="app-card overflow-hidden">
        <div class="flex min-h-14 items-center gap-3 px-4">
          <MaterialIcon class="text-app-green" name="power_settings_new" :size="21" />
          <div class="min-w-0">
            <h3 class="text-[15px] font-semibold leading-5 text-white">Startup</h3>
            <p class="mt-0.5 text-[12px] leading-4 text-app-muted">Launch and resume behavior</p>
          </div>
        </div>
        <div class="border-t border-app-line">
          <ToggleRow
            v-model="settings.autoStart"
            icon="rocket_launch"
            label="Auto-start mining"
            supporting-text="Start mining when app opens"
          />
          <ToggleRow
            v-model="settings.autoResume"
            icon="restart_alt"
            label="Auto-resume session"
            supporting-text="Resume after app restart"
          />
        </div>
      </section>

      <section class="app-card overflow-hidden">
        <div class="flex min-h-14 items-center justify-between gap-3 px-4">
          <div class="flex min-w-0 items-center gap-3">
            <MaterialIcon class="shrink-0 text-app-green" name="battery_saver" :size="21" />
            <div class="min-w-0">
              <h3 class="text-[15px] font-semibold leading-5 text-white">Battery guard</h3>
              <p class="mt-0.5 text-[12px] leading-4 text-app-muted">Protect unplugged devices</p>
            </div>
          </div>
          <span
            class="shrink-0 rounded-full bg-app-elevated px-2.5 py-1 text-[12px] font-semibold leading-4 text-app-muted"
          >
            {{ batteryModeLabel }}
          </span>
        </div>
        <div class="border-t border-app-line">
          <ToggleRow
            v-model="settings.batterySafety.mineOnlyCharging"
            icon="power"
            label="Mine only while charging"
            supporting-text="Pause mining when not charging"
          />
          <div class="border-t border-app-line p-4">
            <div class="rounded-lg border border-app-line bg-app-elevated/70 p-3">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-[14px] font-semibold leading-5 text-white">
                    Battery safety threshold
                  </p>
                  <p class="mt-0.5 text-[12px] leading-[18px] text-app-muted">
                    Stop mining if battery drops below this level
                  </p>
                </div>
                <strong
                  class="shrink-0 rounded-full bg-app-card px-2.5 py-1 text-[13px] font-semibold text-app-green"
                >
                  {{ settings.batterySafety.stopBelowPercent }}%
                </strong>
              </div>
              <input
                v-model.number="settings.batterySafety.stopBelowPercent"
                class="android-slider"
                type="range"
                min="10"
                max="60"
                step="5"
              />
            </div>
          </div>
        </div>
      </section>
    </section>

    <section v-else-if="settingsSection === 'performance'" class="space-y-3">
      <section class="app-card overflow-hidden">
        <div class="flex min-h-14 items-center justify-between gap-3 px-4">
          <div class="flex min-w-0 items-center gap-3">
            <MaterialIcon class="shrink-0 text-app-green" name="memory" :size="21" />
            <div class="min-w-0">
              <h3 class="text-[15px] font-semibold leading-5 text-white">Runtime behavior</h3>
              <p class="mt-0.5 text-[12px] leading-4 text-app-muted">CPU and background handling</p>
            </div>
          </div>
          <span
            class="shrink-0 rounded-full bg-app-green-dim px-2.5 py-1 text-[12px] font-semibold leading-4 text-app-green"
          >
            {{ performanceModeLabel }}
          </span>
        </div>
        <div class="border-t border-app-line">
          <ToggleRow
            v-model="settings.performance.backgroundThrottle"
            icon="speed"
            label="Background throttle"
            supporting-text="Reduce intensity when app is backgrounded"
          />
          <ToggleRow
            v-model="settings.performance.preferLittleCores"
            icon="eco"
            label="Prefer efficiency cores"
            supporting-text="Use cooler CPU clusters first"
          />
          <ToggleRow
            v-model="settings.performance.adaptiveIntensity"
            icon="auto_mode"
            label="Adaptive intensity"
            supporting-text="Tune threads using temperature and battery"
          />
          <ToggleRow
            v-model="settings.performance.animationsEnabled"
            icon="animation"
            label="Animations"
            supporting-text="Enable smooth screen, sheet, and control transitions"
          />
        </div>
      </section>

      <section class="app-card overflow-hidden">
        <div class="flex min-h-14 items-center gap-3 px-4">
          <MaterialIcon class="text-app-green" name="device_thermostat" :size="21" />
          <div class="min-w-0">
            <h3 class="text-[15px] font-semibold leading-5 text-white">Thermal warning</h3>
            <p class="mt-0.5 text-[12px] leading-4 text-app-muted">Heat alert threshold</p>
          </div>
        </div>
        <div class="border-t border-app-line p-4">
          <div class="rounded-lg border border-app-line bg-app-elevated/70 p-3">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-[14px] font-semibold leading-5 text-white">Warn before heat limit</p>
                <p class="mt-0.5 text-[12px] leading-[18px] text-app-muted">
                  Raise or lower the temperature warning point
                </p>
              </div>
              <strong
                class="shrink-0 rounded-full bg-app-card px-2.5 py-1 text-[13px] font-semibold text-app-green"
              >
                {{ settings.thermalThreshold }} °C
              </strong>
            </div>
            <input
              v-model.number="settings.thermalThreshold"
              class="android-slider"
              type="range"
              min="55"
              max="85"
              step="1"
            />
          </div>
        </div>
      </section>
    </section>

    <section v-else class="app-card overflow-hidden">
      <div class="flex min-h-14 items-center gap-3 px-4">
        <MaterialIcon class="text-app-green" name="folder_managed" :size="21" />
        <div class="min-w-0">
          <h3 class="text-[15px] font-semibold leading-5 text-white">Configuration</h3>
          <p class="mt-0.5 text-[12px] leading-4 text-app-muted">Backup and app information</p>
        </div>
      </div>
      <div class="border-t border-app-line">
        <button
          class="ripple flex min-h-[76px] w-full items-center gap-3 border-t border-app-line px-4 py-3 text-left first:border-t-0 active:bg-app-elevated"
          type="button"
          @click="emit('exportConfig')"
        >
          <span
            class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-app-elevated text-app-green"
          >
            <MaterialIcon name="upload_file" :size="22" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[15px] font-medium leading-5 text-white">Export config</span>
            <span class="mt-1 block text-[12px] leading-[18px] text-app-muted">
              Save miner profile and safety settings
            </span>
          </span>
          <MaterialIcon class="shrink-0 text-app-muted" name="chevron_right" :size="20" />
        </button>
        <button
          class="ripple flex min-h-[76px] w-full items-center gap-3 border-t border-app-line px-4 py-3 text-left first:border-t-0 active:bg-app-elevated"
          type="button"
          @click="emit('importConfig')"
        >
          <span
            class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-app-elevated text-app-green"
          >
            <MaterialIcon name="download_for_offline" :size="22" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[15px] font-medium leading-5 text-white">Import config</span>
            <span class="mt-1 block text-[12px] leading-[18px] text-app-muted">
              Restore a previously exported setup
            </span>
          </span>
          <MaterialIcon class="shrink-0 text-app-muted" name="chevron_right" :size="20" />
        </button>
        <button
          class="ripple flex min-h-[76px] w-full items-center gap-3 border-t border-app-line px-4 py-3 text-left first:border-t-0 active:bg-app-elevated"
          type="button"
          @click="openAbout"
        >
          <span
            class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-app-elevated text-app-green"
          >
            <MaterialIcon name="info" :size="22" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[15px] font-medium leading-5 text-white">About AndroMiner</span>
            <span class="mt-1 block text-[12px] leading-[18px] text-app-muted">
              Version, build, and backend status
            </span>
          </span>
          <MaterialIcon class="shrink-0 text-app-muted" name="chevron_right" :size="20" />
        </button>
      </div>
    </section>
  </div>

  <Transition name="fade">
    <div v-if="aboutOpen" class="fixed inset-0 z-50 bg-black/[0.55]" @click="closeAbout" />
  </Transition>
  <Transition name="sheet">
    <section
      v-if="aboutOpen"
      class="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[420px] rounded-t-[28px] border border-app-line bg-app-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      :style="sheetDragStyle"
    >
      <button
        class="ripple mx-auto mb-3 block h-8 min-h-8 w-24 touch-none rounded-full"
        type="button"
        aria-label="Close about sheet"
        @click="closeAbout"
        @pointerdown="startSheetDrag"
        @pointermove="moveSheetDrag"
        @pointerup="endSheetDrag"
        @pointercancel="endSheetDrag"
      >
        <span class="mx-auto block h-1 w-10 rounded-full bg-white/25" />
      </button>
      <div class="flex items-center gap-3">
        <div
          class="grid h-12 w-12 place-items-center rounded-full border-2 border-app-green text-app-green"
        >
          <MaterialIcon name="power_settings_new" :size="26" />
        </div>
        <div>
          <h2 class="text-[20px] font-semibold leading-7 text-white">AndroMiner</h2>
          <p class="text-[13px] leading-5 text-app-muted">Version 1.0.0 · Capacitor-ready UI</p>
        </div>
      </div>
      <p class="mt-4 text-[13px] leading-5 text-app-muted">
        Android-native interface for launching an XMRig-compatible miner binary, tracking real pool
        shares, and mirroring device safety telemetry.
      </p>
      <button
        class="ripple mt-5 h-12 w-full rounded-full bg-app-green-dim text-[15px] font-semibold text-app-green"
        type="button"
        @click="closeAbout"
      >
        Done
      </button>
    </section>
  </Transition>
</template>
