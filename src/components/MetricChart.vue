<script setup lang="ts">
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions
} from 'chart.js';
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import type { HistoryPoint } from '../types/mining';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface MetricChartProps {
  title: string;
  subtitle: string;
  points: HistoryPoint[];
  accent: string;
  unit: string;
}

const props = defineProps<MetricChartProps>();

const chartData = computed<ChartData<'line'>>(() => ({
  labels: props.points.map((point) => point.label),
  datasets: [
    {
      label: props.title,
      data: props.points.map((point) => point.value),
      borderColor: props.accent,
      backgroundColor: `${props.accent}24`,
      borderWidth: 2,
      tension: 0.42,
      fill: true,
      pointRadius: 0,
      pointHoverRadius: 4
    }
  ]
}));

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 550,
    easing: 'easeOutQuart'
  },
  interaction: {
    intersect: false,
    mode: 'index'
  },
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      displayColors: false,
      callbacks: {
        label: (context) => `${Number(context.parsed.y).toFixed(2)} ${props.unit}`
      }
    }
  },
  scales: {
    x: {
      grid: {
        display: false
      },
      ticks: {
        display: false,
        maxRotation: 0
      },
      border: {
        display: false
      }
    },
    y: {
      grid: {
        color: 'rgba(148, 163, 184, 0.16)'
      },
      ticks: {
        color: 'rgba(100, 116, 139, 0.78)',
        callback: (value) => `${value}${props.unit === '°C' ? '°' : ''}`,
        maxTicksLimit: 4
      },
      border: {
        display: false
      }
    }
  }
}));
</script>

<template>
  <section class="app-card p-4">
    <div class="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 class="text-[16px] font-semibold leading-6 text-white">{{ title }}</h2>
        <p class="text-[12px] leading-[18px] text-app-muted">{{ subtitle }}</p>
      </div>
      <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: accent }" />
    </div>
    <div class="h-48 min-w-0">
      <Line :data="chartData" :options="chartOptions" />
    </div>
  </section>
</template>
