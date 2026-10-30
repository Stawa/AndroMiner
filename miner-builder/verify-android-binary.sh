#!/usr/bin/env bash
set -euo pipefail

binary="${1:?Usage: verify-android-binary.sh BINARY NDK_DIR ABI WITH_TLS}"
ndk_dir="${2:?NDK_DIR is required}"
abi="${3:?ABI is required}"
with_tls="${4:?WITH_TLS is required}"
llvm_bin="$ndk_dir/toolchains/llvm/prebuilt/linux-x86_64/bin"

case "$abi" in
  arm64-v8a) machine=AArch64; interpreter=/system/bin/linker64 ;;
  armeabi-v7a) machine=ARM; interpreter=/system/bin/linker ;;
  x86) machine='Intel 80386'; interpreter=/system/bin/linker ;;
  x86_64) machine='Advanced Micro Devices X86-64'; interpreter=/system/bin/linker64 ;;
  *) echo "Unsupported ABI: $abi" >&2; exit 1 ;;
esac

test -s "$binary"
elf_info="$("$llvm_bin/llvm-readelf" --wide --file-header --program-headers --dynamic "$binary")"
printf '%s\n' "$elf_info"
if ! grep -Eq "Machine: +$machine$" <<< "$elf_info"; then
  echo "Expected an Android $abi executable ($machine)." >&2
  exit 1
fi
if ! grep -Eq 'Type: +DYN ' <<< "$elf_info" ||
   ! grep -Fq "Requesting program interpreter: $interpreter]" <<< "$elf_info"; then
  echo "Expected a PIE executable using $interpreter." >&2
  exit 1
fi

while IFS= read -r dependency; do
  case "$dependency" in
    libc.so|libm.so|libdl.so|liblog.so|libandroid.so) ;;
    *) echo "Unexpected Android runtime dependency: $dependency" >&2; exit 1 ;;
  esac
done < <(sed -n 's/.*(NEEDED).*Shared library: \[\([^]]*\)\].*/\1/p' <<< "$elf_info")

symbols="$("$llvm_bin/llvm-nm" --defined-only --extern-only "$binary")"
if [[ "$with_tls" == ON ]]; then
  for symbol in SSL_do_handshake X509_verify_cert RAND_bytes; do
    if ! grep -Eq " [A-Za-z] $symbol$" <<< "$symbols"; then
      echo "TLS executable is missing the required symbol $symbol." >&2
      exit 1
    fi
  done
elif [[ "$with_tls" == OFF ]]; then
  if grep -Eq ' [A-Za-z] (SSL_|OPENSSL_|X509_)' <<< "$symbols"; then
    echo "The no-TLS binary unexpectedly contains OpenSSL symbols." >&2
    exit 1
  fi
else
  echo "WITH_TLS must be ON or OFF." >&2
  exit 1
fi

echo "Verified $abi Android executable (TLS=$with_tls)."
