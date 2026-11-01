<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AppUpdatesCard from '../components/AppUpdatesCard.vue';
import UsageStatisticsCard from '../components/UsageStatisticsCard.vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import ToggleRow from '../components/ToggleRow.vue';
import { useTheme, type ThemePreference } from '../composables/useTheme';
import { t, useLanguage } from '../i18n';
import { isLanguagePreference, nativeLanguageNames, supportedLocales } from '../i18n/locale';
import { useSettingsStore } from '../stores/settings';
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

const themeOptions = computed<Array<{ value: ThemePreference; icon: string; label: string }>>(
  () => [
    { value: 'dark', icon: 'dark_mode', label: t('settings.dark') },
    { value: 'light', icon: 'light_mode', label: t('settings.light') }
  ]
);

const languageOpen = ref(false);
const languagePicker = ref<HTMLElement | null>(null);
const selectedLanguage = computed(
  () => languageOptions.value.find((o) => o.value === preference.value) ?? languageOptions.value[0]
);

const changeLanguage = (value: string): void => {
  if (isLanguagePreference(value)) setLanguage(value);
  languageOpen.value = false;
};

const onPickerFocusOut = (e: FocusEvent): void => {
  const next = e.relatedTarget as Node | null;
  if (next && !languagePicker.value?.contains(next)) languageOpen.value = false;
};

const onDocumentPointerDown = (e: PointerEvent): void => {
  if (languageOpen.value && !languagePicker.value?.contains(e.target as Node)) {
    languageOpen.value = false;
  }
};
onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown));
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown));
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
        <div
          ref="languagePicker"
          class="language-picker"
          @keydown.esc="languageOpen = false"
          @focusout="onPickerFocusOut"
        >
          <button
            class="language-option language-trigger ripple"
            type="button"
            aria-haspopup="listbox"
            :aria-expanded="languageOpen"
            :aria-label="$t('settings.language')"
            @click="languageOpen = !languageOpen"
          >
            <span class="language-option-code">
              <MaterialIcon v-if="!selectedLanguage.code" name="translate" :size="18" />
              <template v-else>{{ selectedLanguage.code }}</template>
            </span>
            <span class="language-option-text">
              <span class="language-option-name">{{ selectedLanguage.label }}</span>
              <span v-if="selectedLanguage.supportingText" class="language-option-sub">{{
                selectedLanguage.supportingText
              }}</span>
            </span>
            <MaterialIcon
              class="language-chevron"
              :class="{ 'is-open': languageOpen }"
              name="expand_more"
              :size="22"
            />
          </button>
          <div
            v-if="languageOpen"
            class="language-menu"
            role="listbox"
            :aria-label="$t('settings.language')"
          >
            <button
              v-for="option in languageOptions"
              :key="option.value"
              class="language-option ripple"
              type="button"
              role="option"
              :aria-selected="option.value === preference"
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
                class="text-app-green-ink"
                name="check"
                :size="20"
              />
            </button>
          </div>
        </div>
        <p class="section-copy mt-3">{{ $t('settings.languageHint') }}</p>
      </section>
      <section class="surface">
        <div class="section-heading">
          <h3>{{ $t('settings.appearance') }}</h3>
        </div>
        <div class="segment segment-full" role="group" :aria-label="$t('settings.appearance')">
          <button
            v-for="option in themeOptions"
            :key="option.value"
            type="button"
            :aria-pressed="theme === option.value"
            @click="setTheme(option.value)"
          >
            <MaterialIcon :name="option.icon" :size="18" />{{ option.label }}
          </button>
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
