<script setup lang="ts">
export interface BarRow {
  label: string;
  count: number;
  share: number;
}

defineProps<{
  rows: BarRow[];
  /** Rows folded away for privacy or missing data; printed muted, without a bar. */
  notes?: { label: string; count: number }[];
}>();

const number = new Intl.NumberFormat();
const percent = (share: number): string => `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`;
</script>

<template>
  <ul class="bars">
    <li v-for="row in rows" :key="row.label">
      <span class="label">{{ row.label }}</span>
      <span class="count">{{ number.format(row.count) }}</span>
      <span class="share">{{ percent(row.share) }}</span>
      <span class="track" aria-hidden="true">
        <span class="fill" :style="{ width: `${Math.max(1, row.share * 100)}%` }" />
      </span>
    </li>
    <li v-for="note in notes" :key="note.label" class="note">
      <span class="label">{{ note.label }}</span>
      <span class="count">{{ number.format(note.count) }}</span>
    </li>
  </ul>
</template>

<style scoped>
.bars {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 14px;
}
li {
  display: grid;
  grid-template-columns: 1fr auto 3.25rem;
  column-gap: 12px;
  row-gap: 6px;
  align-items: baseline;
  font-size: 0.875rem;
}
.label {
  min-width: 0;
  overflow-wrap: anywhere;
}
.count,
.share {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.count {
  font-weight: 650;
}
.share {
  color: rgb(var(--color-app-muted));
}
.track {
  grid-column: 1 / -1;
  height: 6px;
  border-radius: 3px;
  background: rgb(var(--color-app-elevated));
  overflow: hidden;
}
.fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: rgb(var(--color-app-green));
}
.note {
  color: rgb(var(--color-app-muted));
  grid-template-columns: 1fr auto;
}
</style>
