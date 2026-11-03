#!/usr/bin/env bash
# Emulated ARMv7-A correctness check. NOT a performance test and NOT the shipped Android binary.
#
# Compiles XMRig's RandomX code for 32-bit ARM Linux/glibc with GCC (upstream flags: -march=armv7-a
# -mfpu=neon; no ARMv8 crypto extension, so software AES) and for the build host, links
# validate/randomx_vector.cpp against each, and compares one rx/0 hash computed
#   1. natively on the host (x86_64, XMRig interpreter), and
#   2. in 32-bit ARM under qemu-user,
# with the published RandomX test vector. This exercises the RandomX interpreter, the NEON intrinsics
# and the soft-AES path used by the armeabi-v7a Android build. It cannot validate bionic, the Android
# linker, Clang code generation, or real-CPU feature detection. XMRig's own --bench reference hashes need
# at least 10,000 hashes, which take about 14 hours under emulation, hence this single-vector check.
#
# Needs (Debian/Ubuntu): g++ qemu-user gcc-arm-linux-gnueabihf g++-arm-linux-gnueabihf cmake ninja-build
# and the sources fetched by build-xmrig-android.sh in miner-builder/work.
# usage: bash miner-builder/validate-armv7-qemu.sh
set -euo pipefail

BUILDER_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK_DIR="${WORK_DIR:-$BUILDER_DIR/work}"
SRC="$WORK_DIR/src"
OUT="$WORK_DIR/build/rx-vector"
JOBS="${JOBS:-2}"
PUBLISHED=639183aae1bf4c9a35884cb46b09cad9175f04efd7684e7262a0ac1c2f0b4e3f

for tool in g++ arm-linux-gnueabihf-g++ qemu-arm cmake ninja; do
  command -v "$tool" >/dev/null || { echo "Missing $tool" >&2; exit 1; }
done
mkdir -p "$OUT"

cat >"$OUT/armhf-toolchain.cmake" <<'TC'
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR armv7-a)
set(CMAKE_C_COMPILER arm-linux-gnueabihf-gcc)
set(CMAKE_CXX_COMPILER arm-linux-gnueabihf-g++)
set(CMAKE_FIND_ROOT_PATH /usr/arm-linux-gnueabihf)
TC

# build_target NAME CXX [cmake args...]: libuv + XMRig (no TLS/HTTP), then link the vector harness.
build_target() {
  local name="$1" cxx="$2"; shift 2
  local dir="$OUT/$name"
  cmake -G Ninja -S "$SRC/libuv" -B "$dir/libuv" -DCMAKE_BUILD_TYPE=Release -DLIBUV_BUILD_SHARED=OFF \
    -DLIBUV_BUILD_TESTS=OFF -DCMAKE_INSTALL_PREFIX="$dir/uv" "$@" >"$dir.libuv.log" 2>&1
  cmake --build "$dir/libuv" --target install --parallel "$JOBS" >>"$dir.libuv.log" 2>&1
  cmake -G Ninja -S "$SRC/xmrig" -B "$dir/xmrig" -DCMAKE_BUILD_TYPE=Release -DWITH_TLS=OFF -DWITH_HTTP=OFF \
    -DWITH_HWLOC=OFF -DWITH_OPENCL=OFF -DWITH_CUDA=OFF -DWITH_MSR=OFF -DWITH_BENCHMARK=OFF -DWITH_DMI=OFF \
    -DUV_INCLUDE_DIR="$dir/uv/include" -DUV_LIBRARY="$dir/uv/lib/libuv.a" "$@" >"$dir.xmrig.log" 2>&1
  cmake --build "$dir/xmrig" --parallel "$JOBS" >>"$dir.xmrig.log" 2>&1
  local objs libs
  mapfile -t objs < <(find "$dir/xmrig/CMakeFiles/xmrig-notls.dir" "$dir/xmrig/CMakeFiles/xmrig.dir" -name '*.o' 2>/dev/null | grep -v '/src/xmrig.cpp.o$')
  mapfile -t libs < <(find "$dir/xmrig" -name '*.a')
  "$cxx" -O2 -I"$SRC/xmrig/src" -I"$SRC/xmrig/src/3rdparty" "$BUILDER_DIR/validate/randomx_vector.cpp" \
    "${objs[@]}" "${libs[@]}" "$dir/uv/lib/libuv.a" -lpthread -ldl -lrt -o "$dir/randomx_vector"
}

echo "== host (x86_64) reference"
build_target host g++
HOST_HASH="$("$OUT/host/randomx_vector")"

echo "== armv7 (qemu-arm; light-mode cache init is slow)"
# -fno-tree-vectorize: GCC 13 auto-vectorizes Argon2's stack buffer with 64-bit-aligned NEON loads that
# fault (SIGBUS) at a 4-byte-aligned address. The Clang-built Android binary does not use alignment
# hints in that function (checked with llvm-objdump), so this keeps the check on the RandomX code.
build_target armv7 arm-linux-gnueabihf-g++ -DCMAKE_TOOLCHAIN_FILE="$OUT/armhf-toolchain.cmake" -DCMAKE_C_FLAGS=-fno-tree-vectorize
file "$OUT/armv7/randomx_vector"
ARM_HASH="$(qemu-arm -L /usr/arm-linux-gnueabihf "$OUT/armv7/randomx_vector")"

echo "published: $PUBLISHED"
echo "host:      $HOST_HASH"
echo "armv7:     $ARM_HASH"
if [[ "$HOST_HASH" == "$PUBLISHED" && "$ARM_HASH" == "$PUBLISHED" ]]; then
  echo "RESULT: ARMv7 (qemu) and host hashes match the published RandomX vector."
else
  echo "RESULT: MISMATCH" >&2
  exit 1
fi
