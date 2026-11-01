#!/usr/bin/env bash
# Reproducible on-device RandomX benchmark for an XMRig Android executable.
#
# usage: bench.sh LABEL LOCAL_BINARY THREADS [WINDOW_S=120] [WARM_S=40] [-- extra xmrig args]
#
# Requirements: adb on PATH (or ADB=...), one device in `adb devices`, device unplugged
# (so the battery counter measures discharge). Appends one CSV row to results/results.csv.
#
# The miner log is written with --log-file: XMRig prints nothing to a redirected stdout.
#
# What is measured (all via the unprivileged shell user):
#   hashrate_avg   mean of the 10 s xmrig speed samples inside the measurement window
#   init_ms        RandomX dataset initialisation time reported by xmrig
#   rss_mb         peak resident set size (VmHWM) of the miner process
#   cpu_cores      average busy cores = (utime+stime delta) / window
#   charge_uah     battery charge-counter delta across the window. COARSE: this device
#                  updates the counter in ~27 mAh steps (~90 s of mining), so treat
#                  energy/efficiency as an estimate unless the window is >= 15 minutes.
set -euo pipefail
export MSYS_NO_PATHCONV=1

LABEL="${1:?label}"; BIN="${2:?local binary}"; THREADS="${3:?threads}"
WINDOW="${4:-120}"; WARM="${5:-40}"
shift $(( $# < 5 ? $# : 5 )) || true
[[ "${1:-}" == "--" ]] && shift
EXTRA=("$@")

ADB="${ADB:-adb}"
COOL_MAX="${COOL_MAX:-340}"   # battery temperature in 0.1 C before a run may start
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/results"; mkdir -p "$OUT"
REMOTE=/data/local/tmp
NAME="xmrig_$LABEL"

batt() { "$ADB" shell dumpsys battery | tr -d '\r' | awk '
  /Charge counter:/ {c=$3} /^  voltage:/ {v=$2} /^  temperature:/ {t=$2} /^  level:/ {l=$2}
  END {print c, v, t, l}'; }

# Windows adb needs native paths (MSYS_NO_PATHCONV stops Git Bash converting them).
NATIVE_BIN="$BIN"; command -v cygpath >/dev/null 2>&1 && NATIVE_BIN="$(cygpath -m "$BIN")"
"$ADB" push "$NATIVE_BIN" "$REMOTE/$NAME" >/dev/null
"$ADB" shell "chmod 755 $REMOTE/$NAME"

# Cool down so every run starts from a comparable thermal state.
for _ in $(seq 1 120); do
  read -r _ _ T _ <<<"$(batt)"
  (( T <= COOL_MAX )) && break
  sleep 5
done
read -r C0 V0 T0 L0 <<<"$(batt)"

"$ADB" shell "cd $REMOTE && rm -f $NAME.log && (nohup ./$NAME --bench=1M --threads=$THREADS \
  --print-time=10 --no-color --donate-level=0 --log-file=$REMOTE/$NAME.log ${EXTRA[*]:-} </dev/null >/dev/null 2>&1 &)"

INIT_MS=""
for _ in $(seq 1 120); do
  INIT_MS="$("$ADB" shell "sed -n 's/.*dataset ready (\([0-9]*\) ms).*/\1/p' $REMOTE/$NAME.log" | tr -d '\r')"
  [[ -n "$INIT_MS" ]] && break
  sleep 3
done
[[ -n "$INIT_MS" ]] || { echo "dataset never became ready" >&2; "$ADB" shell "killall $NAME" || true; exit 1; }

PID="$("$ADB" shell "pidof $NAME" | tr -d '\r' | awk '{print $1}')"
sleep "$WARM"
read -r C1 V1 T1 _ <<<"$(batt)"
TICKS1="$("$ADB" shell "awk '{print \$14+\$15}' /proc/$PID/stat" | tr -d '\r')"
cpustat() { "$ADB" shell "grep '^cpu[0-9]' /proc/stat" | tr -d '\r'; }
STAT1="$(cpustat)"
START="$(date +%s)"
sleep $(( WINDOW / 2 ))
FREQS="$("$ADB" shell 'for f in /sys/devices/system/cpu/cpu[0-9]*/cpufreq/scaling_cur_freq; do cat $f; done' | tr -d '\r' | paste -sd ';')"
sleep $(( WINDOW - WINDOW / 2 ))
read -r C2 V2 T2 L2 <<<"$(batt)"
TICKS2="$("$ADB" shell "awk '{print \$14+\$15}' /proc/$PID/stat" | tr -d '\r')"
STAT2="$(cpustat)"
ELAPSED=$(( $(date +%s) - START ))
# Per-core busy % over the window: (user+nice+system+irq+softirq) delta / total delta.
UTIL="$(paste -d' ' <(echo "$STAT1") <(echo "$STAT2") | awk '{
  b1=$2+$3+$4+$7+$8; t1=b1+$5+$6; b2=$13+$14+$15+$18+$19; t2=b2+$16+$17;
  printf "%s%.0f", (NR>1 ? ";" : ""), (t2>t1 ? 100*(b2-b1)/(t2-t1) : 0)}')"
RSS_KB="$("$ADB" shell "awk '/VmHWM/ {print \$2}' /proc/$PID/status" | tr -d '\r')"
"$ADB" shell "killall $NAME" >/dev/null 2>&1 || true
# Windows adb needs a native path (MSYS_NO_PATHCONV stops Git Bash converting it).
NATIVE_OUT="$OUT"; command -v cygpath >/dev/null 2>&1 && NATIVE_OUT="$(cygpath -m "$OUT")"
"$ADB" pull "$REMOTE/$NAME.log" "$NATIVE_OUT/$LABEL-t$THREADS.log" >/dev/null

SAMPLES=$(( WINDOW / 10 ))
# Mean, standard deviation, median and coefficient of variation of the window's 10 s samples. A run
# whose samples vary by more than 10% is flagged "unstable" (throttling, or the phone doing other
# work) and must not be used for comparisons.
HASH="$(sed -n 's/.*speed 10s\/60s\/15m \([0-9.]*\) .*/\1/p' "$OUT/$LABEL-t$THREADS.log" | tail -n "$SAMPLES" | sort -n |
  awk '{v[NR]=$1; s+=$1; ss+=$1*$1} END {n=NR; m=s/n; sd=sqrt(ss/n-m*m); med=(n%2 ? v[(n+1)/2] : (v[n/2]+v[n/2+1])/2);
    printf "%.2f %.2f %.2f %.1f %s", m, sd, med, (m>0 ? 100*sd/m : 0), ((m>0 && sd/m<=0.10) ? "ok" : "unstable")}')"
read -r H_MEAN H_SD H_MED H_CV H_QUALITY <<<"$HASH"
CORES="$(awk -v a="$TICKS1" -v b="$TICKS2" -v w="$ELAPSED" 'BEGIN {printf "%.2f", (b-a)/100/w}')"
DQ=$(( C1 - C2 ))
# energy (J) = dQ[uAh] * 3.6e-3 * V[V];  power (W) = energy / window
read -r JOULES WATTS HPJ <<<"$(awk -v dq="$DQ" -v v1="$V1" -v v2="$V2" -v w="$ELAPSED" -v h="$H_MEAN" '
  BEGIN {v=(v1+v2)/2/1000; e=dq*3.6e-3*v; p=e/w; printf "%.0f %.2f %.2f", e, p, (p>0 ? h/p : 0)}')"

[[ -f "$OUT/results.csv" ]] || echo "label,threads,window_s,init_ms,hashrate_avg,hashrate_sd,hashrate_median,cv_pct,quality,rss_mb,cpu_cores,charge_uah,joules_coarse,watts_coarse,h_per_w_coarse,temp_start,temp_end,batt_level_start,batt_level_end,per_core_util_pct,freqs_mid_khz" >"$OUT/results.csv"
echo "$LABEL,$THREADS,$ELAPSED,$INIT_MS,$H_MEAN,$H_SD,$H_MED,$H_CV,$H_QUALITY,$(( RSS_KB / 1024 )),$CORES,$DQ,$JOULES,$WATTS,$HPJ,$T1,$T2,$L0,$L2,$UTIL,$FREQS" | tee -a "$OUT/results.csv"
