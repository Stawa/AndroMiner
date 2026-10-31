<script setup lang="ts">
import { ref } from 'vue';
import MaterialIcon from './MaterialIcon.vue';
import { useDialogFocus } from '../composables/useDialogFocus';

export type WarningType = 'thermal' | 'battery';

interface WarningBottomSheetProps {
  open: boolean;
  type: WarningType;
  threshold: number;
  message?: string;
}

const props = defineProps<WarningBottomSheetProps>();

const emit = defineEmits<{
  resume: [];
  lowerPerformance: [];
  ignore: [];
  dismiss: [];
}>();
const panel = ref<HTMLElement | null>(null);
useDialogFocus(
  () => props.open,
  panel,
  () => {
    emit('dismiss');
  }
);
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('dismiss')">
    <section
      ref="panel"
      class="detail-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guard-title"
      tabindex="-1"
    >
      <div class="section-heading">
        <h2 id="guard-title" class="dialog-title">{{ $t('guard.title') }}</h2>
        <button class="outline-button" :aria-label="$t('guard.dismiss')" @click="emit('dismiss')">
          <MaterialIcon name="close" :size="20" />
        </button>
      </div>
      <div class="notice">
        <MaterialIcon
          :name="type === 'thermal' ? 'device_thermostat' : 'battery_alert'"
          :size="22"
        />
        <p>
          {{
            message ||
            (type === 'thermal'
              ? $t('guard.thermal', { threshold })
              : $t('guard.battery', { threshold }))
          }}
        </p>
      </div>
      <p class="section-copy">
        {{ $t('guard.note') }}
      </p>
      <div class="guard-actions">
        <button v-if="type === 'thermal'" class="primary-button" @click="emit('lowerPerformance')">
          {{ $t('guard.switchSaver') }}</button
        ><button class="outline-button" @click="emit('resume')">{{ $t('guard.resume') }}</button
        ><button class="text-button" @click="emit('dismiss')">{{ $t('guard.keepPaused') }}</button>
      </div>
    </section>
  </div>
</template>
