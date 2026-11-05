#!/usr/bin/env bash
# Validates one engine binary on a real, adb-connected Android device and prints the evidence an
# engine needs before it can move from Experimental to Supported. Nothing here is simulated.
#
#   miner-builder/validate-engine-device.sh ENGINE LIBRARY [SECONDS]
#
#   ENGINE    xmrig | xmrigcc | xlarig
#   LIBRARY   path to the built libxmrig.so / libxmrigcc.so / libxlarig.so
#   SECONDS   run length for the stability sample (default 300)
#
# Environment:
#   ADB_SERIAL   device serial when more than one is attached
#   POOL, WALLET pool host:port and wallet. Required to prove connection, wallet authentication and
#                accepted shares; without them only load, version and (where supported) benchmark run.
#   ALGO         algorithm (default rx/0, panthera for xlarig)
#   TLS          set to 1 to connect with --tls
#   THREADS      thread count (default: half the cores)
set -euo pipefail

engine="${1:?Usage: validate-engine-device.sh ENGINE LIBRARY [SECONDS]}"
library="${2:?LIBRARY is required}"
duration="${3:-300}"
case "$engine" in
  xmrig) algo_default="rx/0" ;;
  xmrigcc) algo_default="rx/0" ;;
  xlarig) algo_default="panthera" ;;
  *) echo "Unknown engine: $engine" >&2; exit 1 ;;
esac
ALGO="${ALGO:-$algo_default}"
adb_cmd=(adb)
[[ -n "${ADB_SERIAL:-}" ]] && adb_cmd+=(-s "$ADB_SERIAL")
sh() { "${adb_cmd[@]}" shell "$@" | tr -d '\r'; }

[[ -f "$library" ]] || { echo "Library not found: $library" >&2; exit 1; }
"${adb_cmd[@]}" get-state >/dev/null || { echo "No adb device attached." >&2; exit 1; }

remote="/data/local/tmp/androminer-validate-$engine"
local_sha="$(sha256sum "$library" | cut -d' ' -f1)"
"${adb_cmd[@]}" push "$library" "$remote" >/dev/null
sh chmod 755 "$remote"
remote_sha="$(sh sha256sum "$remote" | cut -d' ' -f1)"
[[ "$local_sha" == "$remote_sha" ]] || { echo "FAIL: pushed file hash differs from the local build." >&2; exit 1; }

cores="$(sh nproc)"
threads="${THREADS:-$(( cores > 1 ? cores / 2 : 1 ))}"
report="validation-$engine-$(date +%Y%m%d-%H%M%S).txt"
exec > >(tee "$report") 2>&1

echo "== Device"
echo "model:        $(sh getprop ro.product.model)"
echo "manufacturer: $(sh getprop ro.product.manufacturer)"
echo "android:      $(sh getprop ro.build.version.release) (API $(sh getprop ro.build.version.sdk))"
echo "abi:          $(sh getprop ro.product.cpu.abi)"
echo "soc:          $(sh getprop ro.soc.model 2>/dev/null || true)"
echo "cores:        $cores"
echo "== Engine"
echo "engine:       $engine"
echo "sha256:       $local_sha"
echo "algorithm:    $ALGO"
echo "threads:      $threads"

echo "== 1. Native load and version"
version="$(sh "$remote" --version 2>&1 | head -n 3 || true)"
echo "$version"
grep -qiE 'XMRig|XLArig' <<< "$version" || { echo "FAIL: binary did not start on this device."; exit 1; }
echo "PASS: executable loads and reports a version"

echo "== 2. Benchmark (only if the engine has one)"
if sh "$remote" --help 2>&1 | grep -q -- '--bench'; then
  sh "$remote" --bench=1M --algo="$ALGO" --threads="$threads" --no-color 2>&1 | tail -n 8 || true
else
  echo "SKIP: $engine has no --bench; hashrate comes from the pool run below"
fi

if [[ -z "${POOL:-}" || -z "${WALLET:-}" ]]; then
  echo "== 3. Pool run"
  echo "SKIP: set POOL and WALLET to verify connection, authentication, shares and stability"
  exit 0
fi

echo "== 3. Pool run for ${duration}s"
tls=""; [[ "${TLS:-0}" == 1 ]] && tls="--tls"
log="/data/local/tmp/androminer-validate-$engine.log"
sh "rm -f $log; $remote --algo=$ALGO --url=$POOL --user=$WALLET --pass=x --threads=$threads \
  --donate-level=0 --no-color --print-time=10 $tls > $log 2>&1 & echo \$! > $log.pid"
pid="$(sh cat "$log.pid")"
start="$(date +%s)"
echo "elapsed_s,cpu_percent,rss_mb,battery_temp_c"
while (( $(date +%s) - start < duration )); do
  sleep 10
  sh "kill -0 $pid" 2>/dev/null || { echo "FAIL: miner exited early"; break; }
  cpu="$(sh top -b -n 1 -p "$pid" 2>/dev/null | awk -v p="$pid" '$1==p {print $9}' | head -n 1)"
  rss="$(sh "awk '/VmRSS/ {print int(\$2/1024)}' /proc/$pid/status" 2>/dev/null)"
  temp="$(sh dumpsys battery | awk '/temperature/ {printf "%.1f", $2/10}')"
  echo "$(( $(date +%s) - start )),${cpu:-?},${rss:-?},${temp:-?}"
done
sh "kill $pid" 2>/dev/null || true
sleep 1

echo "== Results"
sh "cat $log" > "$report.miner.log"
accepted="$(grep -ciE 'accepted' "$report.miner.log" || true)"
rejected="$(grep -ciE 'rejected|incorrect|low difficulty share' "$report.miner.log" || true)"
echo "connected:        $(grep -qiE 'use pool|new job' "$report.miner.log" && echo yes || echo NO)"
echo "authenticated:    $(grep -qiE 'login|use pool' "$report.miner.log" && ! grep -qiE 'unauthorized|invalid (wallet|address)' "$report.miner.log" && echo yes || echo NO)"
echo "accepted shares:  $accepted"
echo "rejected shares:  $rejected"
grep -iE 'speed 10s' "$report.miner.log" | tail -n 5 || true
echo "Full miner log: $report.miner.log"
