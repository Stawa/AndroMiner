<script setup lang="ts">
interface MaterialIconProps {
  name: string;
  size?: number;
  filled?: boolean;
}

withDefaults(defineProps<MaterialIconProps>(), {
  size: 24,
  filled: false
});
</script>

<template>
  <span
    class="material-symbols-rounded select-none leading-none"
    :class="{ 'icon-filled': filled }"
    :style="{ fontSize: `${size}px`, width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  >
    {{ name }}
  </span>
</template>
