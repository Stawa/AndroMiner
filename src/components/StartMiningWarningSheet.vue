<script setup lang="ts">
import { computed, ref } from 'vue';
import MaterialIcon from './MaterialIcon.vue';
import { useDialogFocus } from '../composables/useDialogFocus';
import type { MiningConfig } from '../types/mining';
import { t } from '../i18n';

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
  return t(`affinity.${props.config.affinity}`);
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
        <h2 id="start-title" class="dialog-title">{{ $t('start.title') }}</h2>
        <button class="outline-button" :aria-label="$t('start.close')" @click="emit('cancel')">
          <MaterialIcon name="close" :size="20" />
        </button>
      </div>
      <p class="section-copy">
        {{ $t('start.copy') }}
      </p>
      <dl class="definition-list">
        <div>
          <dt>{{ $t('start.coin') }}</dt>
          <dd>{{ config.coin.name }} · {{ config.algorithm }}</dd>
        </div>
        <div>
          <dt>{{ $t('start.threads') }}</dt>
          <dd>{{ threadLabel }} · {{ coreLabel }}</dd>
        </div>
        <div>
          <dt>{{ $t('start.pool') }}</dt>
          <dd>{{ config.poolUrl }}:{{ config.poolPort }}</dd>
        </div>
        <div>
          <dt>{{ $t('start.tempLimit') }}</dt>
          <dd>
            {{
              config.thermalThreshold > 0 ? `${config.thermalThreshold} °C` : $t('config.limitOff')
            }}
          </dd>
        </div>
        <div>
          <dt>{{ $t('start.background') }}</dt>
          <dd>
            {{
              config.backgroundMining && !config.autoPauseScreenOff
                ? $t('start.allowed')
                : $t('start.pauseHidden')
            }}
          </dd>
        </div>
      </dl>
      <div class="notice">
        <MaterialIcon name="warning" :size="20" />
        <p>
          {{ $t('start.notice') }}
        </p>
      </div>
      <div class="action-row dialog-actions">
        <button class="outline-button" @click="emit('cancel')">{{ $t('start.back') }}</button
        ><button class="primary-button" @click="emit('confirm')">
          <MaterialIcon name="play_arrow" :size="20" />{{ $t('start.confirm') }}
        </button>
      </div>
    </section>
  </div>
</template>
