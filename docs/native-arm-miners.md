# Native ARM miners

The native XMRig layer for `arm64-v8a` and `armeabi-v7a`: what changed, and what was and wasn't verified.

**No on-device benchmark has been run for either ABI.** No phone or emulator was available, so there are no hashrate, power, thermal or stability numbers, and the arm64 binary is unchanged.

## Status

| Item                                                               | Status                          |
| ------------------------------------------------------------------ | ------------------------------- |
| armeabi-v7a miner cross-compiled (NDK r27c, Clang 18, API 24, TLS) | Done; ELF, loader, deps checked |
| Debug APK contains `lib/arm64-v8a` and `lib/armeabi-v7a`           | Done                            |
| Java unit tests (ABI selection, NEON check, download pins)         | Passed                          |
| ARMv7 RandomX hash correct under qemu-user (GCC, glibc)            | Passed (one hash)               |
| armeabi-v7a binary run on a device or emulator                     | **Not done**                    |
| Hashrate, CPU, power, temperature, init time (either ABI)          | **Not measured**                |
| Long runs, throttling, pool and share traffic on armeabi-v7a       | **Not tested**                  |
| arm64 variants compared                                            | **Not done**                    |

The earlier arm64 run (`miner-builder/bench/results/disturbed-2026-11-01/`) stopped when the phone went offline. Its numbers are unreliable and weren't used.

## What we found

- The arm64 binary in `jniLibs` is the 31.7 MB unstripped baseline. The `release` variant (-O3, `--gc-sections`, stripped) is 7.2 MB but has no valid benchmark, so it wasn't swapped in. The download pins in `MinerIntegrity.java` are unchanged.
- Upstream XMRig already picks the right code per CPU. `aarch64` gets `-march=armv8-a+crypto` with AES detected at runtime. 32-bit ARM gets `-march=armv7-a -mfpu=neon`. RandomX's JIT exists only for 64-bit, so ARMv7 always uses the interpreter.
- RandomX fast mode needs 2080 MB for the dataset plus a 256 MB cache. Upstream's `auto` mode falls back to light mode on low RAM, but ignores a 32-bit process's address space and Android's low-memory killer.
- The app hard-coded arm64 in its download URLs, the reported ABI and the integrity hashes.

## armeabi-v7a

**Build** (Linux or WSL): `ABI=armeabi-v7a bash miner-builder/build-xmrig-android.sh`. For this ABI the defaults are:

- API 24, the app's `minSdk`. An API 29 build can reference symbols missing on Android 7 to 9.
- `RELEASE_BUILD=1`: `-g0`, path remap, `--gc-sections`, `--build-id=none`, `llvm-strip`, then a second check of the stripped file.
- OpenSSL built with `no-asm`, because its ARMv8 assembly doesn't link on 32-bit and TLS speed doesn't affect RandomX.

arm64 output is unchanged unless you set `RELEASE_BUILD=1`.

**Built artifact:** `libxmrig.so`, 5,453,116 bytes, SHA-256 `9713ae2ff21d4ba37325565f9898bd077852056af4e86f7d9f9e4382a8a69a61`. ELF32 ARM PIE, needs only `libdl`, `libm`, `libc`. Android clang 18.0.3, OpenSSL 4.0.0 static, XMRig v6.26.0. It's gitignored (`jniLibs/*`), not committed.

**CPU features**

- **NEON is required.** The build uses `-mfpu=neon` with no scalar fallback. The app reads `/proc/cpuinfo` (`neon`, or `asimd` on 64-bit kernels) and refuses to start without it, instead of crashing with SIGILL.
- **AES is software.** No crypto flag is compiled, so `hasAES()` is false. This works on every ARMv7 device but is slower than hardware AES.
- No algorithms were removed.

**Memory.** The app passes `--randomx-mode=light` (256 MB cache, no 2 GB dataset). A 32-bit process has 2 to 3 GB of address space and Android kills large background processes, so fast mode's 2.3 GB isn't reliable. Light mode is much slower per hash. Whether fast mode works on 4 GB+ devices needs measuring.

**Downloads.** There's no hash-pinned armeabi-v7a download, so the "download" APK variant rejects downloads on 32-bit devices. Use an APK that bundles the miner. Adding a download means a pinned revision and hash in `MinerIntegrity`.

## Emulated check

`bash miner-builder/validate-armv7-qemu.sh` builds XMRig's RandomX code for the host (x86_64) and for 32-bit ARM (GCC 13.3, `-march=armv7-a -mfpu=neon`, software AES, interpreter), then computes the published RandomX vector (key `test key 000`, input `This is a test`) on each. Published, host and qemu-arm all gave:

`639183aae1bf4c9a35884cb46b09cad9175f04efd7684e7262a0ac1c2f0b4e3f`

Limits: this is a GCC/glibc build under emulation, not the Clang/bionic binary that ships, and it's one hash, not a speed or stability test. XMRig's own `--bench` reference needs at least 10,000 hashes, about 14 hours under qemu (roughly 0.2 H/s), so it wasn't completed.

