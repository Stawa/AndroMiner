import type { MiningConfig } from '../types/mining';

/**
 * Returns a message key (see `validation.*` in the locale files) per invalid field, or '' when valid.
 * Pool usernames are valid too; do not enforce a coin-specific address length.
 */
export const validateMiningSetup = (config: MiningConfig) => ({
  wallet:
    !config.walletAddress.trim() || /^YOUR_/i.test(config.walletAddress.trim())
      ? 'validation.wallet'
      : '',
  pool: !config.poolUrl.trim() || /\s/.test(config.poolUrl.trim()) ? 'validation.pool' : '',
  duration:
    config.maxDurationMinutes !== undefined &&
    (!Number.isInteger(config.maxDurationMinutes) ||
      config.maxDurationMinutes < 0 ||
      config.maxDurationMinutes > 1440)
      ? 'validation.duration'
      : '',
  port:
    !Number.isInteger(config.poolPort) || config.poolPort < 1 || config.poolPort > 65535
      ? 'validation.port'
      : ''
});

/** Highest temperature limit a user may set. 0 disables the temperature limit. */
export const maxTemperatureLimitC = 85;
/** Highest battery stop level a user may set. 0 disables the battery limit. */
export const maxBatteryStopPercent = 50;
