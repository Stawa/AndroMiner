#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILDER_DIR="$ROOT_DIR/miner-builder"
WORK_DIR="${WORK_DIR:-$BUILDER_DIR/work}"
SRC_DIR="$WORK_DIR/src"
BUILD_DIR="$WORK_DIR/build"
PREFIX_DIR="$WORK_DIR/prefix"

ABI="${ABI:-arm64-v8a}"
# arm64-v8a keeps API 29 (the pinned download revision was built with it). armeabi-v7a targets the
# app's minSdk (android/variables.gradle) because 32-bit devices skew toward old Android releases;
# an API 29 binary can reference bionic symbols that do not exist there.
case "$ABI" in
  armeabi-v7a) DEFAULT_PLATFORM="android-24" ;;
  *) DEFAULT_PLATFORM="android-29" ;;
esac
ANDROID_PLATFORM="${ANDROID_PLATFORM:-$DEFAULT_PLATFORM}"
# ENGINE selects the upstream miner. Each engine builds into its own source and build directories
# and installs a separately named library, so engines never overwrite one another.
ENGINE="${ENGINE:-xmrig}"
case "$ENGINE" in
  xmrig)
    ENGINE_NAME="XMRig"
    ENGINE_REPO="https://github.com/xmrig/xmrig.git"
    ENGINE_REF="${XMRIG_REF:-v6.26.0}"
    ENGINE_BINARIES=(xmrig xmrig-notls)
    ENGINE_CMAKE_ARGS=()
    ENGINE_LIB="libxmrig.so"
    ;;
  xmrigcc)
    # Miner only: the command-and-control client, remote shell and server stay out of the binary.
    ENGINE_NAME="XMRigCC"
    ENGINE_REPO="https://github.com/Bendr0id/xmrigCC.git"
    ENGINE_REF="${XMRIGCC_REF:-3.4.9}"
    ENGINE_BINARIES=(xmrigMiner)
    ENGINE_CMAKE_ARGS=(-DWITH_CC_CLIENT=OFF -DWITH_CC_SERVER=OFF -DWITH_CC_SHELL_EXEC=OFF
      -DWITH_ASM=OFF -DWITH_MSR=OFF -DWITH_DMI=OFF -DWITH_ARGON2=OFF)
    ENGINE_LIB="libxmrigcc.so"
    ;;
  xlarig)
    ENGINE_NAME="XLArig"
    ENGINE_REPO="https://github.com/scala-network/XLArig.git"
    ENGINE_REF="${XLARIG_REF:-v5.2.4}"
    ENGINE_BINARIES=(xlarig xlarig-notls)
    # XLArig 5.x declares a CMake minimum that current CMake refuses; its code is otherwise unchanged.
    ENGINE_CMAKE_ARGS=(-DWITH_ASM=OFF -DCMAKE_POLICY_VERSION_MINIMUM=3.5)
    ENGINE_LIB="libxlarig.so"
    ;;
  *)
    echo "Unknown ENGINE '$ENGINE'. Use xmrig, xmrigcc or xlarig." >&2
    exit 1
    ;;
esac
XMRIG_REF="$ENGINE_REF"
LIBUV_REF="${LIBUV_REF:-v1.48.0}"
OPENSSL_REF="${OPENSSL_REF:-openssl-4.0.0}"
WITH_TLS="${WITH_TLS:-ON}"
WITH_TLS="${WITH_TLS^^}"
if [[ "$WITH_TLS" != "ON" && "$WITH_TLS" != "OFF" ]]; then
  echo "WITH_TLS must be ON or OFF." >&2
  exit 1
fi
LOG_DIR="$WORK_DIR/logs/$ABI-$WITH_TLS"
CPU_TUNE="${CPU_TUNE:-}"
THIN_LTO="${THIN_LTO:-0}"
QUIET="${QUIET:-ON}"
JOBS="${JOBS:-$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)}"
SKIP_INSTALL="${SKIP_INSTALL:-0}"
# RELEASE_BUILD=1 drops debug info, build ids and unused sections, remaps source paths and strips
# the output. Default on for armeabi-v7a; off for arm64-v8a so its output is unchanged.
if [[ -z "${RELEASE_BUILD:-}" ]]; then
  [[ "$ABI" == armeabi-v7a ]] && RELEASE_BUILD=1 || RELEASE_BUILD=0
fi

