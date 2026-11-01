#!/usr/bin/env bash
# Builds a HOST (x86_64, MinGW-w64) XMRig from the same source tree, for harness/correctness checks
# on a PC. It exercises the shared RandomX code (portable interpreter + x86 JIT) and verifies the
# benchmark hash sums, but it is NOT ARM64 and its hashrate says nothing about Android performance.
# Output: miner-builder/host/xmrig-host.exe
set -euo pipefail
BUILDER_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK="$BUILDER_DIR/work"
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
JOBS="${JOBS:-$(nproc)}"

cmake -G Ninja -S "$(native "$WORK/src/libuv")" -B "$(native "$WORK/build/host/libuv")" \
  -DCMAKE_BUILD_TYPE=Release -DLIBUV_BUILD_SHARED=OFF -DLIBUV_BUILD_TESTS=OFF \
  -DCMAKE_INSTALL_PREFIX="$(native "$WORK/prefix/libuv-host")" >"$WORK/logs/host-libuv-configure.log" 2>&1
cmake --build "$(native "$WORK/build/host/libuv")" --target install --parallel "$JOBS" >"$WORK/logs/host-libuv-build.log" 2>&1

cmake -G Ninja -S "$(native "$WORK/src/xmrig")" -B "$(native "$WORK/build/host/xmrig")" \
  -DCMAKE_BUILD_TYPE=Release -DWITH_TLS=OFF -DWITH_HTTP=OFF -DWITH_HWLOC=OFF -DWITH_OPENCL=OFF -DWITH_CUDA=OFF \
  -DWITH_MSR=OFF -DBUILD_STATIC=ON \
  -DUV_INCLUDE_DIR="$(native "$WORK/prefix/libuv-host/include")" \
  -DUV_LIBRARY="$(native "$WORK/prefix/libuv-host/lib/libuv.a")" >"$WORK/logs/host-xmrig-configure.log" 2>&1
cmake --build "$(native "$WORK/build/host/xmrig")" --parallel "$JOBS" >"$WORK/logs/host-xmrig-build.log" 2>&1

mkdir -p "$BUILDER_DIR/host"
cp "$WORK/build/host/xmrig/xmrig-notls.exe" "$BUILDER_DIR/host/xmrig-host.exe"
echo "Built $BUILDER_DIR/host/xmrig-host.exe"
