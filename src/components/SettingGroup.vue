<script setup lang="ts">
import MaterialIcon from './MaterialIcon.vue';

interface SettingGroupProps {
  title?: string;
  icon?: string;
}

withDefaults(defineProps<SettingGroupProps>(), {
  title: '',
  icon: ''
});
</script>

<template>
  <section class="app-card overflow-hidden">
    <div v-if="title" class="settings-heading">
      <MaterialIcon v-if="icon" :name="icon" :size="20" />
      <span>{{ title }}</span>
    </div>
    <slot />
  </section>
</template>