if [[ -t 1 ]]; then
  COLOR_CYAN=$'\033[36m'
  COLOR_GREEN=$'\033[32m'
  COLOR_RED=$'\033[31m'
  COLOR_WHITE=$'\033[37m'
  COLOR_DIM=$'\033[90m'
  COLOR_RESET=$'\033[0m'
else
  COLOR_CYAN=""
  COLOR_GREEN=""
  COLOR_RED=""
  COLOR_WHITE=""
  COLOR_DIM=""
  COLOR_RESET=""
fi

log_header() {
  printf '\n%sAndroMiner XMRig Android Builder%s\n' "$COLOR_WHITE" "$COLOR_RESET"
  printf '%sBuild started %s%s\n\n' "$COLOR_DIM" "$(date '+%Y-%m-%d %H:%M:%S')" "$COLOR_RESET"
}

log_step() {
  printf '  %s%s%s\n' "$COLOR_CYAN" "$*" "$COLOR_RESET"
}

log_detail() {
  printf '    %-18s %s\n' "$1:" "$2"
}

log_success() {
  printf '  %s%s%s\n' "$COLOR_GREEN" "$*" "$COLOR_RESET"
}

log_error() {
  printf '  %s%s%s\n' "$COLOR_RED" "$*" "$COLOR_RESET" >&2
}

log_header

ANDROID_SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$ANDROID_SDK" ]]; then
  echo "Set ANDROID_HOME or ANDROID_SDK_ROOT to your Android SDK path." >&2
  exit 1
fi

if [[ -n "${ANDROID_NDK_HOME:-}" ]]; then
  NDK_DIR="$ANDROID_NDK_HOME"
elif [[ -n "${ANDROID_NDK_ROOT:-}" ]]; then
  NDK_DIR="$ANDROID_NDK_ROOT"
else
  NDK_DIR="$(find "$ANDROID_SDK/ndk" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort -V | tail -n 1 || true)"
fi

if [[ -z "$NDK_DIR" || ! -f "$NDK_DIR/build/cmake/android.toolchain.cmake" ]]; then
  echo "Could not find Android NDK. Install it in Android Studio or set ANDROID_NDK_HOME." >&2
  exit 1
fi

TOOLCHAIN="$NDK_DIR/build/cmake/android.toolchain.cmake"
INSTALL_DIR="$ROOT_DIR/android/app/src/main/jniLibs/$ABI"
OUTPUT_BINARY="$INSTALL_DIR/$ENGINE_LIB"

command -v git >/dev/null || { echo "git is required." >&2; exit 1; }
command -v cmake >/dev/null || { echo "cmake is required." >&2; exit 1; }
command -v ninja >/dev/null || { echo "ninja is required." >&2; exit 1; }
command -v pkg-config >/dev/null || { echo "pkg-config is required." >&2; exit 1; }

mkdir -p "$SRC_DIR" "$BUILD_DIR" "$PREFIX_DIR" "$INSTALL_DIR" "$LOG_DIR"

quiet_enabled() {
  [[ "${QUIET^^}" != "OFF" && "${VERBOSE:-0}" != "1" ]]
}

format_elapsed() {
  local seconds="$1"
  printf '%02d:%02d:%02d' "$((seconds / 3600))" "$(((seconds % 3600) / 60))" "$((seconds % 60))"
}

wait_with_progress() {
  local label="$1"
  local log_file="$2"
  local pid="$3"
  local started_at
  local next_heartbeat
  local now
  local elapsed
  local elapsed_label
  local status

  started_at="$(date +%s)"
  next_heartbeat=$((started_at + 20))

  while kill -0 "$pid" 2>/dev/null; do
    now="$(date +%s)"
    elapsed=$((now - started_at))
    elapsed_label="$(format_elapsed "$elapsed")"

    if [[ -t 1 ]]; then
      printf '\r    Running | elapsed %s | log %s' "$elapsed_label" "$log_file"
    fi

    if (( now >= next_heartbeat )); then
      if [[ -t 1 ]]; then
        printf '\n'
      fi
      log_detail "Progress" "running for $elapsed_label"
      next_heartbeat=$((now + 20))
    fi

    sleep 1
  done

  set +e
  wait "$pid"
  status=$?
  set -e

  if [[ -t 1 ]]; then
    printf '\r%*s\r' 120 ''
  fi

  elapsed=$(( $(date +%s) - started_at ))
  log_detail "Elapsed" "$(format_elapsed "$elapsed")"
  return "$status"
}

