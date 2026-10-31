<script setup lang="ts">
import { computed } from 'vue';
import AppUpdatesCard from '../components/AppUpdatesCard.vue';
import RangeSlider from '../components/RangeSlider.vue';
import UsageStatisticsCard from '../components/UsageStatisticsCard.vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import ToggleRow from '../components/ToggleRow.vue';
import { useTheme } from '../composables/useTheme';
import { t, useLanguage } from '../i18n';
import { isLanguagePreference, nativeLanguageNames, supportedLocales } from '../i18n/locale';
import { useSettingsStore } from '../stores/settings';
import type { DeviceTelemetry, MiningConfig } from '../types/mining';
const props = defineProps<{ config: MiningConfig; device: DeviceTelemetry; locked?: boolean }>();
const settings = useSettingsStore();
const { theme, setTheme } = useTheme();
const { preference, locale, setLanguage } = useLanguage();
const emit = defineEmits<{ exportConfig: []; importConfig: []; openAbout: [] }>();

const languageOptions = computed(() => [
  {
    value: 'system',
    code: '',
    label: t('settings.languageSystem'),
    supportingText: t('settings.languageSystemNow', { language: nativeLanguageNames[locale.value] })
  },
  ...supportedLocales.map((code) => ({
    value: code,
    code: code.split('-')[0].toUpperCase(),
    label: nativeLanguageNames[code],
    supportingText: ''
  }))
]);

const sensorText = computed(() =>
  t('config.sensorNow', {
    source:
      props.device.thermalSource === 'battery'
        ? t('config.sourceBattery')
        : t('config.sourceDevice'),
    value:
      props.device.temperatureC === null
        ? t('common.unavailable')
        : `${props.device.temperatureC} °C`
  })
);

