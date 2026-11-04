<script setup lang="ts">
import { computed } from 'vue';
import { formatDate, t } from '../i18n';
import type { ProtectionEvent } from '../types/mining';
import { explainEvent } from '../utils/protection';

const props = defineProps<{ events: ProtectionEvent[] }>();

const rows = computed(() =>
  [...props.events].reverse().map((event) => {
    const { key, params, readingKey } = explainEvent(event);
    return {
      id: `${event.at}-${event.type}-${event.newState}`,
      time: formatDate(event.at, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      text: t(key, readingKey ? { ...params, reading: t(readingKey).toLowerCase() } : params),
      detail:
        event.value === null
          ? ''
          : t('protection.event.detail', {
              value: params.value,
              threshold: params.threshold,
              from: event.previousIntensity,
              to: event.newIntensity
            }),
      tone: event.action === 'stop' ? 'danger' : event.action === 'restore' ? 'accent' : 'warn'
    };
  })
);
</script>

<template>
  <ol v-if="rows.length" class="pe-list">
    <li v-for="row in rows" :key="row.id" :data-tone="row.tone">
      <time>{{ row.time }}</time>
      <div>
        <p>{{ row.text }}</p>
        <p v-if="row.detail" class="pe-detail">{{ row.detail }}</p>
      </div>
    </li>
  </ol>
  <p v-else class="dv-note">{{ $t('protection.noEvents') }}</p>
</template>
