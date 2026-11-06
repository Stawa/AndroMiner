// Hand-written context for each component. Props, emits, slots and imports come from
// components.generated.json (npm run docs:components); this file only adds the "why".
export type ComponentCategory =
  | 'primitives'
  | 'buttons'
  | 'cards'
  | 'dialogs'
  | 'navigation'
  | 'settings'
  | 'charts'
  | 'notifications';

export interface ComponentNote {
  category: ComponentCategory;
  purpose: string;
  notes?: string[];
}

export const categories: { id: ComponentCategory; title: string; intro: string }[] = [
  {
    id: 'primitives',
    title: 'Primitives',
    intro: 'Icons and logos the other components build on.'
  },
  {
    id: 'buttons',
    title: 'Buttons and controls',
    intro:
      'There is no generic Button component. Buttons in the app are plain `<button>` elements styled by global classes in `src/styles/components.css`. The components below are the interactive controls that exist as components.'
  },
  { id: 'cards', title: 'Cards', intro: 'Surfaces that group related content.' },
  {
    id: 'dialogs',
    title: 'Dialogs and sheets',
    intro:
      'Modal bottom sheets. They share `useDialogFocus` (`src/composables/useDialogFocus.ts`) for focus handling and the `modal-backdrop` styles.'
  },
  { id: 'navigation', title: 'Navigation', intro: 'App chrome: header, drawer and tab bar.' },
  {
    id: 'settings',
    title: 'Settings and form controls',
    intro: 'Inputs and rows used on the setup, engine and settings screens.'
  },
  {
    id: 'charts',
    title: 'Charts and metrics',
    intro: 'Live readings and history visualisations.'
  },
  {
    id: 'notifications',
    title: 'Notifications and status',
    intro:
      'In-app banners, prompts and protection status. Native Android notifications are not Vue components; see Native Android.'
  }
];

