<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import MaterialIcon from './MaterialIcon.vue';

const props = withDefaults(
  defineProps<{ symbol: string; name?: string; size?: number; decorative?: boolean }>(),
  { size: 36, decorative: true }
);
const assets = import.meta.glob<string>('../assets/coins/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
});
const source = computed(() => assets[`../assets/coins/${props.symbol.toLowerCase()}.png`]);
const failed = ref(false);
watch(source, () => {
  failed.value = false;
});
</script>

<template>
  <span
    class="coin-icon"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :data-coin="symbol.toLowerCase()"
    :role="decorative ? undefined : 'img'"
    :aria-hidden="decorative ? true : undefined"
    :aria-label="decorative ? undefined : name || symbol"
  >
    <img
      v-if="source && !failed"
      :src="source"
      alt=""
      :width="size"
      :height="size"
      decoding="async"
      @error="failed = true"
    />
    <MaterialIcon v-else name="memory" :size="Math.round(size * 0.58)" />
  </span>
</template>
