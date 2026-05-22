import type { Cryptocurrency } from '../types/mining';

export const cryptocurrencies: Cryptocurrency[] = [
  {
    id: 'xmr',
    name: 'Monero',
    symbol: 'XMR',
    algorithm: 'RandomX',
    xmrigAlgo: 'rx/0',
    miner: 'xmrig',
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
  }
];

export const getCryptocurrencyById = (coinId: string): Cryptocurrency | undefined =>
  cryptocurrencies.find((coin) => coin.id === coinId);
