#!/usr/bin/env bash
# Prints the MinerIntegrity pins for the XMRigCC and XLArig downloads published at a commit of the
# miner-builder branch. It downloads every binary itself and hashes the bytes, instead of trusting
# the branch's SHA256SUMS file, so the pins come from an independent check.
#
#   miner-builder/print-engine-pins.sh COMMIT
#
# Review the commit's workflow run and the binaries first. Then paste the output into
# MinerIntegrity.java: set ENGINE_REVISION and add the put() lines to the static block.
set -euo pipefail

commit="${1:?Usage: print-engine-pins.sh COMMIT (40-character hash of the miner-builder branch)}"
[[ "$commit" =~ ^[0-9a-f]{40}$ ]] || { echo "COMMIT must be a full 40-character hash." >&2; exit 1; }
base="https://raw.githubusercontent.com/Stawa/AndroMiner/$commit"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

echo "    static final String ENGINE_REVISION = \"$commit\";"
echo
for engine in xmrigcc xlarig; do
  for abi in arm64-v8a armeabi-v7a; do
    for variant in tls notls; do
      file="$work/$engine-$abi-$variant.so"
      curl -fsSL --max-redirs 0 "$base/lib/$abi/$variant/lib$engine.so" -o "$file"
      hash="$(sha256sum "$file" | cut -d' ' -f1)"
      printf '        ENGINE_HASHES.put("%s/%s/%s", "%s");\n' "$engine" "$abi" "$variant" "$hash"
    done
  done
done
