import type { MiningConfig } from '../types/mining';

/** Pool usernames are valid too; do not enforce a coin-specific address length. */
export const validateMiningSetup = (config: MiningConfig) => ({
  wallet:
    !config.walletAddress.trim() || /^YOUR_/i.test(config.walletAddress.trim())
      ? 'Enter your wallet address or the username supplied by your pool.'
      : '',
  pool:
    !config.poolUrl.trim() || /\s/.test(config.poolUrl.trim())
      ? 'Enter a pool host without spaces.'
      : '',
  port:
    !Number.isInteger(config.poolPort) || config.poolPort < 1 || config.poolPort > 65535
      ? 'Use a port between 1 and 65535.'
      : ''
});
