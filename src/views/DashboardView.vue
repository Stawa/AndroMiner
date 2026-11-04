<script setup lang="ts">
import ProtectionEventList from '../components/ProtectionEventList.vue';
import { useDialogFocus } from '../composables/useDialogFocus';
import { computed, ref } from 'vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import CoinIcon from '../components/CoinIcon.vue';
import RecentRunCard from '../components/RecentRunCard.vue';
import { formatSensor, formatHashrate } from '../utils/miningTelemetry';
import { maxTemperatureLimitC, validateMiningSetup } from '../utils/configValidation';
import { useSettingsStore } from '../stores/settings';
import { formatDate, formatDuration, t } from '../i18n';
import type {
  DeviceTelemetry,
  MiningConfig,
  MiningSessionHistoryItem,
  SavedMiningProfile
} from '../types/mining';
import type { MinerBackendState } from '../composables/useMiningController';
const props = defineProps<{
  config: MiningConfig;
  device: DeviceTelemetry;
  connected: boolean;
  backendState: MinerBackendState;
  backendMessage: string;
  logs: string[];
  sessionHistory: MiningSessionHistoryItem[];
  activeProfile?: SavedMiningProfile;
}>();
const emit = defineEmits<{
  start: [];
  configure: [];
  statistics: [];
  profiles: [];
  device: [];
  deleteSession: [id: string];
  clearSessions: [];
}>();
const settings = useSettingsStore();
const selected = ref<MiningSessionHistoryItem | null>(null);
const walletReady = computed(() => !validateMiningSetup(props.config).wallet);
const setupReady = computed(() => !Object.values(validateMiningSetup(props.config)).some(Boolean));
const canStart = computed(() => ['ready', 'missing', 'error'].includes(props.backendState));
type CheckState = 'ok' | 'warn' | 'fail' | 'off';
interface ReadyCheck {
  id: string;
  label: string;
  value: string;
  state: CheckState;
  /** Safety checks hold back Start; the others are fixed from the setup screen. */
  blocksStart?: boolean;
}

const temperatureLimit = computed(() =>
  Math.min(props.config.thermalThreshold, maxTemperatureLimitC)
);
const batteryFloor = computed(() => settings.batterySafety.stopBelowPercent);
const chargerRequired = computed(
  () => props.config.autoPauseOnBattery || settings.batterySafety.mineOnlyCharging
);
const engineState = computed<CheckState>(() =>
  props.backendState === 'ready' ? 'ok' : props.backendState === 'error' ? 'fail' : 'warn'
);
const checks = computed<ReadyCheck[]>(() => {
  const validation = validateMiningSetup(props.config);
  const temperature = props.device.temperatureC;
  const level = props.device.batteryLevel;
  const list: ReadyCheck[] = [
    {
      id: 'wallet',
      label: t('dashboard.checkWallet'),
      value: validation.wallet ? t('dashboard.checkRequired') : t('dashboard.checkAdded'),
      state: validation.wallet ? 'fail' : 'ok'
    },
    {
      id: 'pool',
      label: t('metric.pool'),
      value:
        validation.pool || validation.port
          ? t('dashboard.checkRequired')
          : `${props.config.poolUrl}:${props.config.poolPort}`,
      state: validation.pool || validation.port ? 'fail' : 'ok'
    },
    {
      id: 'engine',
      label: t('dashboard.checkEngine'),
      value: stateLabel.value,
      state: engineState.value
    },
    {
      id: 'temperature',
      label: t('metric.temperature'),
      value: `${formatSensor(temperature, ' °C')} · ${
        temperatureLimit.value > 0
          ? t('dashboard.limitValue', { value: `${temperatureLimit.value} °C` })
          : t('config.limitOff')
      }`,
      state:
        temperatureLimit.value === 0
          ? 'off'
          : temperature === null
            ? 'warn'
            : temperature >= temperatureLimit.value
              ? 'fail'
              : 'ok',
      blocksStart: true
    },
    {
      id: 'battery',
      label: t('metric.battery'),
      value: `${formatSensor(level, '%')} · ${
        batteryFloor.value > 0
          ? t('dashboard.limitValue', { value: `${batteryFloor.value}%` })
          : t('config.limitOff')
      }`,
      state:
        batteryFloor.value === 0
          ? 'off'
          : level === null
            ? 'warn'
            : level <= batteryFloor.value
              ? 'fail'
              : 'ok',
      blocksStart: true
    }
  ];
  if (chargerRequired.value) {
    list.push({
      id: 'charger',
      label: t('dashboard.checkCharger'),
      value: props.device.isCharging ? t('dashboard.checkConnected') : t('dashboard.checkRequired'),
      state: props.device.isCharging ? 'ok' : 'fail',
      blocksStart: true
    });
  }
  return list;
});
const safetyBlocked = computed(() =>
  checks.value.some((check) => check.blocksStart && check.state === 'fail')
);
const checkIcon: Record<CheckState, string> = {
  ok: 'check_circle',
  warn: 'error',
  fail: 'cancel',
  off: 'do_not_disturb_on'
};
const action = computed(() =>
  !setupReady.value
    ? t('dashboard.completeSetup')
    : props.backendState === 'missing'
      ? t('dashboard.downloadStart')
      : props.backendState === 'error'
        ? t('dashboard.tryAgain')
        : t('dashboard.startMining')
);
const stateLabel = computed(
  () =>
    ({
      checking: t('dashboard.engineChecking'),
      ready: t('dashboard.engineReady'),
      missing: t('dashboard.engineMissing'),
      downloading: t('dashboard.engineDownloading'),
      error: t('dashboard.engineError'),
      'web-unavailable': t('dashboard.engineWeb')
    })[props.backendState]
);
const dateTime = (value: number | string): string =>
  formatDate(value, { dateStyle: 'medium', timeStyle: 'short' });
