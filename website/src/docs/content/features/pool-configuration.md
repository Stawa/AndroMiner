# Pool configuration

Pool settings are part of a `MiningConfig` and are edited in **Miner → Setup** and **Pool**.

## Fields

| Field      | Notes                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------- |
| Coin       | Selecting a coin sets its algorithm, default pool and required engine                    |
| Wallet     | Your address or pool username. The placeholder must be replaced                          |
| Worker     | Optional name. Some pools use a separator such as `/` between wallet and worker          |
| Host, port | The pool endpoint                                                                        |
| Protocol   | `MiningProtocol` in `src/types/mining.ts`: stratum over TCP or TLS, daemon RPC, NiceHash |

Encrypted pools need the TLS miner. With the no-TLS APK, only plain TCP works.

## Testing a pool

`PoolConnectionTest` calls `NativeMiner.testPool`. It checks:

1. Host name resolution (DNS).
2. A TCP connection, trying IPv4 and IPv6 within bounded attempts.
3. For TLS pools, the certificate and host name.

The test does **not** send your wallet or password, and it does not check wallet authentication. The report excludes identifiers and raw logs, and can be previewed and copied.

## Validation

`src/utils/configValidation.ts` rejects incomplete or inconsistent setups before a run can start, for example a coin whose algorithm the selected engine cannot mine. A saved setup for a coin that was removed from the catalog fails validation with a message.

## Saved setups

`SavedSetupPicker` applies, creates, renames, duplicates and deletes setups stored by `src/stores/profiles.ts`. See [Data storage](/docs/architecture/data-storage).
