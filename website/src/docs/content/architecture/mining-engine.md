# Mining engine

One engine runs per session. XMRig is the default and the only one verified on a device. XMRigCC and XLArig are built and checked as binaries but have never run on hardware, so the app marks them Experimental.

| Engine  | Version | Status       | Algorithms                       | ABIs                       |
| ------- | ------- | ------------ | -------------------------------- | -------------------------- |
| XMRig   | 6.26.0  | Supported    | `rx/0`, `rx/wow`, `gr`, `cn/ccx` | `arm64-v8a`, `armeabi-v7a` |
| XMRigCC | 3.4.9   | Experimental | same as XMRig                    | `arm64-v8a`, `armeabi-v7a` |
| XLArig  | 5.2.4   | Experimental | `panthera` (Scala) only          | `arm64-v8a`, `armeabi-v7a` |

All three share XMRig's command line, output format and HTTP API, so one runtime drives them. Licences are GPL-3.0 upstream; the app code is MIT.

## How the app picks an engine

- The coin picks the engine: Monero selects XMRig, Scala selects XLArig.
- In the engine picker you can choose another engine that supports the coin. Engines that cannot mine it are listed but disabled.
- If the selected engine is not installed, the start button is disabled with a note.
- Saved configs without an `engine` field mean XMRig. Sessions record the engine.

The registry lives in native `MinerEngine` (id, status, library name, algorithms, protocols, ABIs). The interface reads it through `NativeMiner.info()` in `useNativeMinerInfo`. Which engines can be downloaded is decided by `src/utils/engineDownloads.ts`.

Each engine has its own library (`libxmrig.so`, `libxmrigcc.so`, `libxlarig.so`), so engines never overwrite each other.

## Building the binaries

```bash
ENGINE=xmrigcc ABI=arm64-v8a WITH_TLS=ON RELEASE_BUILD=1 bash miner-builder/build-xmrig-android.sh
WITH_TLS=ON miner-builder/build-all-engines.sh     # every engine, every ABI, into jniLibs
```

Requirements: Android SDK and NDK (CI uses `27.2.12479018`), Git, CMake, Ninja, pkg-config, `make`, and a full Perl for TLS builds. Use Linux, WSL or Git Bash; on Windows, TLS builds need MSYS2 Perl. See `miner-builder/README.md`.

## Integrity

Downloader APKs accept only the miner revision and SHA-256 hashes embedded in that APK. Downloads are verified before execution (`MinerIntegrity`) and installed atomically; a failed check keeps the previous file. Redirects are rejected.

Full status and what is not verified: `docs/engines.md` in the repository.
