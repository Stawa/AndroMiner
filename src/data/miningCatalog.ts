import type { Cryptocurrency } from '../types/mining';

export const cryptocurrencies: Cryptocurrency[] = [
  {
    id: 'xmr',
    name: 'Monero',
    symbol: 'XMR',
    algorithm: 'RandomX',
    xmrigAlgo: 'rx/0',
    miner: 'xmrig',
    supportStatus: 'bundled',
    defaultPort: 3333,
    defaultPoolUrl: 'pool.supportxmr.com',
    defaultProtocol: 'stratum+tcp',
    walletAddressPattern: 'Primary, subaddress, or integrated Monero address',
    poolExamples: [
      {
        name: 'P2Pool local node',
        host: '127.0.0.1',
        port: 3333,
        protocol: 'stratum+tcp',
        notes: 'Decentralized pool when running Monero node and P2Pool separately'
      },
      {
        name: 'SupportXMR',
        host: 'pool.supportxmr.com',
        port: 3333,
        protocol: 'stratum+tcp',
        notes: 'Centralized XMR pool with web dashboard'
      },
      {
        name: 'MoneroOcean',
        host: 'gulf.moneroocean.stream',
        port: 10032,
        protocol: 'stratum+tcp',
        notes: 'Algo-switching pool that pays out in XMR'
      },
      {
        name: 'Nanopool',
        host: 'xmr-eu1.nanopool.org',
        port: 14444,
        protocol: 'stratum+tcp',
        notes: 'Centralized XMR pool; set XMRig algo to rx/0'
      }
    ],
    logoText: 'M',
    logoClass: 'bg-app-elevated'
  },
  {
    id: 'zeph',
    name: 'Zephyr Protocol',
    symbol: 'ZEPH',
    algorithm: 'RandomX',
    xmrigAlgo: 'rx/0',
    miner: 'xmrig',
    supportStatus: 'bundled',
    defaultPort: 4000,
    defaultPoolUrl: 'stratum.ravenminer.com',
    defaultProtocol: 'stratum+tcp',
    walletAddressPattern: 'Zephyr wallet address',
    poolExamples: [
      {
        name: 'RavenMiner',
        host: 'stratum.ravenminer.com',
        port: 4000,
        protocol: 'stratum+tcp',
        notes: 'RandomX ZEPH pool endpoint'
      },
      {
        name: 'RavenMiner TLS',
        host: 'stratum.ravenminer.com',
        port: 14000,
        protocol: 'stratum+tls',
        notes: 'Encrypted RandomX ZEPH endpoint'
      },
      {
        name: 'DxPool',
        host: 'zeph.ss.dxpool.com',
        port: 4333,
        protocol: 'stratum+ssl',
        notes: 'Pool example that uses rx/0 for ZEPH'
      }
    ],
    logoText: 'Z',
    logoClass: 'bg-app-elevated'
  },
  {
    id: 'sal',
    name: 'Salvium',
    symbol: 'SAL',
    algorithm: 'RandomX',
    xmrigAlgo: 'rx/0',
    miner: 'xmrig',
    supportStatus: 'bundled',
    supportNote: 'experimental: not yet tested with a live pool',
    workerSeparator: '/',
    defaultPort: 7028,
    defaultPoolUrl: 'sal.kryptex.network',
    defaultProtocol: 'stratum+tcp',
    walletAddressPattern: 'Salvium wallet address',
    poolExamples: [
      {
        name: 'Kryptex',
        host: 'sal.kryptex.network',
        port: 7028,
        protocol: 'stratum+tcp',
        notes:
          'Worker names use WALLET/WORKER with letters and numbers only. Regional hosts: sal-eu and sal-us'
      }
    ],
    logoText: 'S',
    logoClass: 'bg-app-elevated'
  },
  {
    id: 'xtm',
    name: 'Tari',
    symbol: 'XTM',
    algorithm: 'RandomX',
    xmrigAlgo: 'rx/0',
    miner: 'xmrig',
    supportStatus: 'bundled',
    supportNote: 'experimental: pool recommends XMRig, algorithm flag not yet confirmed',
    workerSeparator: '/',
    defaultPort: 7038,
    defaultPoolUrl: 'xtm-rx.kryptex.network',
    defaultProtocol: 'stratum+tcp',
    walletAddressPattern: 'Tari wallet address',
    poolExamples: [
      {
        name: 'Kryptex (RandomX)',
        host: 'xtm-rx.kryptex.network',
        port: 7038,
        protocol: 'stratum+tcp',
        notes: 'Worker names use WALLET/WORKER with letters and numbers only'
      }
    ],
    logoText: 'T',
    logoClass: 'bg-app-elevated'
  },
  {
    id: 'wow',
    name: 'Wownero',
    symbol: 'WOW',
    algorithm: 'RandomWOW',
    xmrigAlgo: 'rx/wow',
    miner: 'xmrig',
    supportStatus: 'bundled',
    defaultPort: 10661,
    defaultPoolUrl: 'wownero.herominers.com',
    defaultProtocol: 'stratum+tls',
    walletAddressPattern: 'Wownero wallet address',
    poolExamples: [
      {
        name: 'HeroMiners',
        host: 'wownero.herominers.com',
        port: 10661,
        protocol: 'stratum+tls',
        notes: 'RandomWOW pool endpoint'
      }
    ],
    logoText: 'W',
    logoClass: 'bg-app-elevated'
  },
  {
    id: 'rtm',
    name: 'Raptoreum',
    symbol: 'RTM',
    algorithm: 'GhostRider',
    xmrigAlgo: 'gr',
    miner: 'xmrig',
    supportStatus: 'bundled',
    defaultPort: 3052,
    defaultPoolUrl: 'rtm-stratum.pukkapool.com',
    defaultProtocol: 'stratum+tcp',
    walletAddressPattern: 'Raptoreum wallet address',
    poolExamples: [
      {
        name: 'PukkaPool',
        host: 'rtm-stratum.pukkapool.com',
        port: 3052,
        protocol: 'stratum+tcp',
        notes: 'GhostRider non-TLS pool endpoint'
      },
      {
        name: 'PukkaPool TLS',
        host: 'rtm-stratum.pukkapool.com',
        port: 3053,
        protocol: 'stratum+tls',
        notes: 'GhostRider TLS pool endpoint'
      },
      {
        name: 'Raptoreum Emporium',
        host: 'raptoreumemporium.com',
        port: 3008,
        protocol: 'stratum+tcp',
        notes: 'XMRig GhostRider example endpoint'
      }
    ],
    logoText: 'R',
    logoClass: 'bg-app-elevated'
  },
  {
    id: 'yerb',
    name: 'Yerbas',
    symbol: 'YERB',
    algorithm: 'GhostRider',
    xmrigAlgo: 'gr',
    miner: 'xmrig',
    supportStatus: 'bundled',
    defaultPort: 3333,
    defaultPoolUrl: '',
    defaultProtocol: 'stratum+tcp',
    walletAddressPattern: 'Yerbas wallet address',
    poolExamples: [
      {
        name: 'Custom YERB pool',
        host: '',
        port: 3333,
        protocol: 'stratum+tcp',
        notes: 'Enter a current Yerbas GhostRider pool'
      }
    ],
    logoText: 'Y',
    logoClass: 'bg-app-elevated'
  },
  {
    id: 'gspc',
    name: 'GSP Coin',
    symbol: 'GSPC',
    algorithm: 'GhostRider',
    xmrigAlgo: 'gr',
    miner: 'xmrig',
    supportStatus: 'bundled',
    defaultPort: 3333,
    defaultPoolUrl: '',
    defaultProtocol: 'stratum+tcp',
    walletAddressPattern: 'GSPC wallet address',
    poolExamples: [
      {
        name: 'Custom GSPC pool',
        host: '',
        port: 3333,
        protocol: 'stratum+tcp',
        notes: 'Enter a current GSPC GhostRider pool'
      }
    ],
    logoText: 'G',
    logoClass: 'bg-app-elevated'
  },
  {
    id: 'ccx',
    name: 'Conceal',
    symbol: 'CCX',
    algorithm: 'CryptoNight Conceal',
    xmrigAlgo: 'cn/ccx',
    miner: 'xmrig',
    supportStatus: 'bundled',
    defaultPort: 3333,
    defaultPoolUrl: '',
    defaultProtocol: 'stratum+tcp',
    walletAddressPattern: 'Conceal wallet address',
    poolExamples: [
      {
        name: 'Custom CCX pool',
        host: '',
        port: 3333,
        protocol: 'stratum+tcp',
        notes: 'Enter a current Conceal pool that supports cn/ccx'
      }
    ],
    logoText: 'CC',
    logoClass: 'bg-app-elevated'
  },
  {
    id: 'xla',
    name: 'Scala',
    symbol: 'XLA',
    algorithm: 'Panthera',
    xmrigAlgo: 'panthera',
    miner: 'xmrig',
    requiredEngine: 'xlarig',
    supportStatus: 'bundled',
    supportNote: 'experimental: mined with XLArig, not yet validated on a device',
    defaultPort: 3333,
    defaultPoolUrl: 'mine.scala.network',
    defaultProtocol: 'stratum+tcp',
    walletAddressPattern: 'Scala wallet address',
    poolExamples: [
      {
        name: 'Scala pool',
        host: 'mine.scala.network',
        port: 3333,
        protocol: 'stratum+tcp',
        notes: 'Mined with the XLArig engine; check the pool is still running before use'
      }
    ],
    logoText: 'X',
    logoClass: 'bg-app-elevated'
  }
];

export const getCryptocurrencyById = (coinId: string): Cryptocurrency | undefined =>
  cryptocurrencies.find((coin) => coin.id === coinId);
