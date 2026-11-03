#!/usr/bin/env bash
# Builds several independent XMRig executables (ABI=arm64-v8a by default, or ABI=armeabi-v7a) from the already prepared
# miner-builder/work tree (sources + libuv + OpenSSL prefixes produced by
# build-xmrig-android.{sh,ps1}). The shipped jniLibs binary is never touched; output goes to
# miner-builder/variants/<name>/libxmrig.so (arm64-v8a) or
# miner-builder/variants-armeabi-v7a/<name>/libxmrig.so.
#
# usage: bash miner-builder/build-variants.sh [variant ...]   (default: every variant)
#        JOBS=8 bash miner-builder/build-variants.sh release
#        ABI=armeabi-v7a bash miner-builder/build-variants.sh release
#
# All variants use upstream XMRig's architecture baseline (arm64: -march=armv8-a+crypto,
# armeabi-v7a: -march=armv7-a -mfpu=neon; never -mcpu=native); variants differ only in the flags below.
set -euo pipefail

BUILDER_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK_DIR="$BUILDER_DIR/work"
SRC_DIR="$WORK_DIR/src/xmrig"
ABI="${ABI:-arm64-v8a}"
case "$ABI" in
  arm64-v8a) OUT_DIR="$BUILDER_DIR/variants"; DEFAULT_PLATFORM=android-29 ;;
  armeabi-v7a) OUT_DIR="$BUILDER_DIR/variants-$ABI"; DEFAULT_PLATFORM=android-24 ;;
  *) echo "Unsupported ABI: $ABI" >&2; exit 1 ;;
esac
ANDROID_PLATFORM="${ANDROID_PLATFORM:-$DEFAULT_PLATFORM}"
JOBS="${JOBS:-$(nproc)}"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
[[ -n "$SDK" ]] || { echo "Set ANDROID_HOME" >&2; exit 1; }
NDK_DIR="${ANDROID_NDK_HOME:-$(ls -d "$SDK"/ndk/* | sort -V | tail -n 1)}"
TOOLCHAIN="$NDK_DIR/build/cmake/android.toolchain.cmake"
LLVM_BIN="$(ls -d "$NDK_DIR"/toolchains/llvm/prebuilt/*/bin | head -n 1)"
EXE=""; [[ -f "$LLVM_BIN/llvm-strip.exe" ]] && EXE=".exe"
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }

# Reproducibility: no build-id or absolute-path leakage. XMRig embeds __DATE__ in its version
# banner, so two builds are byte-identical only when made on the same calendar day.
REPRO_FLAGS="-ffile-prefix-map=$(native "$WORK_DIR")=/work"
REPRO_LD="-Wl,--build-id=none"

# name | extra C/C++ flags | CMAKE_*_FLAGS_RELEASE | extra linker flags | strip
declare -A CFLAGS_OF RELEASE_OF LDFLAGS_OF STRIP_OF
CFLAGS_OF[baseline]="";                       RELEASE_OF[baseline]="";                                         LDFLAGS_OF[baseline]="";                      STRIP_OF[baseline]=0
CFLAGS_OF[release]="-g0 $REPRO_FLAGS";        RELEASE_OF[release]="-O3 -DNDEBUG";                              LDFLAGS_OF[release]="-Wl,--gc-sections $REPRO_LD"; STRIP_OF[release]=1
CFLAGS_OF[O2]="-g0 $REPRO_FLAGS";             RELEASE_OF[O2]="-O2 -DNDEBUG";                                   LDFLAGS_OF[O2]="-Wl,--gc-sections $REPRO_LD";      STRIP_OF[O2]=1
CFLAGS_OF[thinlto]="-g0 -flto=thin $REPRO_FLAGS"; RELEASE_OF[thinlto]="-O3 -DNDEBUG";                          LDFLAGS_OF[thinlto]="-flto=thin -Wl,--gc-sections $REPRO_LD"; STRIP_OF[thinlto]=1
CFLAGS_OF[thinlto-O2]="-g0 -flto=thin $REPRO_FLAGS"; RELEASE_OF[thinlto-O2]="-O2 -DNDEBUG";                    LDFLAGS_OF[thinlto-O2]="-flto=thin -Wl,--gc-sections $REPRO_LD"; STRIP_OF[thinlto-O2]=1
CFLAGS_OF[tune-a76]="-g0 -mtune=cortex-a76 $REPRO_FLAGS"; RELEASE_OF[tune-a76]="-O3 -DNDEBUG";                 LDFLAGS_OF[tune-a76]="-Wl,--gc-sections $REPRO_LD"; STRIP_OF[tune-a76]=1

