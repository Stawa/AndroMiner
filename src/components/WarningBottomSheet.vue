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
        <h2 id="guard-title" class="dialog-title">Mining is paused</h2>
        <button class="outline-button" aria-label="Dismiss safety warning" @click="emit('dismiss')">
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
              ? `Temperature reached the configured limit (${threshold} °C). Let the phone cool before continuing.`
              : `Battery fell below the configured limit (${threshold}%). Charge the phone before continuing.`)
          }}
        </p>
      </div>
      <p class="section-copy">
        Native protection checks all limits before starting again. Resume requires your
        confirmation.
      </p>
      <div class="guard-actions">
        <button v-if="type === 'thermal'" class="primary-button" @click="emit('lowerPerformance')">
          Switch to Battery Saver</button
        ><button class="outline-button" @click="emit('resume')">Resume mining</button
        ><button class="text-button" @click="emit('dismiss')">Keep paused</button>
      </div>
    </section>
  </div>
</template>
