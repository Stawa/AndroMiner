<script setup lang="ts">
import { useDialogFocus } from '../composables/useDialogFocus';
import { computed, ref } from 'vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import CoinIcon from '../components/CoinIcon.vue';
import RecentRunCard from '../components/RecentRunCard.vue';
import { formatSensor, formatHashrate } from '../utils/miningTelemetry';
import { validateMiningSetup } from '../utils/configValidation';
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
  deleteSession: [id: string];
  clearSessions: [];
}>();
const selected = ref<MiningSessionHistoryItem | null>(null);
const walletReady = computed(() => !validateMiningSetup(props.config).wallet);
const setupReady = computed(() => !Object.values(validateMiningSetup(props.config)).some(Boolean));
const canStart = computed(() => ['ready', 'missing', 'error'].includes(props.backendState));
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
  <div
    class="app-page phone-page redesign-page dashboard-page md:grid md:grid-cols-2 md:items-stretch"
  >
    <header class="screen-heading overview-heading">
      <div>
        <h1>{{ $t('nav.overview') }}</h1>
        <p>{{ config.coin.symbol }} · {{ config.algorithm }} · {{ config.workerName }}</p>
      </div>
      <span
        class="hero-pill"
        :data-tone="
          backendState === 'error' ? 'error' : backendState === 'ready' ? 'success' : 'warning'
        "
        role="status"
        >{{ stateLabel }}</span
      >
    </header>
    <section class="overview-miner" :aria-label="$t('dashboard.miningControl')">
      <div class="overview-coin">
        <CoinIcon :symbol="config.coin.symbol" :name="config.coin.name" :size="44" />
        <div>
          <h3>{{ config.coin.name }}</h3>
          <p>{{ $t('dashboard.cpuMining', { algorithm: config.algorithm }) }}</p>
        </div>
      </div>
      <div class="overview-speed">
        <div>
          <p class="metric-label">{{ $t('dashboard.currentHashrate') }}</p>
          <strong>— <span>H/s</span></strong>
        </div>
        <div class="idle-explanation">
          <span>{{ $t('dashboard.noSession') }}</span>
        </div>
      </div>
      <div class="action-row overview-actions">
        <button
          class="primary-button"
          :disabled="setupReady && !canStart"
          @click="setupReady ? emit('start') : emit('configure')"
        >
          <MaterialIcon name="play_arrow" :size="21" />{{ action }}</button
        ><button
          class="outline-button"
          :aria-label="$t('dashboard.editSetup')"
          @click="emit('configure')"
        >
          <MaterialIcon name="tune" :size="21" />
        </button>
      </div>
      <p class="overview-hint">
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
    <section class="overview-device" :aria-label="$t('dashboard.deviceReadings')">
      <div class="section-heading">
        <h3>{{ $t('dashboard.device') }}</h3>
        <span class="supporting-label">{{
          device.platform === 'web'
            ? $t('dashboard.browserReadings')
            : $t('dashboard.nativeReadings')
        }}</span>
      </div>
      <div class="device-tiles">
        <article>
          <p>
            {{
              device.thermalSource === 'battery'
                ? $t('metric.batteryTemp')
                : $t('metric.temperature')
            }}
          </p>
          <strong :data-unavailable="device.temperatureC === null">{{
            formatSensor(device.temperatureC, ' °C')
          }}</strong
          ><small>{{
            device.temperatureC === null
              ? $t('dashboard.sensorMissing')
              : $t('dashboard.deviceReading')
          }}</small>
        </article>
        <article>
          <p>{{ $t('metric.battery') }}</p>
          <strong :data-unavailable="device.batteryLevel === null">{{
            formatSensor(device.batteryLevel, '%')
          }}</strong
          ><small>{{
            device.batteryLevel === null
              ? $t('dashboard.noReading')
              : device.isCharging
                ? $t('metric.charging')
                : $t('dashboard.onBattery')
          }}</small>
        </article>
        <article>
          <p>{{ $t('metric.cpuThreads') }}</p>
          <strong
            >{{ config.threadCount }} <span>/ {{ config.totalDetectedThreads }}</span></strong
          ><small>{{ $t('dashboard.configuredDetected') }}</small>
        </article>
      </div>
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
        <button class="outline-button danger-text" @click="remove">
          {{ $t('dashboard.deleteSession') }}
        </button>
      </section>
    </div>
  </div>
</template>
