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

  git -C "$dir" fetch --depth 1 origin "$ref"
  git -C "$dir" checkout FETCH_HEAD
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

echo "==> Fetching XMRig ($XMRIG_REF)"
clone_or_update "https://github.com/xmrig/xmrig.git" "$XMRIG_REF" "$SRC_DIR/xmrig"

echo "==> Preparing XMRig Android CMake patch"
if grep -q "pthread rt dl log" "$SRC_DIR/xmrig/CMakeLists.txt"; then
  perl -0pi -e 's/pthread rt dl log/dl/g' "$SRC_DIR/xmrig/CMakeLists.txt"
fi
perl -0pi -e 's/if \(WIN32\)/if (WIN32 AND NOT ANDROID)/g' "$SRC_DIR/xmrig/CMakeLists.txt"
perl -0pi -e 's/NOT CMAKE_GENERATOR STREQUAL Xcode\)/NOT CMAKE_GENERATOR STREQUAL Xcode AND NOT ANDROID)/g' "$SRC_DIR/xmrig/CMakeLists.txt"

echo "==> Building XMRig without TLS/hwloc for first Android target"
rm -rf "$BUILD_DIR/xmrig-$ABI"
cmake -G Ninja -S "$SRC_DIR/xmrig" -B "$BUILD_DIR/xmrig-$ABI" \
  -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN" \
  -DANDROID_ABI="$ABI" \
  -DANDROID_PLATFORM="$ANDROID_PLATFORM" \
  -DCMAKE_BUILD_TYPE=Release \
  -DWITH_TLS=OFF \
  -DWITH_HTTPD=OFF \
  -DWITH_HWLOC=OFF \
  -DWITH_OPENCL=OFF \
  -DWITH_CUDA=OFF \
  -DBUILD_STATIC=OFF \
  -DUV_INCLUDE_DIR="$UV_INCLUDE" \
  -DUV_LIBRARY="$UV_LIBRARY"
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
