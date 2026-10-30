<script setup lang="ts">
import AppUpdatesCard from '../components/AppUpdatesCard.vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import ToggleRow from '../components/ToggleRow.vue';
import { useTheme } from '../composables/useTheme';
import { useSettingsStore } from '../stores/settings';
const settings = useSettingsStore();
const { theme, setTheme } = useTheme();
const emit = defineEmits<{ exportConfig: []; importConfig: []; openAbout: [] }>();
</script>
<template>
  <div class="app-page phone-page redesign-page settings-page">
    <header class="screen-heading">
      <h1>Settings</h1>
      <p>Display, power protection, and your saved data.</p>
    </header>
    <div class="settings-layout grid min-w-0 gap-layout content-start md:grid-cols-2 items-stretch">
      <section class="surface">
        <div class="section-heading">
          <h3>Appearance</h3>
          <div class="segment">
            <button :aria-pressed="theme === 'light'" @click="setTheme('light')">
              <MaterialIcon name="light_mode" :size="17" />Light</button
            ><button :aria-pressed="theme === 'dark'" @click="setTheme('dark')">
              <MaterialIcon name="dark_mode" :size="17" />Dark
            </button>
          </div>
        </div>
        <ToggleRow
          v-model="settings.performance.animationsEnabled"
          label="Interface motion"
          supporting-text="Use subtle transitions in the interface"
        /><ToggleRow
          v-model="settings.performance.liteSessionMode"
          label="Lite session view"
          supporting-text="Keep speed, shares, and controls; hide secondary detail"
        />
      </section>
      <section class="surface">
        <div class="section-heading">
          <h3>Your data</h3>
          <MaterialIcon name="folder_open" :size="20" />
        </div>
        <p class="section-copy">
          Export your setup as JSON or restore a saved configuration. It includes your wallet and
          pool settings.
        </p>
        <div class="action-row">
          <button class="outline-button" @click="emit('exportConfig')">
            <MaterialIcon name="download" :size="18" />Export</button
          ><button class="outline-button" @click="emit('importConfig')">
            <MaterialIcon name="upload" :size="18" />Import
          </button>
        </div>
      </section>
      <AppUpdatesCard />
      <section class="surface">
        <div class="section-heading">
          <h3>Power & protection</h3>
          <MaterialIcon name="shield" :size="20" />
        </div>
        <ToggleRow
          v-model="settings.batterySafety.mineOnlyCharging"
          label="Mine only while charging"
          supporting-text="Native protection pauses mining when power disconnects"
        />
        <div class="slider-field">
          <label for="battery-floor"
            >Pause below <strong>{{ settings.batterySafety.stopBelowPercent }}%</strong></label
          ><input
            id="battery-floor"
            v-model.number="settings.batterySafety.stopBelowPercent"
            class="android-slider"
            type="range"
            min="10"
            max="60"
            step="5"
          />
          <p>
            Android checks battery and temperature every two seconds, including in the background.
            Missing required readings stop mining. Set the temperature limit in Miner → Safety.
          </p>
        </div>
        <p class="section-copy">
          An ongoing notification with Stop mining is required during every run. Enable
          notifications in Android settings before starting.
        </p>
      </section>
      <details class="surface unsupported">
        <summary>Unavailable automation</summary>
        <p class="section-copy">
          These saved preferences have no runtime implementation. They cannot be enabled in this
          build.
        </p>
        <ToggleRow v-model="settings.autoStart" label="Start automatically" disabled /><ToggleRow
          v-model="settings.autoResume"
          label="Restart automatically"
          disabled
        /><ToggleRow
          v-model="settings.performance.backgroundThrottle"
          label="Throttle in background"
          disabled
        /><ToggleRow
          v-model="settings.performance.preferLittleCores"
          label="Automatic efficiency core preference"
          supporting-text="Choose cores manually in Mining → Engine"
          disabled
        /><ToggleRow
          v-model="settings.performance.adaptiveIntensity"
          label="Adaptive intensity"
          disabled
        /><ToggleRow
          v-model="settings.notifications.shareAccepted"
          label="Accepted share alerts"
          disabled
        /><ToggleRow
          v-model="settings.notifications.thermalWarning"
          label="Heat notifications"
          disabled
        /><ToggleRow
          v-model="settings.notifications.batteryWarning"
          label="Battery notifications"
          disabled
        /><ToggleRow
          v-model="settings.notifications.poolDisconnect"
          label="Disconnect notifications"
          disabled
        />
      </details>
      <button class="outline-button" @click="emit('openAbout')">
        About AndroMiner <MaterialIcon name="arrow_forward" :size="18" />
      </button>
    </div>
  </div>
</template>
