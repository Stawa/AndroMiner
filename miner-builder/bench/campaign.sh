#!/usr/bin/env bash
# Full arm64-v8a benchmark campaign on one attached phone. Every row lands in results/results.csv.
#
#   1. thread scaling      release build at 1,2,3,4,5,6,8 threads
#   2. core placement      4 threads pinned to the performance cores vs the efficiency cores
#   3. build comparison    every build at the best thread count, 3 interleaved rounds
#   4. sustained           5-minute windows, original vs the best build, 2 rounds
#
# usage: ADB=/path/to/adb bash bench/campaign.sh
# The run stops, keeping every finished row, when the phone disconnects, drops below MIN_BATT
# percent, or the battery reaches MAX_TEMP (0.1 C units). Nothing is estimated or back-filled.
set -uo pipefail
export MSYS_NO_PATHCONV=1
DIR="$(cd "$(dirname "$0")" && pwd)"
ADB="${ADB:-adb}"
MIN_BATT="${MIN_BATT:-30}"
MAX_TEMP="${MAX_TEMP:-470}"
export COOL_MAX="${COOL_MAX:-400}"
BUILDS="$DIR/../variants"
ORIGINAL="$DIR/../baseline/libxmrig-original.so"
CSV="$DIR/results/results.csv"

guard() {
  local state level temp
  state="$("$ADB" get-state 2>/dev/null | tr -d '\r')"
  [[ "$state" == device ]] || { echo "STOP: device not connected" >&2; return 1; }
  read -r level temp < <("$ADB" shell dumpsys battery | tr -d '\r' | awk '/^  level:/ {l=$2} /^  temperature:/ {t=$2} END {print l, t}')
  (( level >= MIN_BATT )) || { echo "STOP: battery ${level}% < ${MIN_BATT}%" >&2; return 1; }
  (( temp <= MAX_TEMP )) || { echo "STOP: battery temperature $temp > $MAX_TEMP" >&2; return 1; }
}

run() { guard || exit 3; bash "$DIR/bench.sh" "$@" || echo "run failed: $*" >&2; }

best_threads() { # highest median hashrate among the scaling rows that were stable
  awk -F, '$1 ~ /^scale-/ && $9 == "ok" && $7 > m {m=$7; t=$2} END {print t}' "$CSV"
}

echo "== phase 1: thread scaling"
for t in 1 2 3 4 5 6 8; do run "scale-release" "$BUILDS/release/libxmrig.so" "$t" 120 40; done

echo "== phase 2: core placement (4 threads)"
run "aff-perf4-release" "$BUILDS/release/libxmrig.so" 4 120 40 -- --cpu-affinity=0xF0
run "aff-eff4-release" "$BUILDS/release/libxmrig.so" 4 120 40 -- --cpu-affinity=0x0F

N="$(best_threads)"
echo "== best thread count from scaling: $N"
echo "== phase 3: builds at $N threads"
for round in 1 2 3; do
  run "cmp-original-r$round" "$ORIGINAL" "$N" 120 40
  for v in release O2 thinlto thinlto-O2 tune-a76; do
    run "cmp-$v-r$round" "$BUILDS/$v/libxmrig.so" "$N" 120 40
  done
done

echo "== phase 4: sustained 5-minute windows"
for round in 1 2; do
  run "sustain-original-r$round" "$ORIGINAL" "$N" 300 60
  run "sustain-release-r$round" "$BUILDS/release/libxmrig.so" "$N" 300 60
done
echo "== campaign finished"