run_logged() {
  local label="$1"
  local log_file="$2"
  shift 2

  if quiet_enabled; then
    log_step "$label"
    "$@" >"$log_file" 2>&1 &
    local command_pid=$!
    if wait_with_progress "$label" "$log_file" "$command_pid"; then
      log_detail "Log" "$log_file"
      return 0
    fi

    log_error "Build step failed: $label"
    log_error "Last 120 log lines from $log_file:"
    tail -n 120 "$log_file" >&2 || true
    return 1
  fi

  log_step "$label"
  "$@" 2>&1 | tee "$log_file"
}

clone_or_update() {
  local repo="$1"
  local ref="$2"
  local dir="$3"

  if [[ ! -d "$dir/.git" ]]; then
    git clone --depth 1 --branch "$ref" "$repo" "$dir"
    return
  fi

  git -C "$dir" reset --hard
  git -C "$dir" fetch --depth 1 origin "$ref"
  git -C "$dir" checkout FETCH_HEAD
}

android_api_level() {
  if [[ "$ANDROID_PLATFORM" =~ ^android-([0-9]+)$ ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo "ANDROID_PLATFORM must use the form android-29." >&2
    return 1
  fi
}

openssl_android_target() {
  case "$ABI" in
    arm64-v8a) echo "android-arm64" ;;
    armeabi-v7a) echo "android-arm" ;;
    x86) echo "android-x86" ;;
    x86_64) echo "android-x86_64" ;;
    *)
      echo "Unsupported OpenSSL Android ABI: $ABI" >&2
      exit 1
      ;;
  esac
}

build_openssl() (
  set -euo pipefail
  local source_dir="$1"
  local prefix="$2"
  local target="$3"
  local api_level="$4"
  local host_tag="linux-x86_64"
  local llvm_bin="$NDK_DIR/toolchains/llvm/prebuilt/$host_tag/bin"

  if [[ ! -d "$llvm_bin" ]]; then
    echo "Android NDK LLVM toolchain was not found at $llvm_bin." >&2
    exit 1
  fi

  command -v perl >/dev/null || { echo "perl is required to build OpenSSL." >&2; exit 1; }
  perl -MLocale::Maketext::Simple -MIPC::Cmd -e 'exit 0' >/dev/null 2>&1 || {
    echo "A full Perl installation is required to build OpenSSL." >&2
    exit 1
  }
  perl -MConfig -e 'exit($Config::Config{osname} =~ /MSWin32/i ? 1 : 0)' >/dev/null 2>&1 || {
    echo "OpenSSL Android builds require a Unix-like Perl. Use MSYS2 Perl or WSL/Ubuntu Perl." >&2
    exit 1
  }
  command -v make >/dev/null || { echo "make is required to build OpenSSL." >&2; exit 1; }

  rm -rf "$prefix"
  mkdir -p "$prefix"

  cd "$source_dir"
  export ANDROID_NDK_ROOT="$NDK_DIR"
  export ANDROID_NDK_HOME="$NDK_DIR"
  export PATH="$llvm_bin:$PATH"

  if [[ -f Makefile ]]; then
    make distclean
  fi

  # OpenSSL's ARMv8-crypto assembly objects do not link into a 32-bit ARM binary, and TLS speed does
  # not affect RandomX hashrate, so armeabi-v7a uses OpenSSL's portable C code.
  local arch_flags=()
  [[ "$target" == "android-arm" ]] && arch_flags+=(no-asm)

  # Android supplies OS entropy; these optional external libraries are unnecessary.
  perl Configure "$target" no-shared no-tests no-unit-test no-apps no-jitter no-zstd "${arch_flags[@]}" \
    --with-rand-seed=os --libdir=lib \
    "--prefix=$prefix" \
    "--openssldir=$prefix/ssl" \
    "-D__ANDROID_API__=$api_level"
  perl configdata.pm --dump
  make -j "$JOBS"
  make install_sw
)

log_step "Using Android toolchain"
log_detail "Android SDK" "$ANDROID_SDK"
log_detail "Android NDK" "$NDK_DIR"
log_detail "ABI" "$ABI"
log_detail "Platform" "$ANDROID_PLATFORM"
log_detail "Jobs" "$JOBS"

