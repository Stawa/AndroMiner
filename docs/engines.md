# Mining engines

One engine runs per session. XMRig is the default and the only one verified on a device. XMRigCC and XLArig are built and checked as binaries but never run on hardware, so the app marks them Experimental.

| Engine  | Upstream                                                        | Version | Licence | Status       | ABIs                       |
| ------- | --------------------------------------------------------------- | ------- | ------- | ------------ | -------------------------- |
| XMRig   | [xmrig/xmrig](https://github.com/xmrig/xmrig)                   | 6.26.0  | GPL-3.0 | Supported    | `arm64-v8a`, `armeabi-v7a` |
| XMRigCC | [Bendr0id/xmrigCC](https://github.com/Bendr0id/xmrigCC)         | 3.4.9   | GPL-3.0 | Experimental | `arm64-v8a`, `armeabi-v7a` |
| XLArig  | [scala-network/XLArig](https://github.com/scala-network/XLArig) | 5.2.4   | GPL-3.0 | Experimental | `arm64-v8a`, `armeabi-v7a` |

All three share XMRig's command line, output format and HTTP API, so one runtime drives them. Pool protocols are the same for each: stratum over TCP or TLS, daemon RPC, NiceHash.

| Engine  | Algorithms offered               |
| ------- | -------------------------------- |
| XMRig   | `rx/0`, `rx/wow`, `gr`, `cn/ccx` |
| XMRigCC | same as XMRig                    |
| XLArig  | `panthera` (Scala) only          |

Coins: Monero, Zephyr, Wownero, Salvium and Tari (`rx/0`/`rx/wow`), Raptoreum, Yerbas and GSP Coin (`gr`), Conceal (`cn/ccx`), Scala (`panthera`). Salvium and Tari are experimental: their default pool (Kryptex, `sal.kryptex.network:7028` and `xtm-rx.kryptex.network:7038`) wants logins as `WALLET/WORKER`, so these coins set a worker separator of `/`. The pool's command for Salvium uses `rx/0`; for Tari the pool recommends XMRig but doesn't state the algorithm, so `rx/0` is an assumption. Neither has been tried against a live pool.

The coin picks the engine: Monero selects XMRig, Scala selects XLArig. In the engine picker you can choose another engine that supports the coin; engines that can't mine it are listed but disabled. A custom choice stays until you pick a coin it can't mine, then the app falls back to that coin's automatic engine. If the selected engine isn't installed, the start button is disabled with a note under it.

- XMRigCC is built miner only: the remote-control client, remote shell and server are compiled out. It adds nothing the app uses beyond XMRig, and its docs list `panthera` as removed.
- XLArig is the only maintained route to Panthera. It is stale (XMRig 5.x code, last commit December 2023), has no Android binaries upstream, and needs `CMAKE_POLICY_VERSION_MINIMUM=3.5` to configure. Panthera hashing on ARM has not been checked against reference vectors.
- Not offered: DERO (current AstroBWT v3 isn't implemented by any engine here, and the official miner's licence forbids redistribution) and coins with no sign of life (ArQmA, Safex Cash, KevaCoin, Chukwa, Chukwa v2, NinjaCoin, Talleo, Vkax). A saved setup for a removed coin fails validation with a message.

## How the app uses them

- `MinerEngine` is the registry (id, status, library name, algorithms, protocols, ABIs). The UI reads it through `NativeMiner.info()`.
- Each engine has its own library (`libxmrig.so`, `libxmrigcc.so`, `libxlarig.so`) and build directory, so engines never overwrite each other.
- Saved configs without an `engine` field mean XMRig. Sessions record the engine.
- Every engine runs under the same foreground service and [device protection](device-protection.md). Throttling pauses the process, which hasn't been verified on hardware for any engine, and the app says so.

## Building

```bash
ENGINE=xmrigcc ABI=arm64-v8a WITH_TLS=ON RELEASE_BUILD=1 bash miner-builder/build-xmrig-android.sh
WITH_TLS=ON miner-builder/build-all-engines.sh     # every engine, every ABI, into jniLibs
```

- `ENGINE` is `xmrig` (default), `xmrigcc` or `xlarig`. Override the tag with `XMRIG_REF`, `XMRIGCC_REF` or `XLARIG_REF`.
- Output goes to `android/app/src/main/jniLibs/<abi>/lib<engine>.so`. TLS and no-TLS builds share that file, so build one variant, package the APK, then build the other.
- Every build runs `verify-android-binary.sh`: machine type, PIE, `linker64`, only `libc`/`libm`/`libdl`/`liblog`/`libandroid`, and TLS symbols matching the variant.
- `SKIP_OPENSSL_BUILD=1` reuses a prebuilt OpenSSL (its Android build needs Linux).
- Stripped sizes: XMRigCC 2.0 MB (arm64) / 5 MB (ARMv7), XLArig 1.4 MB / 4.7 MB. XMRig's arm64 binary is the 31.7 MB unstripped build; the 7 MB release build was never benchmarked, so it wasn't swapped in.

`build-xmrig-android.sh` patches upstream with `perl -pi`: link `dl` instead of `pthread rt dl log`; `if (WIN32)` → `AND NOT ANDROID`; a `const_cast` for OpenSSL 4 in `TlsGen.cpp`; donate level default and minimum 0 (the app exposes it as a setting). A pattern that stops matching fails silently, so check `git diff` in `miner-builder/work/src/<engine>` after bumping a tag.

## Release and downloads

- Bundled TLS and no-TLS APKs carry all three engines for both ABIs. `release-build.yml` fails if a library is missing.
- The download APK carries none. It can fetch an engine from the `miner-builder` branch, but only if the APK pins a reviewed commit and a SHA-256 per engine, ABI and TLS variant (`MinerIntegrity`). Downloads are hash-checked before install, redirects are refused, size is capped, and a failed download leaves any old file alone. Starting with a missing engine offers "Download {engine}" or "Download all engines".
- No engine other than XMRig is downloadable yet: `ENGINE_REVISION` is empty, so the app says "no approved download" instead of trying. To enable it:
  1. Run the _Android Miner Binary_ workflow (publishes XMRigCC and XLArig).
  2. Review that commit.
  3. Run `miner-builder/print-engine-pins.sh <commit>`. It downloads and hashes each file itself rather than trusting `SHA256SUMS`.
  4. Paste the output into `MinerIntegrity.java` and release a new APK.
- XMRig for ARMv7 has no pinned download either, so the download APK refuses 32-bit devices. Use a bundled APK.

## ARMv7 (`armeabi-v7a`)

- Built for API 24 (the app's `minSdk`), stripped, with OpenSSL `no-asm`. Needs only `libdl`, `libm`, `libc`.
- NEON is required. The app reads `/proc/cpuinfo` and refuses to start without it, instead of crashing with SIGILL.
- AES is software, so it runs everywhere but slower than hardware AES.
- RandomX runs in light mode (`--randomx-mode=light`, 256 MB cache): a 32-bit process can't reliably hold the 2 GB dataset.
- ABI selection lives in `MinerAbi`; x86 and x86_64 are unsupported.
- Emulated check: `miner-builder/validate-armv7-qemu.sh` computes the published RandomX vector under qemu-user and matches (GCC/glibc build, one hash, not the shipped binary). CI runs it on pull requests.
- Open risk: a GCC 13 build hit SIGBUS from an alignment-hinted NEON load; the script now uses `-fno-tree-vectorize`. The shipped Clang binary doesn't do that in the function that crashed, but about 6,400 other alignment-hinted NEON accesses weren't audited. If a device crashes with SIGBUS or `BUS_ADRALN`, start there.

## Validating on a device

An engine stays Experimental until, on at least one real arm64 phone, it loads, connects, authenticates, gets accepted shares, runs stably for 30 minutes, the throttle reduces measured CPU, and thermal and battery stops end it.

```bash
POOL=pool.example:3333 WALLET=<wallet> ALGO=rx/0 \
  bash miner-builder/validate-engine-device.sh xmrigcc libxmrigcc.so 1800
bash miner-builder/bench/bench.sh LABEL libxmrig.so THREADS 120 40   # hashrate benchmark
```

The first script checks the file hash, load and version, runs a benchmark if the engine has one, then logs CPU, memory and battery temperature every 10 s and prints share counts. Without `POOL` and `WALLET` it stops after load and version. Don't compare hashrates across algorithms.

| Check                                      | XMRig          | XMRigCC        | XLArig         |
| ------------------------------------------ | -------------- | -------------- | -------------- |
| NDK build, arm64 and ARMv7, TLS on and off | yes            | yes            | yes            |
| ELF dependency and symbol check            | yes            | yes            | yes            |
| Packaged under its own name in the APK     | yes            | yes            | yes            |
| Runs on a device, gets accepted shares     | arm64 only     | **not tested** | **not tested** |
| Throttle verified on hardware              | **not tested** | **not tested** | **not tested** |

No hashrate, power or thermal benchmarks have been recorded for any engine or ABI.

## Next steps

1. Run the validation script on real arm64 and ARMv7 phones and record the results.
2. Publish and pin the XMRigCC and XLArig builds.
3. Hardware AES on 32-bit (Cortex-A53/A57/A72 have it in AArch32). It is likely the biggest ARMv7 gain but needs a careful RandomX patch.
4. A hash-pinned ARMv7 XMRig download.
