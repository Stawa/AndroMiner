<script setup lang="ts">
import { computed, ref } from 'vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import SettingGroup from '../components/SettingGroup.vue';
import ToggleRow from '../components/ToggleRow.vue';
import { useTheme } from '../composables/useTheme';
import { useSheetDrag } from '../composables/useSheetDrag';
import { useSettingsStore } from '../stores/settings';

const settings = useSettingsStore();
const { theme, setTheme } = useTheme();
const aboutOpen = ref(false);
const lightThemeEnabled = computed({
  get: () => theme.value === 'light',
  set: (enabled: boolean) => {
    setTheme(enabled ? 'light' : 'dark');
  }
});

const emit = defineEmits<{
  exportConfig: [];
  importConfig: [];
}>();

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
    <SettingGroup title="Appearance" icon="palette">
      <ToggleRow
        v-model="lightThemeEnabled"
        label="Light theme"
        supporting-text="Use a brighter interface for daytime mining"
      />
    </SettingGroup>

    <SettingGroup title="Notifications" icon="notifications">
      <ToggleRow
        v-model="settings.notifications.miningStatus"
        label="Mining status"
        supporting-text="Keep an Android notification while mining is active"
      />
      <ToggleRow
        v-model="settings.notifications.shareAccepted"
        label="Accepted shares"
        supporting-text="Notify when a share is accepted"
      />
      <ToggleRow
        v-model="settings.notifications.thermalWarning"
        label="Thermal warning"
        supporting-text="Alert before temperature limit"
      />
      <ToggleRow
        v-model="settings.notifications.batteryWarning"
        label="Battery warning"
        supporting-text="Alert when battery is low"
      />
      <ToggleRow
        v-model="settings.notifications.poolDisconnect"
        label="Pool disconnect"
        supporting-text="Notify when pool connection is lost"
      />
    </SettingGroup>

    <SettingGroup title="Startup and battery" icon="battery_charging_full">
      <ToggleRow
        v-model="settings.autoStart"
        label="Auto-start mining"
        supporting-text="Start mining when app opens"
      />
      <ToggleRow
        v-model="settings.autoResume"
        label="Auto-resume session"
        supporting-text="Resume after app restart"
      />
      <ToggleRow
        v-model="settings.batterySafety.mineOnlyCharging"
        label="Mine only while charging"
        supporting-text="Pause mining when not charging"
      />
      <div class="border-t border-app-line p-4">
        <div class="mb-2 flex items-center justify-between gap-3">
          <div>
            <p class="text-[15px] font-medium leading-5 text-white">Battery safety threshold</p>
            <p class="mt-1 text-[12px] leading-[18px] text-app-muted">
              Stop mining if battery below
            </p>
          </div>
          <strong class="shrink-0 text-[15px] text-white"
            >{{ settings.batterySafety.stopBelowPercent }}%</strong
          >
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
    </SettingGroup>

    <SettingGroup title="Background behavior" icon="mobile_friendly">
      <ToggleRow
        v-model="settings.performance.backgroundThrottle"
        label="Background throttle"
        supporting-text="Reduce intensity when app is backgrounded"
      />
      <ToggleRow
        v-model="settings.performance.preferLittleCores"
        label="Prefer efficiency cores"
        supporting-text="Use cooler CPU clusters first"
      />
      <ToggleRow
        v-model="settings.performance.adaptiveIntensity"
        label="Adaptive intensity"
        supporting-text="Tune threads using temperature and battery"
      />
      <ToggleRow
        v-model="settings.performance.animationsEnabled"
        label="Animations"
        supporting-text="Enable smooth screen, sheet, and control transitions"
      />
    </SettingGroup>

    <SettingGroup title="Mining behavior" icon="tune">
      <div class="border-t border-app-line p-4 first:border-t-0">
        <div class="mb-2 flex items-center justify-between gap-3">
          <div>
            <p class="text-[15px] font-medium leading-5 text-white">Thermal warning</p>
            <p class="mt-1 text-[12px] leading-[18px] text-app-muted">
              Warn before this temperature
            </p>
          </div>
          <strong class="shrink-0 text-[15px] text-white"
            >{{ settings.thermalThreshold }} °C</strong
          >
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
    </SettingGroup>

    <SettingGroup title="Configuration" icon="folder_managed">
      <button class="setting-row ripple text-left" type="button" @click="emit('exportConfig')">
        <MaterialIcon class="setting-icon" name="upload_file" :size="22" />
        <span class="min-w-0 flex-1">
          <span class="block text-[15px] font-medium leading-5 text-white">Export config</span>
          <span class="mt-1 block text-[12px] leading-[18px] text-app-muted"
            >Save miner profile and safety settings</span
          >
        </span>
      </button>
      <button class="setting-row ripple text-left" type="button" @click="emit('importConfig')">
        <MaterialIcon class="setting-icon" name="download_for_offline" :size="22" />
        <span class="min-w-0 flex-1">
          <span class="block text-[15px] font-medium leading-5 text-white">Import config</span>
          <span class="mt-1 block text-[12px] leading-[18px] text-app-muted"
            >Restore a previously exported setup</span
          >
        </span>
      </button>
      <button class="setting-row ripple text-left" type="button" @click="openAbout">
        <MaterialIcon class="setting-icon" name="info" :size="22" />
        <span class="min-w-0 flex-1">
          <span class="block text-[15px] font-medium leading-5 text-white">About AndroMiner</span>
          <span class="mt-1 block text-[12px] leading-[18px] text-app-muted"
            >Version, build, and backend status</span
          >
        </span>
      </button>
    </SettingGroup>
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
