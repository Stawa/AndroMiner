<script setup lang="ts">
import MaterialIcon from './MaterialIcon.vue';
defineProps<{ icon: string; title: string; subtitle?: string }>();
</script>

<template>
  <section class="cfg-card">
    <header class="cfg-card-head">
      <span class="cfg-card-icon"><MaterialIcon :name="icon" :size="20" /></span>
      <div class="cfg-card-title">
        <h3>{{ title }}</h3>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
      <slot name="aside" />
    </header>
    <div class="cfg-card-body"><slot /></div>
  </section>
</template>
