// Computes one RandomX (rx/0) hash through XMRig's own interpreter + light-mode cache and prints it.
// Linked against the objects of an XMRig build (see validate-armv7-qemu.sh), so the exact code paths
// of that build are exercised. Software AES, no JIT: the configuration used on armeabi-v7a.
//
// Published RandomX test vector (RandomX tests.cpp, light mode):
//   key "test key 000", input "This is a test"
//   -> 639183aae1bf4c9a35884cb46b09cad9175f04efd7684e7262a0ac1c2f0b4e3f
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>

#include "crypto/randomx/randomx.h"

int main()
{
    randomx_apply_config(RandomX_MoneroConfig);

    void *cacheMemory = nullptr;
    if (posix_memalign(&cacheMemory, 4096, static_cast<size_t>(RandomX_CurrentConfig.ArgonMemory) * 1024) != 0) {
        std::fprintf(stderr, "cache memory allocation failed\n");
        return 2;
    }
    randomx_cache *cache = randomx_create_cache(RANDOMX_FLAG_DEFAULT, static_cast<uint8_t *>(cacheMemory));
    if (!cache) {
        std::fprintf(stderr, "cache allocation failed\n");
        return 2;
    }
    const char key[] = "test key 000";
    randomx_init_cache(cache, key, std::strlen(key));

    void *scratchpad = nullptr;
    if (posix_memalign(&scratchpad, 4096, RandomX_CurrentConfig.ScratchpadL3_Size + 64) != 0) {
        std::fprintf(stderr, "scratchpad allocation failed\n");
        return 2;
    }

    randomx_vm *vm = randomx_create_vm(RANDOMX_FLAG_DEFAULT, cache, nullptr, static_cast<uint8_t *>(scratchpad), 0);
    if (!vm) {
        std::fprintf(stderr, "vm creation failed\n");
        return 2;
    }

    const char input[] = "This is a test";
    uint8_t hash[32];
    randomx_calculate_hash(vm, input, std::strlen(input), hash);

    for (uint8_t b : hash) {
        std::printf("%02x", b);
    }
    std::printf("\n");
    return 0;
}