log_step "Restoring libuv ($LIBUV_REF)"
clone_or_update "https://github.com/libuv/libuv.git" "$LIBUV_REF" "$SRC_DIR/libuv"

rm -rf "$BUILD_DIR/libuv-$ABI"
rm -rf "$PREFIX_DIR/libuv-$ABI"
run_logged "Configuring libuv" "$LOG_DIR/libuv-configure-$ABI.log" cmake -G Ninja -S "$SRC_DIR/libuv" -B "$BUILD_DIR/libuv-$ABI" \
  -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN" \
  -DANDROID_ABI="$ABI" \
  -DANDROID_PLATFORM="$ANDROID_PLATFORM" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$PREFIX_DIR/libuv-$ABI" \
  -DCMAKE_INSTALL_LIBDIR=lib \
  -DBUILD_TESTING=OFF \
  -DLIBUV_BUILD_SHARED=OFF \
  -DLIBUV_BUILD_TESTS=OFF
run_logged "Building libuv" "$LOG_DIR/libuv-build-$ABI.log" cmake --build "$BUILD_DIR/libuv-$ABI" --target install --parallel "$JOBS"

UV_INCLUDE="$PREFIX_DIR/libuv-$ABI/include"
UV_LIBRARY="$PREFIX_DIR/libuv-$ABI/lib/libuv.a"
if [[ ! -s "$UV_LIBRARY" ]]; then
  echo "Could not find built libuv static library." >&2
  exit 1
fi

OPENSSL_CMAKE_ARGS=()
# FindOpenSSL reads pkg-config's static dependencies even with explicit archives.
# Replace its host search paths instead of adding Android paths ahead of them.
export PKG_CONFIG_PATH=""
export PKG_CONFIG_LIBDIR="$PREFIX_DIR/libuv-$ABI/lib/pkgconfig"
export PKG_CONFIG_SYSROOT_DIR=""
if [[ "$WITH_TLS" == "ON" ]]; then
  OPENSSL_TARGET="$(openssl_android_target)"
  ANDROID_API="$(android_api_level)"

  # SKIP_OPENSSL_BUILD=1 reuses an OpenSSL already installed in the prefix. OpenSSL's Android build
  # needs a Linux host, so this lets other hosts rebuild an engine against a prebuilt copy.
  if [[ "${SKIP_OPENSSL_BUILD:-0}" == "1" && -f "$PREFIX_DIR/openssl-$ABI/lib/libssl.a" ]]; then
    log_step "Reusing OpenSSL from $PREFIX_DIR/openssl-$ABI"
  else
    log_step "Restoring OpenSSL ($OPENSSL_REF)"
    clone_or_update "https://github.com/openssl/openssl.git" "$OPENSSL_REF" "$SRC_DIR/openssl"

    run_logged "Building OpenSSL ($OPENSSL_TARGET, API $ANDROID_API)" "$LOG_DIR/openssl.log" \
      build_openssl "$SRC_DIR/openssl" "$PREFIX_DIR/openssl-$ABI" "$OPENSSL_TARGET" "$ANDROID_API"
  fi

  export PKG_CONFIG_LIBDIR="$PREFIX_DIR/openssl-$ABI/lib/pkgconfig:$PKG_CONFIG_LIBDIR"
  run_logged "Checking OpenSSL static dependencies" "$LOG_DIR/openssl-static-libs.log" \
    pkg-config --static --libs openssl

  OPENSSL_CMAKE_ARGS=(
    "-DXMRIG_DEPS=$PREFIX_DIR/openssl-$ABI"
    "-DOPENSSL_ROOT_DIR=$PREFIX_DIR/openssl-$ABI"
    "-DOPENSSL_USE_STATIC_LIBS=TRUE"
    "-DOPENSSL_INCLUDE_DIR=$PREFIX_DIR/openssl-$ABI/include"
    "-DOPENSSL_SSL_LIBRARY=$PREFIX_DIR/openssl-$ABI/lib/libssl.a"
    "-DOPENSSL_CRYPTO_LIBRARY=$PREFIX_DIR/openssl-$ABI/lib/libcrypto.a"
  )
else
  log_step "Skipping OpenSSL because WITH_TLS=$WITH_TLS"
fi

log_step "Restoring $ENGINE_NAME ($ENGINE_REF)"
clone_or_update "$ENGINE_REPO" "$ENGINE_REF" "$SRC_DIR/$ENGINE"

