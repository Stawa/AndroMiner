package com.androminer.dashboard;

/** Builds the pool login from a wallet and worker name. */
final class PoolLogin {
    private PoolLogin() {}

    /**
     * Pools disagree on how a worker name is attached: most take "wallet.worker", some take
     * "wallet/worker". Only those two separators are accepted; anything else falls back to ".".
     * A wallet that already contains the separator is assumed to carry its worker and is left alone.
     */
    static String user(String wallet, String worker, String separator) {
        String sep = "/".equals(separator) ? "/" : ".";
        if (worker == null || worker.isBlank()) return wallet;
        if (wallet.contains(sep)) return wallet;
        return wallet + sep + worker;
    }
}
