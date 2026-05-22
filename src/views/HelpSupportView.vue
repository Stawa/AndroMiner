<script setup lang="ts">
import SettingGroup from '../components/SettingGroup.vue';
</script>

<template>
  <div class="phone-page">
    <SettingGroup title="Getting started" icon="help">
      <div class="space-y-3 border-t border-app-line p-4 text-[13px] leading-5 text-app-muted">
        <p><strong class="text-white">1.</strong> Choose a coin and profile in Mining setup.</p>
        <p>
          <strong class="text-white">2.</strong> Enter pool, port, protocol, wallet, worker, and
          password.
        </p>
        <p>
          <strong class="text-white">3.</strong> Save a profile if you want to reuse the
          configuration.
        </p>
        <p>
          <strong class="text-white">4.</strong> Start mining from Dashboard or Save & Start Mining.
        </p>
      </div>
    </SettingGroup>

    <SettingGroup title="Device detection" icon="memory">
      <div class="space-y-3 border-t border-app-line p-4 text-[13px] leading-5 text-app-muted">
        <p>Battery and charging are read through Capacitor Device on Android when available.</p>
        <p>
          CPU threads use native web runtime detection and are mirrored into the mining profile.
        </p>
        <p>
          Thermal status is estimated in the web layer until a native Android thermal plugin is
          connected.
        </p>
      </div>
    </SettingGroup>

    <SettingGroup title="Repository" icon="code">
      <a
        class="setting-row ripple text-left"
        href="https://github.com/Stawa/AndroMiner"
        target="_blank"
        rel="noreferrer"
      >
        <span class="min-w-0 flex-1">
          <span class="block text-[15px] font-medium leading-5 text-white">GitHub project</span>
          <span class="mt-1 block break-all text-[12px] leading-[18px] text-app-muted"
            >https://github.com/Stawa/AndroMiner</span
          >
        </span>
      </a>
    </SettingGroup>
  </div>
</template>
