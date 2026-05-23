<script setup lang="ts">
import SettingGroup from '../components/SettingGroup.vue';
import MaterialIcon from '../components/MaterialIcon.vue';
import type { DeviceTelemetry } from '../types/mining';

interface AboutViewProps {
  device: DeviceTelemetry;
}

defineProps<AboutViewProps>();
</script>

<template>
  <div class="phone-page">
    <section class="app-card p-4">
      <div class="flex items-center gap-3">
        <div
          class="grid h-14 w-14 place-items-center rounded-full border-2 border-app-green text-app-green"
        >
          <MaterialIcon name="power_settings_new" :size="30" />
        </div>
        <div>
          <h2 class="text-[20px] font-semibold text-white">AndroMiner</h2>
          <p class="text-[13px] text-app-muted">Version 1.0.0 · Capacitor Android</p>
        </div>
      </div>
    </section>

    <SettingGroup title="Detected Android device" icon="phone_android">
      <div class="divide-y divide-app-line border-t border-app-line">
        <div class="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[14px]">
          <span class="text-app-muted">Model</span
          ><strong class="text-right font-medium text-white">{{ device.model }}</strong>
        </div>
        <div class="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[14px]">
          <span class="text-app-muted">Platform</span
          ><strong class="text-right font-medium text-white">{{ device.platform }}</strong>
        </div>
        <div class="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[14px]">
          <span class="text-app-muted">OS</span
          ><strong class="text-right font-medium text-white"
            >{{ device.operatingSystem }} {{ device.osVersion }}</strong
          >
        </div>
        <div class="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[14px]">
          <span class="text-app-muted">CPU threads</span
          ><strong class="text-right font-medium text-white">{{ device.cpuThreads }}</strong>
        </div>
        <div class="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[14px]">
          <span class="text-app-muted">Battery</span
          ><strong class="text-right font-medium text-white"
            >{{ Math.round(device.batteryLevel) }}% ·
            {{ device.isCharging ? 'Charging' : 'Unplugged' }}</strong
          >
        </div>
        <div class="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[14px]">
          <span class="text-app-muted">Temperature</span
          ><strong class="text-right font-medium text-white">{{
            device.temperatureC === null ? 'Unavailable' : `${Math.round(device.temperatureC)} °C`
          }}</strong>
        </div>
        <div class="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[14px]">
          <span class="text-app-muted">Thermal source</span
          ><strong class="text-right font-medium text-white">{{
            device.thermalSensorName
              ? `${device.thermalSource} · ${device.thermalSensorName}`
              : device.thermalSource
          }}</strong>
        </div>
      </div>
    </SettingGroup>

    <SettingGroup title="Android permissions" icon="admin_panel_settings">
      <div class="space-y-3 border-t border-app-line p-4 text-[13px] leading-5 text-app-muted">
        <p>
          Configured for internet/pool access, wake lock, foreground-service mining, notifications,
          battery optimization request, and network-state awareness.
        </p>
        <p>
          Actual mining requires the app to download the ARM64 XMRig binary into its private miners
          directory after user approval.
        </p>
      </div>
    </SettingGroup>
  </div>
</template>
