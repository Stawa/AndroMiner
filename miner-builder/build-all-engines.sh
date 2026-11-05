#!/usr/bin/env bash
# Builds every engine for every supported ABI and installs them into android/app/src/main/jniLibs,
# so a bundled APK built afterwards carries all of them.
#
#   WITH_TLS=ON  miner-builder/build-all-engines.sh     # for the TLS APK
#   WITH_TLS=OFF miner-builder/build-all-engines.sh     # for the no-TLS APK
#
# TLS and no-TLS builds of one engine share a destination file, so run one variant, build the APK,
# then run the other.
set -euo pipefail

builder="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/build-xmrig-android.sh"
export WITH_TLS="${WITH_TLS:-ON}"
export QUIET="${QUIET:-ON}"

for engine in xmrig xmrigcc xlarig; do
  for abi in arm64-v8a armeabi-v7a; do
    echo "=== $engine $abi (TLS=$WITH_TLS)"
    # XMRig keeps its default (unstripped arm64) so its output matches the published builds.
    release=1; [[ "$engine" == xmrig ]] && release=""
    ENGINE="$engine" ABI="$abi" RELEASE_BUILD="$release" bash "$builder"
  done
done

echo "Installed engine libraries:"
ls -l "$(dirname "$builder")/../android/app/src/main/jniLibs"/*/*.so