const changeLanguage = (value: string): void => {
  if (isLanguagePreference(value)) setLanguage(value);
};
</script>
<template>
  <div class="app-page phone-page redesign-page settings-page">
    <header class="screen-heading">
      <h1>{{ $t('nav.settings') }}</h1>
      <p>{{ $t('settings.subtitle') }}</p>
    </header>
    <div class="settings-layout grid min-w-0 gap-layout content-start md:grid-cols-2 items-stretch">
      <section class="surface">
        <div class="section-heading">
          <h3>{{ $t('settings.general') }}</h3>
          <MaterialIcon name="settings" :size="20" />
        </div>
        <div class="language-list" role="radiogroup" :aria-label="$t('settings.language')">
          <button
            v-for="option in languageOptions"
            :key="option.value"
            class="language-option ripple"
            type="button"
            role="radio"
            :aria-checked="option.value === preference"
            @click="changeLanguage(option.value)"
          >
            <span class="language-option-code">
              <MaterialIcon v-if="!option.code" name="translate" :size="18" />
              <template v-else>{{ option.code }}</template>
            </span>
            <span class="language-option-text">
              <span class="language-option-name">{{ option.label }}</span>
              <span v-if="option.supportingText" class="language-option-sub">{{
                option.supportingText
              }}</span>
            </span>
            <MaterialIcon
              v-if="option.value === preference"
              class="text-app-green"
              name="check_circle"
              :size="22"
              filled
            />
          </button>
        </div>
        <p class="section-copy mt-3">{{ $t('settings.languageHint') }}</p>
      </section>
      <section class="surface">
        <div class="section-heading">
          <h3>{{ $t('settings.appearance') }}</h3>
          <div class="segment">
            <button :aria-pressed="theme === 'light'" @click="setTheme('light')">
              <MaterialIcon name="light_mode" :size="17" />{{ $t('settings.light') }}</button
            ><button :aria-pressed="theme === 'dark'" @click="setTheme('dark')">
              <MaterialIcon name="dark_mode" :size="17" />{{ $t('settings.dark') }}
            </button>
          </div>
        </div>
        <ToggleRow
          v-model="settings.performance.animationsEnabled"
          :label="$t('settings.motion')"
          :supporting-text="$t('settings.motionHint')"
        /><ToggleRow
          v-model="settings.performance.liteSessionMode"
          :label="$t('settings.lite')"
          :supporting-text="$t('settings.liteHint')"
        />
      </section>
      <section class="surface">
        <div class="section-heading">
          <h3>{{ $t('settings.yourData') }}</h3>
          <MaterialIcon name="folder_open" :size="20" />
        </div>
        <p class="section-copy">{{ $t('settings.dataCopy') }}</p>
        <div class="action-row">
          <button class="outline-button" @click="emit('exportConfig')">
            <MaterialIcon name="download" :size="18" />{{ $t('settings.export') }}</button
          ><button class="outline-button" @click="emit('importConfig')">
            <MaterialIcon name="upload" :size="18" />{{ $t('settings.import') }}
          </button>
        </div>
      </section>
      <AppUpdatesCard />
      <section class="surface">
        <div class="section-heading">
          <h3>{{ $t('settings.power') }}</h3>
          <MaterialIcon name="shield" :size="20" />
        </div>
        <ToggleRow
          v-model="settings.batterySafety.mineOnlyCharging"
          :label="$t('settings.chargingOnly')"
          :supporting-text="$t('settings.chargingOnlyHint')"
        />
        <div class="power-group">
          <RangeSlider
            v-model="settings.batterySafety.stopBelowPercent"
            :label="$t('settings.pauseBelowLabel')"
            :min="10"
            :max="60"
            :step="5"
            unit="%"
          />
          <p class="section-copy">{{ $t('settings.batteryNote') }}</p>
          <RangeSlider
            v-model="config.thermalThreshold"
            :label="$t('config.tempLimit')"
            :min="20"
            :max="85"
            unit=" °C"
            :disabled="locked"
          />
          <p v-if="locked" class="section-copy">{{ $t('config.locked') }}</p>
          <div class="sensor-chip">
            <MaterialIcon name="thermostat" :size="18" />{{ sensorText }}
          </div>
          <p class="section-copy">{{ $t('config.protectionCopy') }}</p>
        </div>
        <p class="section-copy">{{ $t('settings.notificationNote') }}</p>
      </section>
      <UsageStatisticsCard />
      <details class="surface unsupported">
        <summary>{{ $t('settings.unsupported') }}</summary>
        <p class="section-copy">{{ $t('settings.unsupportedCopy') }}</p>
        <ToggleRow
          v-model="settings.autoStart"
          :label="$t('settings.autoStart')"
          disabled
        /><ToggleRow
          v-model="settings.autoResume"
          :label="$t('settings.autoResume')"
          disabled
        /><ToggleRow
          v-model="settings.performance.backgroundThrottle"
          :label="$t('settings.throttle')"
          disabled
        /><ToggleRow
          v-model="settings.performance.preferLittleCores"
          :label="$t('settings.littleCores')"
          :supporting-text="$t('settings.littleCoresHint')"
          disabled
        /><ToggleRow
          v-model="settings.performance.adaptiveIntensity"
          :label="$t('settings.adaptive')"
          disabled
        /><ToggleRow
          v-model="settings.notifications.shareAccepted"
          :label="$t('settings.shareAlerts')"
          disabled
        /><ToggleRow
          v-model="settings.notifications.thermalWarning"
          :label="$t('settings.heatAlerts')"
          disabled
        /><ToggleRow
          v-model="settings.notifications.batteryWarning"
          :label="$t('settings.batteryAlerts')"
          disabled
        /><ToggleRow
          v-model="settings.notifications.poolDisconnect"
          :label="$t('settings.disconnectAlerts')"
          disabled
        />
      </details>
      <button class="outline-button" @click="emit('openAbout')">
        {{ $t('settings.about') }} <MaterialIcon name="arrow_forward" :size="18" />
      </button>
    </div>
  </div>
</template>
