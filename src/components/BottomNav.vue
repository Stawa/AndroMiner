<script setup lang="ts">
import MaterialIcon from './MaterialIcon.vue';

export type AppTab =
  'dashboard' | 'mining' | 'statistics' | 'device' | 'settings' | 'profiles' | 'help' | 'about';

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
  { id: 'dashboard', label: 'nav.overview', icon: 'home' },
  { id: 'mining', label: 'nav.miner', icon: 'tune' },
  { id: 'statistics', label: 'nav.history', icon: 'bar_chart' },
  { id: 'device', label: 'nav.device', icon: 'smartphone' },
  { id: 'settings', label: 'nav.settings', icon: 'settings' }
];
const secondaryItems: NavItem[] = [
  { id: 'profiles', label: 'nav.profiles', icon: 'tune' },
  { id: 'help', label: 'nav.help', icon: 'help' },
  { id: 'about', label: 'nav.about', icon: 'info' }
];
</script>

<template>
  <nav class="app-bottom-nav" :aria-label="$t('nav.main')">
    <div
      class="nav-primary mx-auto grid h-18 max-w-phone grid-cols-5 px-2 md:flex md:h-auto md:flex-col md:gap-1.5"
    >
      <button
        v-for="item in items"
        :key="item.id"
        class="bottom-nav-button flex min-w-0 flex-col items-center justify-center gap-1.5 text-[0.75rem] font-medium md:min-h-[72px] md:text-[0.75rem]"
        :class="{ 'bottom-nav-button-active': modelValue === item.id }"
        :aria-current="modelValue === item.id ? 'page' : undefined"
        type="button"
        @click="emit('update:modelValue', item.id)"
      >
        <span class="bottom-nav-icon grid h-8 w-14 place-items-center rounded-control md:w-12">
          <MaterialIcon :name="item.icon" :size="21" :filled="modelValue === item.id" />
        </span>
        <span class="max-w-full break-words text-center">{{ $t(item.label) }}</span>
      </button>
    </div>
    <div
      class="nav-secondary mx-2 mt-5 hidden flex-col gap-1.5 border-t border-app-line pt-4 pb-3 md:flex"
    >
      <button
        v-for="item in secondaryItems"
        :key="item.id"
        class="bottom-nav-button flex min-w-0 flex-col items-center justify-center gap-1.5 text-[0.75rem] font-medium md:min-h-[72px] md:text-[0.75rem]"
        :class="{ 'bottom-nav-button-active': modelValue === item.id }"
        :aria-current="modelValue === item.id ? 'page' : undefined"
        @click="emit('update:modelValue', item.id)"
      >
        <span class="bottom-nav-icon grid h-8 w-14 place-items-center rounded-control md:w-12"
          ><MaterialIcon :name="item.icon" :size="21" /></span
        ><span>{{ $t(item.label) }}</span>
      </button>
    </div>
  </nav>
</template>
