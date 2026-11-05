<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useNativeMinerInfo } from '../composables/useNativeMinerInfo';
import { t } from '../i18n';
import type { Cryptocurrency, MiningEngineId } from '../types/mining';
import { downloadableEngines } from '../utils/engineDownloads';
import {
  coinFitsEngine,
  engineForCoin,
  normalizeEngine,
  type NativeEngineInfo
} from '../utils/engines';
import ConfigCard from './ConfigCard.vue';
import ConfigSelect from './ConfigSelect.vue';

const props = defineProps<{
  modelValue: MiningEngineId | undefined;
  coin: Pick<Cryptocurrency, 'name' | 'xmrigAlgo' | 'requiredEngine'>;
  error?: string;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: MiningEngineId];
  download: [];
}>();

const { engines, refreshNativeMinerInfo } = useNativeMinerInfo();
onMounted(() => void refreshNativeMinerInfo());

const selectedId = computed(() => normalizeEngine(props.modelValue));
const selected = computed(() => engines.value.find((engine) => engine.id === selectedId.value));

const installLabel = (engine: NativeEngineInfo): string => {
  if (engine.status === 'unsupported') return t('engine.install.unsupported');
  if (!engine.abiSupported) return t('engine.install.abi');
  if (!engine.installed)
    return t(engine.downloadApproved ? 'engine.install.missingDownload' : 'engine.install.missing');
  return t(engine.source === 'downloaded' ? 'engine.install.downloaded' : 'engine.install.bundled');
};

const fitsCoin = (engine: NativeEngineInfo): boolean =>
  coinFitsEngine(props.coin, normalizeEngine(engine.id), engines.value);

/* Engines that cannot mine the coin or cannot run on Android stay listed but cannot be picked. */
const options = computed(() =>
  engines.value.map((engine) => ({
    value: engine.id,
    label: engine.name,
    supportingText: fitsCoin(engine)
      ? `${t(`engine.status.${engine.status}`)} · ${installLabel(engine)}`
      : t('engine.cannotMine', { coin: props.coin.name }),
    disabled: engine.status === 'unsupported' || !fitsCoin(engine)
  }))
);

const autoEngine = computed(() =>
  engines.value.find((engine) => engine.id === engineForCoin(props.coin, engines.value))
);
const isAuto = computed(() => selectedId.value === autoEngine.value?.id);

const rows = computed(() => {
  const engine = selected.value;
  if (!engine) return [];
  return [
    {
      label: t('engine.version'),
      value: engine.installedVersion ?? (engine.version || t('engine.unknown'))
    },
    { label: t('engine.install.label'), value: installLabel(engine) },
    { label: t('engine.algorithms'), value: engine.algorithms.join(', ') || t('engine.none') },
    { label: t('engine.protocols'), value: engine.protocols.join(', ') || t('engine.none') },
    { label: t('engine.architectures'), value: engine.abis.join(', ') || t('engine.none') },
    {
      label: t('engine.intensity'),
      value: engine.intensityControl.verifiedOnDevice
        ? t('engine.intensityVerified')
        : t('engine.intensityUnverified')
    },
    { label: t('engine.license'), value: engine.license || t('engine.unknown') }
  ];
});

const canDownload = computed(() => downloadableEngines(engines.value).length > 0);

const tone = computed(() =>
  selected.value?.status === 'supported'
    ? 'accent'
    : selected.value?.status === 'experimental'
      ? 'warn'
      : 'danger'
);
</script>

<template>
  <ConfigCard icon="memory" :title="$t('engine.title')">
    <template v-if="engines.length">
      <ConfigSelect
        :model-value="selectedId"
        :label="$t('engine.select')"
        :options="options"
        :searchable="false"
        @update:model-value="(value) => emit('update:modelValue', normalizeEngine(value))"
      />
      <p v-if="autoEngine" class="dv-note eng-hint">
        {{
          isAuto
            ? $t('engine.hintAuto', { coin: coin.name })
            : $t('engine.hintCustom', { engine: autoEngine.name })
        }}
      </p>
      <span v-if="error" class="field-error" role="alert">{{ error }}</span>
      <div v-if="selected" class="eng-details">
        <span class="status-chip" :data-tone="tone">{{
          $t(`engine.status.${selected.status}`)
        }}</span>
        <p v-if="selected.status === 'experimental'" class="dv-note" role="status">
          {{ $t('engine.experimental') }}
        </p>
        <p v-if="selected.note" class="dv-note">{{ selected.note }}</p>
        <button v-if="canDownload" class="outline-button" type="button" @click="emit('download')">
          {{ $t('engine.download') }}
        </button>
        <dl class="dv-list">
          <div v-for="row in rows" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>
      </div>
    </template>
    <p v-else class="dv-note">{{ $t('engine.unavailable') }}</p>
  </ConfigCard>
</template>

<style scoped>
.eng-hint {
  margin-top: 8px;
}
.eng-details {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}
.eng-details .status-chip {
  justify-self: start;
}
</style>