const remove = () => {
  if (selected.value && window.confirm(t('dashboard.confirmDelete'))) {
    emit('deleteSession', selected.value.id);
    selected.value = null;
  }
};
const clear = () => {
  if (window.confirm(t('dashboard.confirmClear'))) emit('clearSessions');
};
const panel = ref<HTMLElement | null>(null);
useDialogFocus(
  () => Boolean(selected.value),
  panel,
  () => {
    selected.value = null;
  }
);
</script>
<template>
  <div class="app-page phone-page dashboard-page md:grid md:grid-cols-2 md:items-start">
    <header class="hm-top md:col-span-2">
      <div class="min-w-0">
        <h1>{{ $t('nav.overview') }}</h1>
        <p>{{ config.coin.symbol }} · {{ config.algorithm }} · {{ config.workerName }}</p>
      </div>
      <span
        class="status-chip"
        :data-tone="
          backendState === 'error' ? 'danger' : backendState === 'ready' ? 'accent' : 'warn'
        "
        role="status"
        >{{ stateLabel }}</span
      >
    </header>
    <section class="hm-hero" :aria-label="$t('dashboard.miningControl')">
      <div class="hm-coin">
        <CoinIcon :symbol="config.coin.symbol" :name="config.coin.name" :size="36" />
        <div class="min-w-0">
          <h2>{{ config.coin.name }}</h2>
          <p>{{ $t('dashboard.cpuMining', { algorithm: config.algorithm }) }}</p>
        </div>
      </div>
      <ul class="hm-checks" :aria-label="$t('dashboard.readyTitle')">
        <li v-for="check in checks" :key="check.id" :data-state="check.state">
          <MaterialIcon :name="checkIcon[check.state]" :size="20" filled />
          <span>{{ check.label }}</span>
          <strong>{{ check.value }}</strong>
        </li>
      </ul>
      <div class="hm-actions">
        <button
          class="primary-button"
          :disabled="setupReady && (!canStart || safetyBlocked)"
          @click="setupReady ? emit('start') : emit('configure')"
        >
          <MaterialIcon name="play_arrow" :size="22" filled />{{ action }}
        </button>
        <button
          class="outline-button hm-tune"
          :aria-label="$t('dashboard.editSetup')"
          @click="emit('configure')"
        >
          <MaterialIcon name="tune" :size="21" />
        </button>
      </div>
      <p class="hm-hint">
        {{
          !setupReady
            ? $t('dashboard.hintSetup')
            : backendState === 'web-unavailable'
              ? $t('dashboard.hintPreview')
              : $t('dashboard.hintStart')
        }}
      </p>
      <div v-if="backendState === 'error'" class="notice notice-error" role="alert">
        <MaterialIcon name="error" :size="19" />
        <div>
          <strong>{{ $t('dashboard.minerAttention') }}</strong>
          <p>{{ backendMessage }}</p>
          <details v-if="logs.length">
            <summary>{{ $t('dashboard.latestOutput') }}</summary>
            <pre class="terminal">{{ logs.slice(-8).join('\n') }}</pre>
          </details>
        </div>
      </div>
    </section>
    <section class="hm-vitals" :aria-label="$t('dashboard.deviceReadings')">
      <article>
        <span class="eyebrow">{{
          device.thermalSource === 'battery' ? $t('metric.batteryTemp') : $t('metric.temperature')
        }}</span>
        <strong :data-unavailable="device.temperatureC === null">{{
          formatSensor(device.temperatureC, ' °C')
        }}</strong>
      </article>
      <article>
        <span class="eyebrow">{{ $t('metric.battery') }}</span>
        <strong :data-unavailable="device.batteryLevel === null">{{
          formatSensor(device.batteryLevel, '%')
        }}</strong>
      </article>
      <article>
        <span class="eyebrow">{{ $t('metric.cpuThreads') }}</span>
        <strong
          >{{ config.threadCount }} <small>/ {{ config.totalDetectedThreads }}</small></strong
        >
      </article>
      <button class="hm-vitals-link text-button" @click="emit('device')">
        {{ $t('dashboard.allDevice') }}<MaterialIcon name="arrow_forward" :size="18" />
      </button>
    </section>
    <section class="setup-surface open-section">
      <div class="section-heading">
        <h3>{{ $t('dashboard.connectionSetup') }}</h3>
        <button class="text-button" @click="emit('profiles')">
          {{ $t('nav.profiles') }}<MaterialIcon name="chevron_right" :size="18" />
        </button>
      </div>
      <div class="configuration-name">
        <div>
          <strong>{{ activeProfile?.name || $t('dashboard.unsavedSetup') }}</strong>
          <p>
            {{
              $t('dashboard.threadsAlgo', {
                threads: config.threadCount,
                algorithm: config.algorithm
              })
            }}
          </p>
        </div>
      </div>
      <dl class="configuration-list">
        <div>
          <dt>{{ $t('metric.pool') }}</dt>
          <dd>
            {{ config.poolUrl }}:{{ config.poolPort
            }}<small>{{ connected ? $t('metric.connected') : $t('dashboard.notConnected') }}</small>
          </dd>
        </div>
        <div>
          <dt>{{ $t('metric.wallet') }}</dt>
          <dd>
            {{
              walletReady
                ? config.walletAddress.length > 18
                  ? config.walletAddress.slice(0, 7) + '…' + config.walletAddress.slice(-6)
                  : config.walletAddress
                : $t('dashboard.addWallet')
            }}<small v-if="!walletReady">{{ $t('dashboard.walletRequired') }}</small>
          </dd>
        </div>
        <div>
          <dt>{{ $t('metric.worker') }}</dt>
          <dd>{{ config.workerName }}</dd>
        </div>
      </dl>
      <button class="text-button configuration-edit" @click="emit('configure')">
        {{ $t('dashboard.reviewConfig') }}<MaterialIcon name="arrow_forward" :size="18" />
      </button>
    </section>
    <section class="open-section recent-surface" aria-labelledby="recent-runs-title">
      <div class="section-heading">
        <div>
          <h3 id="recent-runs-title">{{ $t('dashboard.recentRuns') }}</h3>
          <p class="mt-1 text-caption text-app-muted">{{ $t('dashboard.recentSub') }}</p>
        </div>
        <button class="text-button" @click="emit('statistics')">
          {{ $t('dashboard.allRuns') }} <MaterialIcon name="arrow_forward" :size="18" />
        </button>
      </div>
      <div v-if="!sessionHistory.length" class="empty-run-message">
        <div class="min-w-0">
          <strong class="text-sm font-semibold">{{ $t('dashboard.noRuns') }}</strong>
          <p class="mt-1 max-w-prose text-caption text-app-muted">
            {{ $t('dashboard.noRunsBody') }}
          </p>
        </div>
      </div>
      <template v-else>
        <div class="recent-run-list">
          <RecentRunCard
            v-for="run in sessionHistory.slice(0, 3)"
            :key="run.id"
            :run="run"
            @select="selected = $event"
          />
        </div>
        <div
          class="mt-4 flex flex-wrap items-center justify-between gap-x-4 border-t border-app-line pt-2"
        >
          <p class="text-[0.75rem] text-app-muted">
            {{
              $t('dashboard.showing', {
                shown: Math.min(sessionHistory.length, 3),
                total: sessionHistory.length
              })
            }}
          </p>
          <button class="text-button text-app-muted" @click="clear">
            <MaterialIcon name="delete_sweep" :size="18" />{{ $t('dashboard.clearHistory') }}
          </button>
        </div>
      </template>
    </section>
    <div
      v-if="selected"
      class="modal-backdrop"
      @click.self="selected = null"
      @keydown.esc="selected = null"
    >
      <section
        ref="panel"
        tabindex="-1"
        class="detail-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('run.details')"
      >
        <div class="section-heading">
          <h3>{{ $t('run.sessionTitle', { symbol: selected.coinSymbol }) }}</h3>
          <button
            class="outline-button"
            :aria-label="$t('run.closeDetails')"
            autofocus
            @click="selected = null"
          >
            <MaterialIcon name="close" :size="20" />
          </button>
        </div>
        <p v-if="selected.endReason" class="section-copy" role="status">{{ selected.endReason }}</p>
        <dl class="definition-list">
          <div>
            <dt>{{ $t('run.ended') }}</dt>
            <dd>{{ dateTime(selected.endedAt) }}</dd>
          </div>
          <div>
            <dt>{{ $t('run.duration') }}</dt>
            <dd>{{ formatDuration(selected.durationSeconds) }}</dd>
          </div>
          <div>
            <dt>{{ $t('run.avgRecorded') }}</dt>
            <dd>
              {{ formatHashrate(selected.averageHashrate)
              }}<small v-if="selected.sampleCount !== undefined">
                ·
                {{
                  $t('run.samplesWindow', {
                    count: selected.sampleCount,
                    seconds: selected.sampleWindowSeconds
                  })
                }}</small
              >
            </dd>
          </div>
          <div>
            <dt>{{ $t('run.acceptedRejected') }}</dt>
            <dd>{{ selected.acceptedShares }} / {{ selected.rejectedShares }}</dd>
          </div>
        </dl>
        <section v-if="selected.protectionEvents?.length" class="dv-group">
          <h4 class="eyebrow">{{ $t('protection.events') }}</h4>
          <p v-if="selected.protectionSeconds" class="section-copy">
            {{
              $t('protection.durations', {
                caution: formatDuration(selected.protectionSeconds.caution),
                throttled: formatDuration(selected.protectionSeconds.throttled)
              })
            }}
          </p>
          <ProtectionEventList :events="selected.protectionEvents" />
        </section>
        <button class="outline-button danger-text" @click="remove">
          {{ $t('dashboard.deleteSession') }}
        </button>
      </section>
    </div>
  </div>
</template>
