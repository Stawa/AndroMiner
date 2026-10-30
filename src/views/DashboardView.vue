<script setup lang="ts">
import { useDialogFocus } from '../composables/useDialogFocus';
import { computed, ref } from 'vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import CoinIcon from '../components/CoinIcon.vue';
import RecentRunCard from '../components/RecentRunCard.vue';
import { formatSensor, formatHashrate } from '../utils/miningTelemetry';
import { validateMiningSetup } from '../utils/configValidation';
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
    ? 'Complete setup'
    : props.backendState === 'missing'
      ? 'Download & start'
      : props.backendState === 'error'
        ? 'Try again'
        : 'Start mining'
);
const stateLabel = computed(
  () =>
    ({
      checking: 'Checking engine',
      ready: 'Ready',
      missing: 'Download needed',
      downloading: 'Downloading',
      error: 'Needs attention',
      'web-unavailable': 'Android required'
    })[props.backendState]
);
const duration = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);
const remove = () => {
  if (selected.value && window.confirm('Delete this completed session?')) {
    emit('deleteSession', selected.value.id);
    selected.value = null;
  }
};
const clear = () => {
  if (window.confirm('Clear all completed mining sessions?')) emit('clearSessions');
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
        <h1>Overview</h1>
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
    <section class="overview-miner" aria-label="Mining control">
      <div class="overview-coin">
        <CoinIcon :symbol="config.coin.symbol" :name="config.coin.name" :size="44" />
        <div>
          <h3>{{ config.coin.name }}</h3>
          <p>{{ config.algorithm }} · CPU mining</p>
        </div>
      </div>
      <div class="overview-speed">
        <div>
          <p class="metric-label">Current hashrate</p>
          <strong>— <span>H/s</span></strong>
        </div>
        <div class="idle-explanation">
          <span>No active session</span>
        </div>
      </div>
      <div class="action-row overview-actions">
        <button
          class="primary-button"
          :disabled="setupReady && !canStart"
          @click="setupReady ? emit('start') : emit('configure')"
        >
          <MaterialIcon name="play_arrow" :size="21" />{{ action }}</button
        ><button class="outline-button" aria-label="Edit mining setup" @click="emit('configure')">
          <MaterialIcon name="tune" :size="21" />
        </button>
      </div>
      <p class="overview-hint">
        {{
          !setupReady
            ? 'Add your wallet and review the pool to get started.'
            : backendState === 'web-unavailable'
              ? 'Preview mode. Mining runs in the Android app.'
              : 'Starting requires confirmation. Mining stays visible in Android notifications.'
        }}
      </p>
      <div v-if="backendState === 'error'" class="notice notice-error" role="alert">
        <MaterialIcon name="error" :size="19" />
        <div>
          <strong>Miner needs attention</strong>
          <p>{{ backendMessage }}</p>
          <details v-if="logs.length">
            <summary>Latest miner output</summary>
            <pre class="terminal">{{ logs.slice(-8).join('\n') }}</pre>
          </details>
        </div>
      </div>
    </section>
    <section class="overview-device" aria-label="Device readings">
      <div class="section-heading">
        <h3>Device</h3>
        <span class="supporting-label">{{
          device.platform === 'web' ? 'Browser readings' : 'Native readings'
        }}</span>
      </div>
      <div class="device-tiles">
        <article>
          <p>{{ device.thermalSource === 'battery' ? 'Battery temp' : 'Temperature' }}</p>
          <strong :data-unavailable="device.temperatureC === null">{{
            formatSensor(device.temperatureC, ' °C')
          }}</strong
          ><small>{{
            device.temperatureC === null ? 'Sensor not available' : 'Device reading'
          }}</small>
        </article>
        <article>
          <p>Battery</p>
          <strong :data-unavailable="device.batteryLevel === null">{{
            formatSensor(device.batteryLevel, '%')
          }}</strong
          ><small>{{
            device.batteryLevel === null
              ? 'No reading'
              : device.isCharging
                ? 'Charging'
                : 'On battery'
          }}</small>
        </article>
        <article>
          <p>CPU threads</p>
          <strong
            >{{ config.threadCount }} <span>/ {{ config.totalDetectedThreads }}</span></strong
          ><small>Configured / detected</small>
        </article>
      </div>
    </section>
    <section class="setup-surface open-section">
      <div class="section-heading">
        <h3>Connection setup</h3>
        <button class="text-button" @click="emit('profiles')">
          Profiles<MaterialIcon name="chevron_right" :size="18" />
        </button>
      </div>
      <div class="configuration-name">
        <div>
          <strong>{{ activeProfile?.name || 'Unsaved setup' }}</strong>
          <p>{{ config.threadCount }} CPU threads · {{ config.algorithm }}</p>
        </div>
      </div>
      <dl class="configuration-list">
        <div>
          <dt>Pool</dt>
          <dd>
            {{ config.poolUrl }}:{{ config.poolPort
            }}<small>{{ connected ? 'Connected' : 'Not connected' }}</small>
          </dd>
        </div>
        <div>
          <dt>Wallet</dt>
          <dd>
            {{
              walletReady
                ? config.walletAddress.length > 18
                  ? config.walletAddress.slice(0, 7) + '…' + config.walletAddress.slice(-6)
                  : config.walletAddress
                : 'Add a wallet'
            }}<small v-if="!walletReady">Required before mining</small>
          </dd>
        </div>
        <div>
          <dt>Worker</dt>
          <dd>{{ config.workerName }}</dd>
        </div>
      </dl>
      <button class="text-button configuration-edit" @click="emit('configure')">
        Review configuration<MaterialIcon name="arrow_forward" :size="18" />
      </button>
    </section>
    <section class="open-section recent-surface" aria-labelledby="recent-runs-title">
      <div class="section-heading">
        <div>
          <h3 id="recent-runs-title">Recent runs</h3>
          <p class="mt-1 text-caption text-app-muted">Your latest completed mining sessions.</p>
        </div>
        <button class="text-button" @click="emit('statistics')">
          All runs <MaterialIcon name="arrow_forward" :size="18" />
        </button>
      </div>
      <div v-if="!sessionHistory.length" class="empty-run-message">
        <div class="min-w-0">
          <strong class="text-sm font-semibold">No completed runs yet</strong>
          <p class="mt-1 max-w-prose text-caption text-app-muted">
            Stop a mining session to save its duration, measured speed, and share results here.
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
            Showing {{ Math.min(sessionHistory.length, 3) }} of {{ sessionHistory.length }} runs
          </p>
          <button class="text-button text-app-muted" @click="clear">
            <MaterialIcon name="delete_sweep" :size="18" />Clear history
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
        aria-label="Session details"
      >
        <div class="section-heading">
          <h3>{{ selected.coinSymbol }} session</h3>
          <button
            class="outline-button"
            aria-label="Close session details"
            autofocus
            @click="selected = null"
          >
            <MaterialIcon name="close" :size="20" />
          </button>
        </div>
        <dl class="definition-list">
          <div>
            <dt>Ended</dt>
            <dd>{{ new Date(selected.endedAt).toLocaleString() }}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{{ duration(selected.durationSeconds) }}</dd>
          </div>
          <div>
            <dt>Average</dt>
            <dd>{{ formatHashrate(selected.averageHashrate) }}</dd>
          </div>
          <div>
            <dt>Accepted / rejected</dt>
            <dd>{{ selected.acceptedShares }} / {{ selected.rejectedShares }}</dd>
          </div>
        </dl>
        <button class="outline-button danger-text" @click="remove">Delete session</button>
      </section>
    </div>
  </div>
</template>