**Open risk.** The first qemu run crashed with SIGBUS in Argon2 (`xmrig_ar2_fill_first_blocks`): GCC 13 vectorized a stack buffer with a 64-bit-aligned NEON load (`vld1.64 {..}, [r3:64]`) at a 4-byte-aligned address. The script now compiles C with `-fno-tree-vectorize`. The shipped Clang binary uses no alignment hint in that function (checked with `llvm-objdump`), but it has about 6,400 other alignment-hinted NEON accesses that weren't audited. If a device crashes with SIGBUS or `BUS_ADRALN`, start there.

## App integration

- `MinerAbi` (new) picks the device ABI from `Build.SUPPORTED_ABIS` and checks NEON.
- `NativeMiningRuntime` reports the real ABI, builds download URLs per ABI, rejects unsupported ABIs and unpinned downloads, checks NEON before start, and adds `--randomx-mode=light` on 32-bit.
- `MinerIntegrity.expectedHash(abi, variant)` now takes the ABI.
- Bundled miners need no loader code: Android extracts `lib/<abi>/libxmrig.so` for the running ABI into `nativeLibraryDir`, which `findMinerBinary()` already uses. Capacitor, process launch, configuration, telemetry and safety monitoring are untouched.
- x86 and x86_64 aren't supported: the ABI is reported as `unsupported` and no miner is found.

## Custom XMRig patches

`build-xmrig-android.sh` applies these to upstream v6.26.0 with `perl -pi`. They're Android build fixes, not algorithm changes, and nothing extra was needed for armeabi-v7a.

1. `CMakeLists.txt`: link `dl` instead of `pthread rt dl log` (bionic has pthread and rt in libc).
2. `CMakeLists.txt`: `if (WIN32)` → `if (WIN32 AND NOT ANDROID)`, and the Xcode check gets `AND NOT ANDROID`.
3. `src/base/net/tls/TlsGen.cpp`: `const_cast<X509_NAME *>` for OpenSSL 4's `const` return.
4. `src/donate.h`: default and minimum donate level set to 0 (AndroMiner exposes it as a user setting).

To rebase, bump `XMRIG_REF` and rebuild. A patch whose `perl` pattern no longer matches does nothing silently, so check `git -C miner-builder/work/src/xmrig diff` afterwards.

## Build and test

```bash
# armeabi-v7a TLS miner (Linux or WSL; NDK r27c matches CI)
ABI=armeabi-v7a WITH_TLS=ON SKIP_INSTALL=1 bash miner-builder/build-xmrig-android.sh
# flag comparison builds
ABI=armeabi-v7a bash miner-builder/build-variants.sh release
# emulated hash check (needs qemu-user and gcc-arm-linux-gnueabihf)
bash miner-builder/validate-armv7-qemu.sh
# on a real device (adb, unplugged); extra args after --
bash miner-builder/bench/bench.sh LABEL path/to/libxmrig.so THREADS 120 40 -- --randomx-mode=light
```

CI job `miner-armeabi-v7a` in `validation.yml` runs the build and emulated check on every pull request. It hasn't run on GitHub yet.

`bench.sh` records device ABI, SoC and a binary hash per row and supports light mode (init time is 0 there). Compare builds at identical thread counts, durations and thermal start state. Don't compare rows marked `unstable` (CV above 10%).

## Compatibility

| Target                    | Cross-compile | Loader/deps | Emulated check | Real device      |
| ------------------------- | ------------- | ----------- | -------------- | ---------------- |
| arm64-v8a (app minSdk 24) | existing      | existing    | n/a            | not run          |
| armeabi-v7a with NEON     | yes           | yes         | one hash (GCC) | **not run**      |
| armeabi-v7a without NEON  | n/a           | n/a         | n/a            | refused at start |
| x86 / x86_64              | unsupported   | n/a         | n/a            | n/a              |

Not covered: other CPU generations, allocation-failure injection, long sessions, thermal throttling, battery behavior, pool and share traffic on armeabi-v7a, sanitizer builds.

## Next steps

1. **Measure.** Run `bench.sh` on real arm64 and armeabi-v7a hardware. Then decide whether to ship the arm64 `release` or `thinlto` variant (7 MB vs 31.7 MB) and re-pin its hash.
2. **Hardware AES on 32-bit.** Many 32-bit phones have Cortex-A53/A57/A72 cores with AES instructions available in AArch32 (`HWCAP2_AES`). A runtime-selected hardware AES path is probably the biggest ARMv7 gain, but RandomX inlines AES through `intrin_portable.h`, so it needs a careful patch and measurement.
3. Fast mode on 4 GB+ 32-bit devices, only if measured stable.
4. Hash-pinned armeabi-v7a downloads for the downloader variant.
5. Repeat the arm64 thread and affinity experiment cleanly.
