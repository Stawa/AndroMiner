<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { CrashRestart } from '../types/mining';
import MaterialIcon from './MaterialIcon.vue';

const props = defineProps<{ crash: CrashRestart }>();
defineEmits<{ restart: []; cancel: [] }>();

const now = ref(Date.now());
let tick = 0;
onMounted(() => {
  tick = window.setInterval(() => (now.value = Date.now()), 500);
});
onUnmounted(() => window.clearInterval(tick));

const seconds = computed(() =>
  props.crash.deadlineAt === undefined
    ? 0
    : Math.max(0, Math.ceil((props.crash.deadlineAt - now.value) / 1000))
);
</script>

<template>
  <div class="app-page phone-page data-feedback" role="alertdialog" aria-labelledby="crash-title">
    <div class="notice crash-prompt">
      <MaterialIcon name="restart_alt" :size="20" />
      <div>
        <strong id="crash-title">{{ $t('crash.title') }}</strong>
        <p v-if="crash.pending" role="status" aria-live="polite">
          {{
            $t('crash.pending', {
              seconds,
              attempt: crash.attempt,
              max: crash.maxAttempts
            })
          }}
        </p>
        <p v-else-if="crash.failed">{{ $t('crash.failed', { message: crash.message ?? '' }) }}</p>
        <p v-else>{{ $t('crash.exhausted', { max: crash.maxAttempts }) }}</p>
        <div v-if="crash.pending" class="crash-actions">
          <button class="primary-button" type="button" @click="$emit('restart')">
            {{ $t('crash.restartNow') }}
          </button>
          <button class="outline-button" type="button" @click="$emit('cancel')">
            {{ $t('crash.cancel') }}
          </button>
        </div>
        <div v-else class="crash-actions">
          <button class="outline-button" type="button" @click="$emit('cancel')">
            {{ $t('crash.dismiss') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.crash-prompt {
  align-items: flex-start;
}
.crash-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
</style>