ALL=(baseline release O2 thinlto thinlto-O2)
[[ "$ABI" == arm64-v8a ]] && ALL+=(tune-a76)
VARIANTS=("$@"); (( ${#VARIANTS[@]} )) || VARIANTS=("${ALL[@]}")

for v in "${VARIANTS[@]}"; do
  [[ -n "${STRIP_OF[$v]+x}" ]] || { echo "Unknown variant: $v (known: ${ALL[*]})" >&2; exit 1; }
  build="$WORK_DIR/build/variants/$ABI/$v"
  out="$OUT_DIR/$v"
  mkdir -p "$out" "$WORK_DIR/logs/variants/$ABI"
  rm -rf "$build"
  echo "==> [$v] configure"
  cmake -G Ninja -S "$(native "$SRC_DIR")" -B "$(native "$build")" \
    -DCMAKE_TOOLCHAIN_FILE="$(native "$TOOLCHAIN")" -DANDROID_ABI="$ABI" -DANDROID_PLATFORM="$ANDROID_PLATFORM" \
    -DANDROID_STL=c++_static -DCMAKE_BUILD_TYPE=Release \
    -DWITH_TLS=ON -DWITH_HTTP=ON -DWITH_HWLOC=OFF -DWITH_OPENCL=OFF -DWITH_CUDA=OFF -DBUILD_STATIC=OFF \
    -DUV_INCLUDE_DIR="$(native "$WORK_DIR/prefix/libuv-$ABI/include")" \
    -DUV_LIBRARY="$(native "$WORK_DIR/prefix/libuv-$ABI/lib/libuv.a")" \
    -DOPENSSL_ROOT_DIR="$(native "$WORK_DIR/prefix/openssl-$ABI")" -DOPENSSL_USE_STATIC_LIBS=TRUE \
    -DOPENSSL_INCLUDE_DIR="$(native "$WORK_DIR/prefix/openssl-$ABI/include")" \
    -DOPENSSL_CRYPTO_LIBRARY="$(native "$WORK_DIR/prefix/openssl-$ABI/lib/libcrypto.a")" \
    -DOPENSSL_SSL_LIBRARY="$(native "$WORK_DIR/prefix/openssl-$ABI/lib/libssl.a")" \
    -DPKG_CONFIG_USE_CMAKE_PREFIX_PATH=FALSE \
    ${CFLAGS_OF[$v]:+"-DCMAKE_C_FLAGS=${CFLAGS_OF[$v]}" "-DCMAKE_CXX_FLAGS=${CFLAGS_OF[$v]}"} \
    ${RELEASE_OF[$v]:+"-DCMAKE_C_FLAGS_RELEASE=${RELEASE_OF[$v]}" "-DCMAKE_CXX_FLAGS_RELEASE=${RELEASE_OF[$v]}"} \
    ${LDFLAGS_OF[$v]:+"-DCMAKE_EXE_LINKER_FLAGS=${LDFLAGS_OF[$v]}"} \
    >"$WORK_DIR/logs/variants/$ABI/$v-configure.log" 2>&1
  echo "==> [$v] build"
  cmake --build "$(native "$build")" --parallel "$JOBS" >"$WORK_DIR/logs/variants/$ABI/$v-build.log" 2>&1 \
    || { tail -n 40 "$WORK_DIR/logs/variants/$ABI/$v-build.log"; exit 1; }
  cp "$build/xmrig" "$out/libxmrig.so"
  bash "$BUILDER_DIR/verify-android-binary.sh" "$out/libxmrig.so" "$NDK_DIR" "$ABI" ON >"$out/verify.log" 2>&1     || { cat "$out/verify.log"; echo "==> [$v] VERIFY FAILED (unstripped)" >&2; exit 1; }
  VERIFY_ARGS=()
  if [[ "${STRIP_OF[$v]}" == 1 ]]; then
    "$LLVM_BIN/llvm-strip$EXE" --strip-unneeded "$out/libxmrig.so"
    VERIFY_ARGS=(--stripped)
  fi
  {
    echo "variant:      $v"
    echo "c/c++ flags:  ${CFLAGS_OF[$v]:-<toolchain default>}"
    echo "release flags: ${RELEASE_OF[$v]:-<toolchain default>}"
    echo "linker flags: ${LDFLAGS_OF[$v]:-<default>}"
    echo "stripped:     ${STRIP_OF[$v]}"
    echo "ndk:          $(basename "$NDK_DIR")  platform: $ANDROID_PLATFORM"
    echo "sha256:       $(sha256sum "$out/libxmrig.so" | cut -d' ' -f1)"
    echo "bytes:        $(stat -c %s "$out/libxmrig.so")"
  } >"$out/BUILD-INFO.txt"
  bash "$BUILDER_DIR/verify-android-binary.sh" "$out/libxmrig.so" "$NDK_DIR" "$ABI" ON "${VERIFY_ARGS[@]}" >>"$out/verify.log" 2>&1 \
    && echo "==> [$v] OK  $(stat -c %s "$out/libxmrig.so") bytes" \
    || { cat "$out/verify.log"; echo "==> [$v] VERIFY FAILED" >&2; exit 1; }
done
