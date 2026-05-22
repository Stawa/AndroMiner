<script setup lang="ts">
import MaterialIcon from './MaterialIcon.vue';

export type AppTab =
  | 'dashboard'
  | 'mining'
  | 'statistics'
  | 'settings'
  | 'profiles'
  | 'help'
  | 'about';

interface NavItem {
  id: AppTab;
  label: string;
  icon: string;
}

interface BottomNavProps {
  modelValue: AppTab;
}

defineProps<BottomNavProps>();

const emit = defineEmits<{
  'update:modelValue': [value: AppTab];
}>();

const items: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'space_dashboard' },
  { id: 'mining', label: 'Mining', icon: 'handyman' },
  { id: 'statistics', label: 'Statistics', icon: 'bar_chart_4_bars' },
  { id: 'settings', label: 'Settings', icon: 'settings' }
];
</script>

<template>
  <nav class="app-bottom-nav">
    <div class="mx-auto grid h-20 max-w-[420px] grid-cols-4 px-2">
      <button
        v-for="item in items"
        :key="item.id"
        class="bottom-nav-button"
        :class="{ 'bottom-nav-button-active': modelValue === item.id }"
        type="button"
        @click="emit('update:modelValue', item.id)"
      >
        <span class="bottom-nav-icon">
          <MaterialIcon :name="item.icon" :size="21" :filled="modelValue === item.id" />
        </span>
        <span class="max-w-full truncate">{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>
