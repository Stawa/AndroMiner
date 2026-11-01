<script setup lang="ts">
import { computed, ref } from 'vue';
import { Browser } from '@capacitor/browser';
import MaterialIcon from './MaterialIcon.vue';
import ConfigSelect from './ConfigSelect.vue';
import ToggleRow from './ToggleRow.vue';
import type { ShareField } from '../utils/telemetryClient';
import countryCodes from '../../server/data/countries.json';
import { countryFlag } from '../utils/countryFlag';
import { useTelemetry } from '../composables/useTelemetry';
import { formatDate, regionName, t } from '../i18n';

const privacyUrl = 'https://github.com/Stawa/AndroMiner/blob/main/docs/privacy.md';
const statsPageUrl = String(import.meta.env.VITE_STATS_PAGE_URL || '');

const telemetry = useTelemetry();
const consentOpen = ref(false);
const feedback = ref('');
const confirmingWithdraw = ref(false);

const countryOptions = computed(() => [
  { value: '', label: t('privacy.noCountry'), iconText: countryFlag(null) },
  ...(countryCodes as string[])
    .map((code) => ({
      value: code,
      label: regionName(code),
      supportingText: code,
      iconText: countryFlag(code)
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
]);

const enabled = computed(() => telemetry.state.value.enabled);
const lastCheckin = computed(() => {
  const at = telemetry.state.value.lastCheckinAt;
  return at
    ? formatDate(at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : t('privacy.noCheckin');
});
const unavailableReason = computed(() =>
  !telemetry.buildHasEndpoint ? t('privacy.noService') : t('privacy.androidOnly')
);

const requestChange = (event: Event): void => {
  const checkbox = event.target as HTMLInputElement;
  feedback.value = '';
  if (checkbox.checked) {
    checkbox.checked = false;
    consentOpen.value = true;
  } else {
    telemetry.disable();
    feedback.value = t('privacy.offFeedback');
  }
};

const confirmEnable = async (): Promise<void> => {
  consentOpen.value = false;
  await telemetry.enable();
  feedback.value = t('privacy.onFeedback');
};

const shareRows = computed<Array<{ field: ShareField; label: string; hint: string }>>(() => [
  { field: 'androidVersion', label: t('privacy.fieldAndroid'), hint: t('privacy.itemAndroid') },
  {
    field: 'appVersion',
    label: t('privacy.fieldAppVersion'),
    hint: t('privacy.fieldAppVersionHint')
  },
  { field: 'variant', label: t('privacy.fieldVariant'), hint: t('privacy.fieldVariantHint') },
  { field: 'country', label: t('privacy.fieldCountry'), hint: '' },
  {
    field: 'activity',
    label: t('privacy.fieldActivity'),
    hint: t('privacy.fieldActivityHint')
  }
]);

const onCountry = (code: string): void => telemetry.setCountry(code || null);

const reset = async (): Promise<void> => {
  feedback.value = '';
  await telemetry.resetInstallationId();
  feedback.value = telemetry.state.value.pendingDeletion.length
    ? t('privacy.resetPending')
    : t('privacy.resetDone');
};

const withdraw = async (): Promise<void> => {
  confirmingWithdraw.value = false;
  consentOpen.value = false;
  await telemetry.withdraw();
  feedback.value = telemetry.state.value.pendingDeletion.length
    ? t('privacy.withdrawPending')
    : t('privacy.withdrawDone');
};

const open = async (url: string): Promise<void> => {
  try {
    await Browser.open({ url });
  } catch {
    window.open(url, '_blank', 'noopener');
  }
};
</script>

<template>
  <section class="surface usage-stats" aria-labelledby="usage-stats-title">
    <div class="section-heading">
      <h3 id="usage-stats-title">{{ $t('privacy.title') }}</h3>
      <MaterialIcon name="shield" :size="20" />
    </div>
    <p class="section-copy">
      {{ $t('privacy.intro') }}
    </p>

    <label v-if="telemetry.supported" class="setting-row ripple">
      <span class="min-w-0 flex-1">
        <span class="block text-sm font-medium leading-5 text-app-on">{{
          $t('privacy.share')
        }}</span>
        <span class="mt-1 block text-[0.75rem] leading-[1.125rem] text-app-muted">{{
          $t('privacy.shareHint')
        }}</span>
      </span>
      <input
        class="peer sr-only"
        type="checkbox"
        :checked="enabled"
        :disabled="telemetry.busy.value"
        @change="requestChange"
      />
      <span class="md-switch" aria-hidden="true"><span class="md-switch-thumb" /></span>
    </label>
    <p v-else class="section-copy usage-unavailable" role="note">{{ unavailableReason }}</p>

    <div
      v-if="consentOpen"
      class="usage-consent"
      role="group"
      :aria-label="$t('privacy.beforeAria')"
    >
      <p class="section-copy">
        <strong>{{ $t('privacy.before') }}</strong>
      </p>
      <p class="section-copy">{{ $t('privacy.sendsOnly') }}</p>
      <ul class="usage-list">
        <li>{{ $t('privacy.itemId') }}</li>
        <li>{{ $t('privacy.itemCountry') }}</li>
        <li>{{ $t('privacy.itemVersion') }}</li>
        <li>{{ $t('privacy.itemAndroid') }}</li>
        <li>{{ $t('privacy.itemActivity') }}</li>
      </ul>
      <p class="section-copy">{{ $t('privacy.fieldsOptional') }}</p>
      <p class="section-copy">
        {{ $t('privacy.neverSent') }}
      </p>
      <div class="action-row">
        <button class="outline-button" type="button" @click="consentOpen = false">
          {{ $t('privacy.notNow') }}</button
        ><button class="primary-button" type="button" @click="confirmEnable">
          {{ $t('privacy.turnOn') }}
        </button>
      </div>
    </div>

    <template v-if="telemetry.supported">
      <div class="usage-fields" role="group" :aria-label="$t('privacy.shareFields')">
        <h4 class="usage-fields-title">{{ $t('privacy.shareFields') }}</h4>
        <ToggleRow
          v-for="row in shareRows"
          :key="row.field"
          :model-value="telemetry.state.value.share[row.field]"
          :label="row.label"
          :supporting-text="row.hint"
          @update:model-value="telemetry.setShare(row.field, $event)"
        />
        <p class="section-copy">{{ $t('privacy.fieldsNote') }}</p>
      </div>
      <ConfigSelect
        v-if="telemetry.state.value.share.country"
        :model-value="telemetry.state.value.country ?? ''"
        :label="$t('privacy.country')"
        :options="countryOptions"
        :supporting-text="$t('privacy.countryHint')"
        searchable
        :search-label="$t('privacy.searchCountry')"
        :search-placeholder="$t('privacy.searchCountry')"
        @update:model-value="onCountry"
      />
    </template>
    <template v-if="telemetry.supported && enabled">
      <p v-if="telemetry.publicId.value" class="section-copy">
        {{ $t('leaderboard.yourId') }}:
        <strong class="usage-id">{{ telemetry.publicId.value }}</strong>
      </p>
      <p class="section-copy usage-status" role="status">
        {{ $t('privacy.lastCheckin', { when: lastCheckin }) }}
      </p>
      <div class="action-row">
        <button
          class="outline-button"
          type="button"
          :disabled="telemetry.busy.value"
          @click="reset"
        >
          {{ $t('privacy.reset') }}</button
        ><button
          class="outline-button"
          type="button"
          :disabled="telemetry.busy.value"
          @click="confirmingWithdraw = true"
        >
          <MaterialIcon name="delete" :size="18" />{{ $t('privacy.deleteData') }}
        </button>
      </div>
    </template>

    <div
      v-if="confirmingWithdraw"
      class="usage-consent"
      role="alertdialog"
      :aria-label="$t('privacy.deleteData')"
    >
      <p class="section-copy">
        {{ $t('privacy.deleteCopy') }}
      </p>
      <div class="action-row">
        <button class="outline-button" type="button" @click="confirmingWithdraw = false">
          {{ $t('common.cancel') }}</button
        ><button class="primary-button" type="button" @click="withdraw">
          {{ $t('privacy.deleteAndStop') }}
        </button>
      </div>
    </div>

    <p
      v-if="telemetry.supported && !enabled && telemetry.state.value.pendingDeletion.length"
      class="section-copy"
    >
      {{ $t('privacy.pendingDeletion') }}
    </p>
    <p v-if="feedback" class="section-copy usage-status" role="status">{{ feedback }}</p>

    <div class="action-row usage-links">
      <button class="text-button" type="button" @click="open(privacyUrl)">
        {{ $t('privacy.docs') }}<MaterialIcon name="open_in_new" :size="16" /></button
      ><button v-if="statsPageUrl" class="text-button" type="button" @click="open(statsPageUrl)">
        {{ $t('privacy.publicStats') }}<MaterialIcon name="open_in_new" :size="16" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.usage-stats {
  display: grid;
  gap: 12px;
}
.usage-consent {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid rgb(var(--color-app-line));
  border-radius: var(--radius-control);
}
.usage-list {
  margin: 0;
  padding-left: 1.1rem;
  color: rgb(var(--color-app-muted));
  font-size: 0.8125rem;
  line-height: 1.65;
}
.usage-fields {
  display: grid;
  gap: 4px;
}
.usage-fields-title {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--color-app-muted));
}
.usage-id {
  letter-spacing: 0.06em;
  color: rgb(var(--color-app-on));
  user-select: all;
}
.usage-links {
  flex-wrap: wrap;
}
</style>
