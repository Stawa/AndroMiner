<script setup lang="ts">
import MaterialIcon from '../components/MaterialIcon.vue';
const help = [
  {
    title: 'The speed says Waiting',
    body: 'XMRig must connect, receive work, and produce a speed sample first. Open Miner output or Diagnostics to see the actual startup progress. Waiting is not measured zero.'
  },
  {
    title: 'The pool will not connect',
    body: 'Check the pool host, port, wallet, and selected protocol. TLS requires the TLS miner variant. Look for the specific authentication, DNS, or TLS error in Miner output.'
  },
  {
    title: 'The speed says Stale',
    body: 'The last measured sample is too old. Check connection status and miner output. Reconnecting can take time; a stale value is not a new measurement.'
  },
  {
    title: 'Android stops the miner',
    body: 'A foreground service keeps native protection and a Stop notification active. Android may still end the app; mining never restarts automatically. Removing the app from recents ends the run. Use short, supervised sessions.'
  },
  {
    title: 'Temperature or CPU readings are unavailable',
    body: 'Some Android devices restrict sensor and process readings. Battery temperature is labeled as battery temperature. Missing readings do not mean the phone is cool or idle.'
  },
  {
    title: 'Shares do not appear immediately',
    body: 'Shares depend on the pool difficulty and your speed. Accepted and rejected counts come from the miner. The app does not estimate payouts or fabricate share counts.'
  },
  {
    title: 'CPU affinity fails',
    body: 'Choose All cores in Mining → Engine and retry. Android devices may not expose core topology or allow core pinning. Custom affinity currently uses Android scheduling.'
  }
];
</script>
<template>
  <div class="app-page phone-page redesign-page help-page md:grid md:grid-cols-2 md:items-stretch">
    <header class="screen-heading">
      <h1>Help & support</h1>
      <p>A few practical steps for a supervised test run.</p>
    </header>
    <section class="surface">
      <h3 class="section-title">Your first run</h3>
      <ol class="quick-start">
        <li>
          <strong>Choose a supported coin.</strong>
          <p>Open Mining → Setup, then select an XMRig-compatible coin.</p>
        </li>
        <li>
          <strong>Add your pool and wallet.</strong>
          <p>Enter the matching address, port, and protocol. Use a wallet you control.</p>
        </li>
        <li>
          <strong>Start gently.</strong>
          <p>Choose Battery Saver in Engine. Review the temperature limit in Safety.</p>
        </li>
        <li>
          <strong>Watch the first samples.</strong>
          <p>
            Start from the dashboard, download the miner if prompted, and confirm the workload.
            Watch speed, shares, and heat; stop to save your run.
          </p>
        </li>
      </ol>
    </section>
    <section class="surface">
      <h3 class="section-title">Troubleshooting</h3>
      <details v-for="item in help" :key="item.title" class="help-item">
        <summary>{{ item.title }}</summary>
        <p class="section-copy">{{ item.body }}</p>
      </details>
    </section>
    <a
      class="outline-button"
      href="https://github.com/Stawa/AndroMiner"
      target="_blank"
      rel="noopener noreferrer"
      ><MaterialIcon name="code" :size="20" />Project & issue tracker<MaterialIcon
        name="open_in_new"
        :size="18"
    /></a>
  </div>
</template>
