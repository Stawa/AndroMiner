<script setup lang="ts">
import { computed, ref } from 'vue';
import MaterialIcon from './MaterialIcon.vue';
import { useDialogFocus } from '../composables/useDialogFocus';
import type { MiningConfig } from '../types/mining';

interface StartMiningWarningSheetProps {
  open: boolean;
  config: MiningConfig;
}

const props = defineProps<StartMiningWarningSheetProps>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const coreLabel = computed(() => {
  const labels: Record<MiningConfig['affinity'], string> = {
    auto: 'All cores',
    little: 'Efficiency cores',
    big: 'Performance cores',
    custom: 'Custom affinity'
  };

  return labels[props.config.affinity];
});

const threadLabel = computed(
  () => `${props.config.threadCount}/${props.config.totalDetectedThreads}`
);
const panel = ref<HTMLElement | null>(null);
useDialogFocus(
  () => props.open,
  panel,
  () => {
    emit('cancel');
  }
);
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('cancel')">
    <section
      ref="panel"
      class="detail-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-title"
      tabindex="-1"
    >
      <div class="section-heading">
        <h2 id="start-title" class="dialog-title">Ready to start mining?</h2>
        <button class="outline-button" aria-label="Close start warning" @click="emit('cancel')">
          <MaterialIcon name="close" :size="20" />
        </button>
      </div>
      <p class="section-copy">
        This runs XMRig locally and puts sustained load on your phone. Keep the run supervised and
        stop if the phone becomes hot.
      </p>
      <dl class="definition-list">
        <div>
          <dt>Coin</dt>
          <dd>{{ config.coin.name }} · {{ config.algorithm }}</dd>
        </div>
        <div>
          <dt>CPU threads</dt>
          <dd>{{ threadLabel }} · {{ coreLabel }}</dd>
        </div>
        <div>
          <dt>Pool</dt>
          <dd>{{ config.poolUrl }}:{{ config.poolPort }}</dd>
        </div>
        <div>
          <dt>Temperature limit</dt>
          <dd>{{ config.thermalThreshold }} °C</dd>
        </div>
        <div>
          <dt>Background mining</dt>
          <dd>
            {{
              config.backgroundMining && !config.autoPauseScreenOff
                ? 'Allowed with notification'
                : 'Pause when hidden'
            }}
          </dd>
        </div>
      </dl>
      <div class="notice">
        <MaterialIcon name="warning" :size="20" />
        <p>
          Phone mining has low returns and can accelerate battery wear. Sensor limits do not
          guarantee hardware safety. Native protection also stops at 45 °C battery temperature,
          severe Android thermal throttling, or missing required readings. Resume always requires
          confirmation.
        </p>
      </div>
      <div class="action-row dialog-actions">
        <button class="outline-button" @click="emit('cancel')">Go back</button
        ><button class="primary-button" @click="emit('confirm')">
          <MaterialIcon name="play_arrow" :size="20" />Start mining
        </button>
      </div>
    </section>
  </div>
</template>
