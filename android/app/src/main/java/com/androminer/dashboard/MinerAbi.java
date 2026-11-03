package com.androminer.dashboard;

import java.util.Locale;

/** Which bundled/downloaded miner ABI this device runs, and what the 32-bit build requires. */
final class MinerAbi {
    static final String ARM64 = "arm64-v8a";
    static final String ARM32 = "armeabi-v7a";

    private MinerAbi() {}

    /** First device ABI the app ships a miner for, or null on x86 and other unsupported devices. */
    static String select(String[] deviceAbis) {
        if (deviceAbis == null) return null;
        for (String abi : deviceAbis) if (ARM64.equals(abi) || ARM32.equals(abi)) return abi;
        return null;
    }

    /**
     * The armeabi-v7a miner is built with -mfpu=neon and has no scalar fallback, so a CPU without
     * NEON would die with SIGILL. 64-bit kernels report 32-bit tasks "neon" or "asimd".
     */
    static boolean cpuInfoHasNeon(String cpuInfo) {
        if (cpuInfo == null) return false;
        for (String line : cpuInfo.split("\n")) {
            String lower = line.toLowerCase(Locale.ROOT);
            if (!lower.startsWith("features")) continue;
            int colon = lower.indexOf(':');
            if (colon < 0) continue;
            for (String feature : lower.substring(colon + 1).trim().split("\s+"))
                if (feature.equals("neon") || feature.equals("asimd")) return true;
        }
        return false;
    }
}
