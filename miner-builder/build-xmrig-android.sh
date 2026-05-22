#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILDER_DIR="$ROOT_DIR/miner-builder"
WORK_DIR="${WORK_DIR:-$BUILDER_DIR/work}"
SRC_DIR="$WORK_DIR/src"
BUILD_DIR="$WORK_DIR/build"
PREFIX_DIR="$WORK_DIR/prefix"

ABI="${ABI:-arm64-v8a}"
ANDROID_PLATFORM="${ANDROID_PLATFORM:-android-29}"
XMRIG_REF="${XMRIG_REF:-master}"
LIBUV_REF="${LIBUV_REF:-v1.48.0}"
OPENSSL_REF="${OPENSSL_REF:-openssl-3.3.2}"
WITH_TLS="${WITH_TLS:-ON}"
JOBS="${JOBS:-$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)}"

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
OUTPUT_BINARY="$INSTALL_DIR/libxmrig.so"

command -v git >/dev/null || { echo "git is required." >&2; exit 1; }
command -v cmake >/dev/null || { echo "cmake is required." >&2; exit 1; }
command -v ninja >/dev/null || { echo "ninja is required." >&2; exit 1; }

mkdir -p "$SRC_DIR" "$BUILD_DIR" "$PREFIX_DIR" "$INSTALL_DIR"

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
  if [[ "$ANDROID_PLATFORM" =~ android-([0-9]+) ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo "29"
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

build_openssl() {
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

  (
    cd "$source_dir"
    export ANDROID_NDK_ROOT="$NDK_DIR"
    export ANDROID_NDK_HOME="$NDK_DIR"
    export PATH="$llvm_bin:$PATH"

    if [[ -f Makefile ]]; then
      make clean || true
    fi

    perl Configure "$target" no-shared no-tests no-unit-test no-apps \
      "--prefix=$prefix" \
      "--openssldir=$prefix/ssl" \
      "-D__ANDROID_API__=$api_level"
    make -j "$JOBS"
    make install_sw
  )
}

echo "==> Android SDK: $ANDROID_SDK"
echo "==> Android NDK: $NDK_DIR"
echo "==> ABI: $ABI"
echo "==> Android platform: $ANDROID_PLATFORM"

echo "==> Fetching libuv ($LIBUV_REF)"
clone_or_update "https://github.com/libuv/libuv.git" "$LIBUV_REF" "$SRC_DIR/libuv"

echo "==> Building libuv"
rm -rf "$BUILD_DIR/libuv-$ABI"
cmake -G Ninja -S "$SRC_DIR/libuv" -B "$BUILD_DIR/libuv-$ABI" \
  -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN" \
  -DANDROID_ABI="$ABI" \
  -DANDROID_PLATFORM="$ANDROID_PLATFORM" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$PREFIX_DIR/libuv-$ABI" \
  -DBUILD_TESTING=OFF \
  -DLIBUV_BUILD_TESTS=OFF
cmake --build "$BUILD_DIR/libuv-$ABI" --target install --parallel "$JOBS"

UV_INCLUDE="$PREFIX_DIR/libuv-$ABI/include"
UV_LIBRARY="$(find "$PREFIX_DIR/libuv-$ABI" -name 'libuv*.a' | head -n 1)"
if [[ -z "$UV_LIBRARY" ]]; then
  echo "Could not find built libuv static library." >&2
  exit 1
fi

OPENSSL_CMAKE_ARGS=()
if [[ "$WITH_TLS" == "ON" ]]; then
  OPENSSL_TARGET="$(openssl_android_target)"
  ANDROID_API="$(android_api_level)"

  echo "==> Fetching OpenSSL ($OPENSSL_REF)"
  clone_or_update "https://github.com/openssl/openssl.git" "$OPENSSL_REF" "$SRC_DIR/openssl"

  echo "==> Building OpenSSL ($OPENSSL_TARGET, API $ANDROID_API)"
  build_openssl "$SRC_DIR/openssl" "$PREFIX_DIR/openssl-$ABI" "$OPENSSL_TARGET" "$ANDROID_API"

  OPENSSL_CMAKE_ARGS=(
    "-DOPENSSL_ROOT_DIR=$PREFIX_DIR/openssl-$ABI"
    "-DOPENSSL_USE_STATIC_LIBS=TRUE"
    "-DOPENSSL_INCLUDE_DIR=$PREFIX_DIR/openssl-$ABI/include"
    "-DOPENSSL_SSL_LIBRARY=$PREFIX_DIR/openssl-$ABI/lib/libssl.a"
    "-DOPENSSL_CRYPTO_LIBRARY=$PREFIX_DIR/openssl-$ABI/lib/libcrypto.a"
  )
else
  echo "==> Skipping OpenSSL because WITH_TLS=$WITH_TLS"
fi

echo "==> Fetching XMRig ($XMRIG_REF)"
clone_or_update "https://github.com/xmrig/xmrig.git" "$XMRIG_REF" "$SRC_DIR/xmrig"

echo "==> Preparing XMRig Android CMake patch"
if grep -q "pthread rt dl log" "$SRC_DIR/xmrig/CMakeLists.txt"; then
  perl -0pi -e 's/pthread rt dl log/dl/g' "$SRC_DIR/xmrig/CMakeLists.txt"
fi
perl -0pi -e 's/if \(WIN32\)/if (WIN32 AND NOT ANDROID)/g' "$SRC_DIR/xmrig/CMakeLists.txt"
perl -0pi -e 's/NOT CMAKE_GENERATOR STREQUAL Xcode\)/NOT CMAKE_GENERATOR STREQUAL Xcode AND NOT ANDROID)/g' "$SRC_DIR/xmrig/CMakeLists.txt"

echo "==> Building XMRig (TLS=$WITH_TLS, hwloc disabled)"
rm -rf "$BUILD_DIR/xmrig-$ABI"
cmake -G Ninja -S "$SRC_DIR/xmrig" -B "$BUILD_DIR/xmrig-$ABI" \
  -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN" \
  -DANDROID_ABI="$ABI" \
  -DANDROID_PLATFORM="$ANDROID_PLATFORM" \
  -DCMAKE_BUILD_TYPE=Release \
  -DWITH_TLS="$WITH_TLS" \
  -DWITH_HTTPD=OFF \
  -DWITH_HWLOC=OFF \
  -DWITH_OPENCL=OFF \
  -DWITH_CUDA=OFF \
  -DBUILD_STATIC=OFF \
  -DUV_INCLUDE_DIR="$UV_INCLUDE" \
  -DUV_LIBRARY="$UV_LIBRARY" \
  "${OPENSSL_CMAKE_ARGS[@]}"
cmake --build "$BUILD_DIR/xmrig-$ABI" --parallel "$JOBS"

BUILT_XMRIG="$(find "$BUILD_DIR/xmrig-$ABI" -type f \( -name xmrig -o -name xmrig-notls \) -perm -111 | head -n 1)"
if [[ -z "$BUILT_XMRIG" ]]; then
  echo "XMRig build finished, but the xmrig executable was not found." >&2
  exit 1
fi

cp "$BUILT_XMRIG" "$OUTPUT_BINARY"
chmod 755 "$OUTPUT_BINARY"

echo "==> Installed Android miner:"
echo "    $OUTPUT_BINARY"
echo
echo "Next:"
echo "  cd \"$ROOT_DIR\""
echo "  npm run android:sync"
echo "  cd android && ./gradlew assembleDebug"