log_step "Preparing $ENGINE_NAME Android CMake patch"
if grep -q "pthread rt dl log" "$SRC_DIR/$ENGINE/CMakeLists.txt"; then
  perl -0pi -e 's/pthread rt dl log/dl/g' "$SRC_DIR/$ENGINE/CMakeLists.txt"
fi
perl -0pi -e 's/if \(WIN32\)/if (WIN32 AND NOT ANDROID)/g' "$SRC_DIR/$ENGINE/CMakeLists.txt"
perl -0pi -e 's/NOT CMAKE_GENERATOR STREQUAL Xcode\)/NOT CMAKE_GENERATOR STREQUAL Xcode AND NOT ANDROID)/g' "$SRC_DIR/$ENGINE/CMakeLists.txt"
if [[ -f "$SRC_DIR/$ENGINE/src/base/net/tls/TlsGen.cpp" ]]; then
  perl -0pi -e 's/auto name = X509_get_subject_name\(m_x509\);/auto name = const_cast<X509_NAME *>(X509_get_subject_name(m_x509));/g' "$SRC_DIR/$ENGINE/src/base/net/tls/TlsGen.cpp"
fi
if [[ -f "$SRC_DIR/$ENGINE/src/donate.h" ]]; then
  perl -0pi -e 's/constexpr const int kDefaultDonateLevel = \d+;/constexpr const int kDefaultDonateLevel = 0;/g; s/constexpr const int kMinimumDonateLevel = \d+;/constexpr const int kMinimumDonateLevel = 0;/g' "$SRC_DIR/$ENGINE/src/donate.h"
fi

log_step "Building $ENGINE_NAME"
log_detail "TLS" "$WITH_TLS"
log_detail "Backend" "CPU"
log_detail "HTTP API" "Enabled"
log_detail "hwloc" "Disabled"
if [[ -n "$CPU_TUNE" ]]; then
  log_detail "CPU tune" "$CPU_TUNE"
else
  case "$ABI" in
    armeabi-v7a) log_detail "CPU tune" "Generic ARMv7-A + NEON (upstream -march=armv7-a -mfpu=neon)" ;;
    *) log_detail "CPU tune" "Generic ARM64" ;;
  esac
fi
if [[ "$THIN_LTO" == "1" ]]; then
  log_detail "Thin LTO" "Enabled"
else
  log_detail "Thin LTO" "Disabled"
fi
log_detail "Release build" "$RELEASE_BUILD"
rm -rf "$BUILD_DIR/$ENGINE-$ABI"
XMRIG_EXTRA_FLAGS=()
XMRIG_LINK_FLAGS=()
if [[ "$RELEASE_BUILD" == "1" ]]; then
  XMRIG_EXTRA_FLAGS+=(-g0 "-ffile-prefix-map=$WORK_DIR=/work")
  XMRIG_LINK_FLAGS+=(-Wl,--gc-sections -Wl,--build-id=none)
fi
if [[ -n "$CPU_TUNE" ]]; then
  XMRIG_EXTRA_FLAGS+=("-mtune=$CPU_TUNE")
fi
if [[ "$THIN_LTO" == "1" ]]; then
  XMRIG_EXTRA_FLAGS+=("-flto=thin")
