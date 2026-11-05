# Third-party notices

AndroMiner's own code is MIT-licensed (see [LICENSE](LICENSE)). The mining engines it launches are
separate programs under their own licences. They run as separate processes and are not linked into
the app.

| Component            | Version | Licence    | Source                                    |
| -------------------- | ------- | ---------- | ----------------------------------------- |
| XMRig                | 6.26.0  | GPL-3.0    | <https://github.com/xmrig/xmrig>          |
| XMRigCC              | 3.4.9   | GPL-3.0    | <https://github.com/Bendr0id/xmrigCC>     |
| XLArig               | 5.2.4   | GPL-3.0    | <https://github.com/scala-network/XLArig> |
| libuv                | 1.48.0  | MIT        | <https://github.com/libuv/libuv>          |
| OpenSSL (TLS builds) | 4.0.0   | Apache-2.0 | <https://github.com/openssl/openssl>      |

## GPL-3.0 engines

XMRig, XMRigCC and XLArig are copyrighted by their respective authors and are distributed under the
GNU General Public License, version 3. The full text is at <https://www.gnu.org/licenses/gpl-3.0.txt>
and in each repository's `LICENSE` file.

The binaries in AndroMiner's APKs are built from the unmodified upstream tags above, with only the
build-time patches in `miner-builder/build-xmrig-android.sh` (Android CMake adjustments, an OpenSSL 4
compatibility cast in `TlsGen.cpp`, a default donation level of 0 and, for XMRigCC, the remote-control
client, remote shell and server compiled out). The corresponding source is the upstream tag plus that
script, both public. To obtain it, clone the repository linked above at the listed tag and run the
builder as described in [docs/engines.md](docs/engines.md).

Each binary keeps its upstream version banner (`XMRig`, `XMRigCC`, `XLArig`).

## Not bundled

The DERO miner (`derohe`) is under the DERO Research License, which excludes commercial use and
restricts distribution to research use. It is not bundled, built or downloaded by AndroMiner. See
[docs/engines.md](docs/engines.md).
