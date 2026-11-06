import overview from '../../../overview/overview.png';
import minerSetup from '../../../overview/miner-setup.png';
import engine from '../../../overview/engine.png';
import safety from '../../../overview/safety.png';
import history from '../../../overview/history.png';
import settings from '../../../overview/settings.png';
import logo from '../../../assets/brand/androminer-logo.svg';

const repo = 'https://github.com/Stawa/AndroMiner';

export const links = {
  repo,
  download: `${repo}/releases/latest`,
  releases: `${repo}/releases`,
  privacy: '/privacy',
  terms: '/terms',
  engines: `${repo}/blob/main/docs/engines.md`,
  issues: `${repo}/issues`,
  contributing: `${repo}/pulls`
};

/** Real screenshots from an Android 16 device (see the README). Sizes avoid layout shift. */
export const images = {
  logo,
  overview: {
    src: overview,
    alt: 'AndroMiner overview screen with idle mining status and device readings'
  },
  minerSetup: {
    src: minerSetup,
    alt: 'Miner setup screen with Monero selected and a placeholder wallet'
  },
  engine: { src: engine, alt: 'Engine settings with CPU thread allocation and power profiles' },
  safety: { src: safety, alt: 'Safety settings with temperature and power protection controls' },
  history: { src: history, alt: 'Session history with completed runs and recorded share results' },
  settings: {
    src: settings,
    alt: 'Settings with appearance, configuration export and update information'
  }
};
export const shot = { width: 1221, height: 2712 };

export const nav = [
  { label: 'Features', href: '/#features' },
  { label: 'Screens', href: '/#screens' },
  { label: 'Download', href: '/#download' },
  { label: 'Docs', href: '/docs' },
  { label: 'Statistics', href: '/stats' }
];

export const features = [
  {
    title: 'Set it up once',
    body: "Pick a coin, a pool and your wallet, then choose a profile or set threads, priority and core affinity yourself. Save setups, export them, and test the pool's DNS, TCP and TLS reachability without sending your wallet or password."
  },
  {
    title: 'Watch what the chip is doing',
    body: 'Measured hashrate, accepted and rejected shares, miner output, temperature and battery readings. Whatever the phone does not report is shown as not reported, never guessed.'
  },
  {
    title: 'Stop before it hurts',
    body: 'Device protection steps through Normal, Caution, Throttled and Stop, explains every change and keeps the events with the run. Sessions can have a deadline, and a crashed miner can restart after a prompt.'
  },
  {
    title: 'Know your real speed',
    body: 'The Device tab runs an offline RandomX benchmark with the installed engine and shows the median speed. Sharing it is optional and always shown to you first.'
  }
];

export const engineRows = [
  {
    name: 'XMRig 6.26',
    status: 'Supported',
    mines: 'RandomX, Wownero, GhostRider, CryptoNight-CCX',
    abis: 'arm64-v8a, armeabi-v7a'
  },
  {
    name: 'XMRigCC 3.4',
    status: 'Experimental',
    mines: 'The same algorithms, miner only',
    abis: 'arm64-v8a, armeabi-v7a'
  },
  {
    name: 'XLArig 5.2',
    status: 'Experimental',
    mines: 'Panthera, for Scala (XLA)',
    abis: 'arm64-v8a, armeabi-v7a'
  }
];

export const steps = [
  {
    title: 'Pick an APK.',
    body: 'TLS bundles an encrypted-capable miner, No-TLS bundles a plain-TCP one, and Download fetches a verified miner after you confirm.'
  },
  {
    title: 'Run the benchmark.',
    body: 'The Device tab measures the phone and shows the result before you commit to anything.'
  },
  {
    title: 'Add a pool and a wallet you control.',
    body: 'Test the connection, then start from the dashboard and confirm the workload.'
  },
  {
    title: 'Watch and stop.',
    body: 'Follow speed, shares and heat; stop to save the run to your history.'
  }
];

export const faqs = [
  {
    q: 'Will this make money?',
    a: 'Very little. A phone hashes RandomX in the hundreds to low thousands per second, and electricity, heat and battery wear count against it. The benchmark exists so you can see your own number instead of a promise.'
  },
  {
    q: 'Which coins can it mine?',
    a: 'Monero, Zephyr, Salvium, Tari, Wownero, Raptoreum, Yerbas, GSP Coin, Conceal and Scala today, through pools listed in the app. You can enter your own pool for any supported algorithm.'
  },
  {
    q: 'Does the benchmark send anything?',
    a: "Running it sends nothing: the miner's own offline mode needs no network. Only if you press Share, after reading the warning and the exact data, does one small request go to this site."
  },
  {
    q: 'Why does my phone show a lower speed than another with the same chip?',
    a: "Cooling, battery saver, background apps and thermal limits change a phone's speed minute to minute. That is why the table shows medians and ranges, and why a phone is listed only after several results."
  }
];