export const notes: Record<string, ComponentNote> = {
  MaterialIcon: {
    category: 'primitives',
    purpose: 'Renders a Material Symbols glyph by name from the bundled icon subset.',
    notes: [
      'Only icons present in `src/assets/material-symbols-subset.woff2` render. A new icon name needs the subset regenerated.'
    ]
  },
  CoinIcon: {
    category: 'primitives',
    purpose: 'Shows a coin logo from `src/assets/coins/` and falls back to a MaterialIcon.',
    notes: ['Decorative by default (`decorative` is true), so it adds no accessible name.']
  },
  BrandLogo: {
    category: 'primitives',
    purpose: 'The AndroMiner launcher logo image. Takes no props.'
  },
  SessionControls: {
    category: 'buttons',
    purpose: 'Pause, stop and profile buttons for the live session.',
    notes: ['`state` is a `MiningState` (`src/types/mining.ts`); available buttons depend on it.']
  },
  ProfileChip: {
    category: 'buttons',
    purpose: 'A selectable CPU profile option showing thread and core hints.',
    notes: [
      'Emits `select` with its `value`; selection state is owned by the parent via `selected`.'
    ]
  },
  SavedSetupPicker: {
    category: 'buttons',
    purpose: 'Lists saved mining setups and exposes apply, create, rename, duplicate and delete.',
    notes: [
      'The setup name is two-way bound through `update:name`. Data lives in the profiles store.'
    ]
  },
  ConfigCard: {
    category: 'cards',
    purpose: 'Titled card with an icon, used for each block of the miner setup screen.',
    notes: ['The `aside` slot sits beside the title; the default slot is the body.']
  },
  ExpandableCard: {
    category: 'cards',
    purpose: 'Collapsible card driven by `v-model`.',
    notes: ['Open state is owned by the parent through `modelValue`.']
  },
  SettingGroup: {
    category: 'cards',
    purpose: 'Groups related settings rows under an optional heading and icon.'
  },
  StatCard: {
    category: 'cards',
    purpose: 'Single labelled value with optional supporting text and icon.',
    notes: ['`tone` switches between normal, warning and good styling.']
  },
  RecentRunCard: {
    category: 'cards',
    purpose:
      'Summary of one history run: coin, duration, hashrate and accepted and rejected shares.',
    notes: ['Emits `select` with the run so the parent can open its detail.']
  },
  EngineCard: {
    category: 'cards',
    purpose:
      'Engine picker for the selected coin, with a download action when the engine is missing.',
    notes: [
      'Reads installed engines through `useNativeMinerInfo` and decides what is downloadable with `downloadableEngines` (`src/utils/engineDownloads.ts`).',
      'See Mining engine for how engines are chosen per coin.'
    ]
  },
  PoolConnectionTest: {
    category: 'cards',
    purpose: 'Runs the native DNS, TCP and TLS reachability test and shows each stage.',
    notes: ['Sends no wallet or password. Uses the `PoolProbe` native plugin through Capacitor.']
  },
  DeviceBenchmark: {
    category: 'cards',
    purpose:
      'Runs the offline RandomX benchmark and offers an optional, previewed share of the result.',
    notes: [
      'Sharing builds its payload with `buildBenchmarkPayload` (`src/utils/benchmarkClient.ts`).'
    ]
  },
  ProtectionPanel: {
    category: 'cards',
    purpose: 'Shows the current protection state, readings, headroom and recent events.',
    notes: ['Freshness and tone come from `src/utils/protection.ts`.']
  },
  ProtectionEventList: {
    category: 'cards',
    purpose: 'Lists protection events with a plain-language explanation for each.'
  },
  AppUpdatesCard: {
    category: 'cards',
    purpose: 'Settings card for checking GitHub releases and showing the installed engine.',
    notes: ['Uses `useGitHubReleaseUpdater` and `useNativeMinerInfo`. Takes no props.']
  },
  UsageStatisticsCard: {
    category: 'cards',
    purpose: 'Settings card for anonymous usage statistics: switches, country and data deletion.',
    notes: [
      'State lives in `useTelemetry`. See the Statistics feature page and the privacy policy.'
    ]
  },
  LeaderboardCard: {
    category: 'cards',
    purpose: 'Shows the public leaderboard fetched through `useTelemetry`, with a copy-ID action.'
  },
  WarningBottomSheet: {
    category: 'dialogs',
    purpose:
      'Sheet shown when a protection threshold is reached, with resume, lower-performance and ignore choices.',
    notes: ['`type` selects the warning kind; `threshold` is the limit that was crossed.']
  },
  StartMiningWarningSheet: {
    category: 'dialogs',
    purpose: 'Workload confirmation shown before every start, summarising the current config.',
    notes: ['Emits `confirm` or `cancel`; the parent starts mining on `confirm`.']
  },
  MinerDownloadWarningSheet: {
    category: 'dialogs',
    purpose:
      'Confirmation and progress sheet for downloading a miner binary, with TLS or no-TLS choice.',
    notes: ['`confirm` carries the chosen variant and whether to fetch the selected engine or all.']
  },
  PhoneMiningRiskView: {
    category: 'dialogs',
    purpose: 'Full-screen first-run warning about the cost and heat of phone mining.',
    notes: ['Acceptance is remembered by the parent; this component only emits `continue`.']
  },
  CrashRestartPrompt: {
    category: 'dialogs',
    purpose: 'Alert dialog offering to restart a crashed miner, with a live countdown.',
    notes: ['The README documents an automatic restart after 30 seconds without an answer.']
  },
  AppHeader: {
    category: 'navigation',
    purpose:
      'Top bar with the drawer button, back button, connection state and notifications entry.'
  },
  AppDrawer: {
    category: 'navigation',
    purpose: 'Side drawer with navigation entries and configuration export and import actions.',
    notes: ['Uses `useDialogFocus` so keyboard focus stays inside while open.']
  },
  BottomNav: {
    category: 'navigation',
    purpose: 'Bottom tab bar bound with `v-model` to the active `AppTab`.',
    notes: ['The `AppTab` type is exported from this file and reused by the header and drawer.']
  },
  ConfigInput: {
    category: 'settings',
    purpose:
      'Text, number or password field with label, supporting text, suffix, error and optional reveal.'
  },
  ConfigSelect: {
    category: 'settings',
    purpose: 'Select with a label, optional search, coin icons and per-option disabled state.',
    notes: ['Option shape is `ConfigSelectOption`, exported from the component.']
  },
  ToggleRow: {
    category: 'settings',
    purpose: 'Labelled switch row bound with `v-model`.'
  },
  RangeSlider: {
    category: 'settings',
    purpose:
      'Labelled range input with unit, step and an optional label for the minimum ("off") position.'
  },
  MetricChart: {
    category: 'charts',
    purpose: 'Line chart of a metric over time, built on Chart.js through `vue-chartjs`.',
    notes: ['Takes `HistoryPoint[]`. `accent` sets the line colour.']
  },
  TelemetrySparkline: {
    category: 'charts',
    purpose: 'Compact sparkline of recent readings.'
  },
  HashrateRing: {
    category: 'charts',
    purpose: 'Ring gauge of the current hashrate against the session peak.',
    notes: ['The displayed number is tweened with `useTweenedNumber`.']
  },
  DotMeter: {
    category: 'charts',
    purpose: 'Row of dots filled in proportion to a value.',
    notes: ['`value` may be null when the reading is not reported.']
  },
  MiningMetric: {
    category: 'charts',
    purpose:
      'Label and value pair for the live session, with a tone for warning and danger readings.'
  },
  UpdateBanner: {
    category: 'notifications',
    purpose: 'In-app banner announcing an available update, with view and dismiss actions.'
  },
  StatusIndicator: {
    category: 'notifications',
    purpose: 'Coloured dot and label for a connected or disconnected state.'
  }
};