fi
XMRIG_CMAKE_ARGS=(
  -G Ninja
  -S "$SRC_DIR/$ENGINE"
  -B "$BUILD_DIR/$ENGINE-$ABI"
  -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN"
  -DANDROID_ABI="$ABI"
  -DANDROID_PLATFORM="$ANDROID_PLATFORM"
  -DANDROID_STL=c++_static
  -DCMAKE_BUILD_TYPE=Release
  -DPKG_CONFIG_USE_CMAKE_PREFIX_PATH=FALSE
  -DWITH_TLS="$WITH_TLS"
  -DWITH_HTTP=ON
  -DWITH_HWLOC=OFF
  -DWITH_OPENCL=OFF
  -DWITH_CUDA=OFF
  -DBUILD_STATIC=OFF
  -DUV_INCLUDE_DIR="$UV_INCLUDE"
  -DUV_LIBRARY="$UV_LIBRARY"
)
if (( ${#XMRIG_EXTRA_FLAGS[@]} > 0 )); then
  XMRIG_EXTRA_FLAG_TEXT="${XMRIG_EXTRA_FLAGS[*]}"
  XMRIG_CMAKE_ARGS+=(
    "-DCMAKE_C_FLAGS=$XMRIG_EXTRA_FLAG_TEXT"
    "-DCMAKE_CXX_FLAGS=$XMRIG_EXTRA_FLAG_TEXT"
  )
fi
if [[ "$THIN_LTO" == "1" ]]; then
  XMRIG_LINK_FLAGS+=(-flto=thin -Wl,--gc-sections)
fi
if (( ${#XMRIG_LINK_FLAGS[@]} > 0 )); then
  XMRIG_CMAKE_ARGS+=("-DCMAKE_EXE_LINKER_FLAGS=${XMRIG_LINK_FLAGS[*]}")
fi
XMRIG_CMAKE_ARGS+=("${ENGINE_CMAKE_ARGS[@]}")
XMRIG_CMAKE_ARGS+=("${OPENSSL_CMAKE_ARGS[@]}")
run_logged "Configuring XMRig" "$LOG_DIR/xmrig-configure-$ABI-$WITH_TLS.log" cmake "${XMRIG_CMAKE_ARGS[@]}"
run_logged "Recording XMRig linker commands" "$LOG_DIR/xmrig-commands.log" \
  ninja -C "$BUILD_DIR/$ENGINE-$ABI" -t commands
run_logged "Building XMRig" "$LOG_DIR/xmrig-build-$ABI-$WITH_TLS.log" cmake --build "$BUILD_DIR/$ENGINE-$ABI" --parallel "$JOBS"

FIND_NAMES=()
for name in "${ENGINE_BINARIES[@]}"; do FIND_NAMES+=(-o -name "$name"); done
BUILT_XMRIG="$(find "$BUILD_DIR/$ENGINE-$ABI" -type f \( -false "${FIND_NAMES[@]}" \) | head -n 1)"
if [[ -z "$BUILT_XMRIG" || ! -s "$BUILT_XMRIG" ]]; then
  echo "XMRig build finished, but the xmrig executable was not found." >&2
  exit 1
fi

run_logged "Verifying Android miner" "$LOG_DIR/xmrig-elf.log" \
  bash "$BUILDER_DIR/verify-android-binary.sh" "$BUILT_XMRIG" "$NDK_DIR" "$ABI" "$WITH_TLS"

if [[ "$RELEASE_BUILD" == "1" ]]; then
  LLVM_BIN="$(ls -d "$NDK_DIR"/toolchains/llvm/prebuilt/*/bin | head -n 1)"
  STRIPPED_XMRIG="$BUILD_DIR/$ENGINE-$ABI/$ENGINE_LIB"
  cp "$BUILT_XMRIG" "$STRIPPED_XMRIG"
  "$LLVM_BIN/llvm-strip" --strip-unneeded "$STRIPPED_XMRIG"
  run_logged "Verifying stripped Android miner" "$LOG_DIR/xmrig-elf-stripped.log" \
    bash "$BUILDER_DIR/verify-android-binary.sh" "$STRIPPED_XMRIG" "$NDK_DIR" "$ABI" "$WITH_TLS" --stripped
  BUILT_XMRIG="$STRIPPED_XMRIG"
fi

log_success "Built Android miner"
log_detail "Output" "$BUILT_XMRIG"
if [[ "$SKIP_INSTALL" == "1" ]]; then
  log_step "Skipped Android project install because SKIP_INSTALL=1 was set"
else
  cp "$BUILT_XMRIG" "$OUTPUT_BINARY"
  chmod 755 "$OUTPUT_BINARY"
  log_success "Installed Android miner"
  log_detail "Target" "$OUTPUT_BINARY"
fi
echo
log_success "Build completed"
echo
printf '%sNext steps:%s\n' "$COLOR_WHITE" "$COLOR_RESET"
echo "  1. Return to the repository root"
echo "     cd \"$ROOT_DIR\""
echo "  2. Sync web assets"
echo "     npm run android:sync"
echo "  3. Open the Android project"
echo "     cd android"
echo
printf '%sCommand reference:%s\n' "$COLOR_WHITE" "$COLOR_RESET"
echo "  Debug APK"
echo "     ./gradlew assembleDebug"
echo
echo "  Debug APK with bundled miner"
echo "     ./gradlew assembleDebug -PbundleMiner=true"
echo
