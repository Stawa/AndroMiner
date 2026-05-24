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
    logoClass: 'bg-orange-500'
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
    logoClass: 'bg-cyan-600'
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
    logoClass: 'bg-pink-600'
  },
  {
    id: 'arq',
    name: 'ArQmA',
    symbol: 'ARQ',
    algorithm: 'RandomARQ',
    xmrigAlgo: 'rx/arq',
    miner: 'xmrig',
    supportStatus: 'bundled',
    defaultPort: 5907,
    defaultPoolUrl: 'stratum.aikapool.com',
    defaultProtocol: 'stratum+tcp',
    walletAddressPattern: 'ArQmA pool username or wallet, depending on pool',
    poolExamples: [
      {
        name: 'AikaPool',
        host: 'stratum.aikapool.com',
        port: 5907,
        protocol: 'stratum+tcp',
        notes: 'RandomARQ pool example'
      }
    ],
    logoText: 'A',
    logoClass: 'bg-sky-600'
  },
  {
    id: 'sfx',
    name: 'Safex Cash',
    symbol: 'SFX',
    algorithm: 'RandomSFX',
    xmrigAlgo: 'rx/sfx',
    miner: 'xmrig',
    supportStatus: 'bundled',
    defaultPort: 5555,
    defaultPoolUrl: '',
    defaultProtocol: 'stratum+tcp',
    walletAddressPattern: 'Safex Cash wallet address',
    poolExamples: [
      {
        name: 'Custom SFX pool',
        host: '',
        port: 5555,
        protocol: 'stratum+tcp',
        notes: 'Enter a current Safex Cash pool that supports rx/sfx'
      }
    ],
    logoText: 'S',
    logoClass: 'bg-emerald-600'
  },
  {
    id: 'kva',
    name: 'KevaCoin',
    symbol: 'KVA',
    algorithm: 'RandomKEVA',
    xmrigAlgo: 'rx/keva',
    miner: 'xmrig',
    supportStatus: 'bundled',
    defaultPort: 8999,
    defaultPoolUrl: 'kva.ss.dxpool.com',
    defaultProtocol: 'stratum+ssl',
    walletAddressPattern: 'KevaCoin wallet address',
    poolExamples: [
      {
        name: 'DxPool',
        host: 'kva.ss.dxpool.com',
        port: 8999,
        protocol: 'stratum+ssl',
        notes: 'RandomKEVA pool example'
      }
    ],
    logoText: 'K',
    logoClass: 'bg-lime-700'
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
    logoClass: 'bg-violet-600'
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
    logoClass: 'bg-green-700'
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
    logoClass: 'bg-fuchsia-700'
  },
  {
    id: 'chukwa',
    name: 'Chukwa',
    symbol: 'CHUKWA',
    algorithm: 'Argon2id Chukwa',
    xmrigAlgo: 'argon2/chukwa',
    miner: 'xmrig',
    supportStatus: 'bundled',
    defaultPort: 3333,
    defaultPoolUrl: '',
    defaultProtocol: 'stratum+tcp',
    walletAddressPattern: 'Wallet address for a coin or pool using argon2/chukwa',
    poolExamples: [
      {
        name: 'Custom Chukwa pool',
        host: '',
        port: 3333,
        protocol: 'stratum+tcp',
        notes: 'Enter a pool that supports argon2/chukwa'
      }
    ],
    logoText: 'C',
    logoClass: 'bg-teal-700'
  },
  {
    id: 'chukwav2',
    name: 'Chukwa v2',
    symbol: 'CHUKWA2',
    algorithm: 'Argon2id Chukwa v2',
    xmrigAlgo: 'argon2/chukwav2',
    miner: 'xmrig',
    supportStatus: 'bundled',
    defaultPort: 3333,
    defaultPoolUrl: '',
    defaultProtocol: 'stratum+tcp',
    walletAddressPattern: 'Wallet address for a coin or pool using argon2/chukwav2',
    poolExamples: [
      {
        name: 'Custom Chukwa v2 pool',
        host: '',
        port: 3333,
        protocol: 'stratum+tcp',
        notes: 'Enter a pool that supports argon2/chukwav2'
      }
    ],
    logoText: 'C2',
    logoClass: 'bg-teal-800'
  },
  {
    id: 'ninja',
    name: 'NinjaCoin',
    symbol: 'NINJA',
    algorithm: 'Argon2id Ninja',
    xmrigAlgo: 'argon2/ninja',
    miner: 'xmrig',
    supportStatus: 'bundled',
    defaultPort: 3333,
    defaultPoolUrl: '',
    defaultProtocol: 'stratum+tcp',
    walletAddressPattern: 'NinjaCoin wallet address',
    poolExamples: [
      {
        name: 'Custom NINJA pool',
        host: '',
        port: 3333,
        protocol: 'stratum+tcp',
        notes: 'Enter a current NinjaCoin pool'
      }
    ],
    logoText: 'N',
    logoClass: 'bg-neutral-600'
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
    logoClass: 'bg-indigo-700'
  },
  {
    id: 'tlo',
    name: 'Talleo',
    symbol: 'TLO',
    algorithm: 'CryptoNight-Pico Talleo',
    xmrigAlgo: 'cn-pico/tlo',
    miner: 'xmrig',
    supportStatus: 'bundled',
    defaultPort: 3333,
    defaultPoolUrl: '',
    defaultProtocol: 'stratum+tcp',
    walletAddressPattern: 'Talleo wallet address',
    poolExamples: [
      {
        name: 'Custom TLO pool',
        host: '',
        port: 3333,
        protocol: 'stratum+tcp',
        notes: 'Enter a current Talleo pool that supports cn-pico/tlo'
      }
    ],
    logoText: 'T',
    logoClass: 'bg-amber-700'
  },
  {
    id: 'xla',
    name: 'Scala',
    symbol: 'XLA',
    algorithm: 'Panthera',
    xmrigAlgo: 'panthera',
    miner: 'external',
    minerName: 'XLArig or a Panthera-capable miner',
    supportStatus: 'custom-miner-required',
    supportNote: 'needs XLArig/Panthera support',
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
        notes: 'Requires XLArig or another Panthera-capable miner'
      }
    ],
    logoText: 'X',
    logoClass: 'bg-blue-700'
  },
  {
    id: 'dero',
    name: 'Dero',
    symbol: 'DERO',
    algorithm: 'AstroBWT',
    xmrigAlgo: 'astrobwt',
    miner: 'external',
    minerName: 'DERO miner',
    supportStatus: 'custom-miner-required',
    supportNote: 'current DERO mining uses AstroBWT',
    defaultPort: 10100,
    defaultPoolUrl: 'minernode1.dero.live',
    defaultProtocol: 'stratum+tcp',
    walletAddressPattern: 'Dero wallet address',
    poolExamples: [
      {
        name: 'DERO miner node',
        host: 'minernode1.dero.live',
        port: 10100,
        protocol: 'stratum+tcp',
        notes: 'Requires the official DERO miner flow, not bundled XMRig'
      }
    ],
    logoText: 'D',
    logoClass: 'bg-slate-600'
  },
  {
    id: 'vkax',
    name: 'Vkax',
    symbol: 'VKAX',
    algorithm: 'Mike',
    xmrigAlgo: 'mike',
    miner: 'external',
    minerName: 'XMRigCC VKAX fork',
    supportStatus: 'custom-miner-required',
    supportNote: 'needs XMRigCC Mike algorithm support',
    defaultPort: 3333,
    defaultPoolUrl: '',
    defaultProtocol: 'stratum+tcp',
    walletAddressPattern: 'VKAX wallet address',
    poolExamples: [
      {
        name: 'Custom VKAX pool',
        host: '',
        port: 3333,
        protocol: 'stratum+tcp',
        notes: 'Requires an XMRigCC build with the Mike algorithm'
      }
    ],
    logoText: 'V',
    logoClass: 'bg-rose-700'
  }
];

export const getCryptocurrencyById = (coinId: string): Cryptocurrency | undefined =>
  cryptocurrencies.find((coin) => coin.id === coinId);
