package com.androminer.dashboard;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.Map;

/** Trust roots are shipped inside the signed APK, never downloaded alongside the executable. */
final class MinerIntegrity {
    static final String REVISION = "795a6861630a26064aa68a334a713dda4e7de608";
    static final long MAX_BYTES = 64L * 1024 * 1024;

    /** armeabi-v7a has no approved download yet: bundle it in the APK instead. */
    static boolean hasApprovedDownload(String abi) {
        return MinerAbi.ARM64.equals(abi);
    }

    static String expectedHash(String abi, String variant) {
        if (!hasApprovedDownload(abi))
            throw new IllegalArgumentException("No approved miner download for " + abi + ".");
        if ("tls".equals(variant))
            return "a7020df77da43412d1da15df718c1295a69014edfc4533a502f0f2ca7872733e";
        if ("notls".equals(variant))
            return "8f46e1d83a224d4a9d8cb4d2005198b5efd60feb942afef590381800f2e808da";
        throw new IllegalArgumentException("Unknown miner variant.");
    }

    /**
     * Commit of the miner-builder branch that holds the XMRigCC and XLArig builds. Empty until those
     * builds have been published, reviewed and their hashes added below; until then those engines
     * are not downloadable and the app says so.
     */
    static final String ENGINE_REVISION = "";

    /** SHA-256 of each reviewed engine build, keyed "engine/abi/variant". */
    private static final Map<String, String> ENGINE_HASHES = new HashMap<>();

    static {
        /* Paste the lines printed by miner-builder/print-engine-pins.sh here after review. */
    }

    static String revision(String engineId) {
        return MinerEngine.XMRIG.equals(engineId) ? REVISION : ENGINE_REVISION;
    }

    /** A download is approved only for a pinned commit and a pinned hash for both TLS variants. */
    static boolean hasApprovedDownload(String engineId, String abi) {
        if (MinerEngine.XMRIG.equals(engineId)) return hasApprovedDownload(abi);
        return approved(ENGINE_REVISION, ENGINE_HASHES, engineId, abi);
    }

    static boolean approved(
            String revision, Map<String, String> hashes, String engineId, String abi) {
        return abi != null
                && engineId != null
                && revision != null
                && revision.matches("[0-9a-f]{40}")
                && isSha256(hashes.get(pinKey(engineId, abi, "tls")))
                && isSha256(hashes.get(pinKey(engineId, abi, "notls")));
    }

    static String expectedHash(String engineId, String abi, String variant) {
        if (MinerEngine.XMRIG.equals(engineId)) return expectedHash(abi, variant);
        if (!hasApprovedDownload(engineId, abi))
            throw new IllegalArgumentException(
                    "No approved " + engineId + " download for " + abi + ".");
        String hash = ENGINE_HASHES.get(pinKey(engineId, abi, variant));
        if (hash == null) throw new IllegalArgumentException("Unknown miner variant.");
        return hash;
    }

    private static String pinKey(String engineId, String abi, String variant) {
        return engineId + "/" + abi + "/" + variant;
    }

    private static boolean isSha256(String value) {
        return value != null && value.matches("[0-9a-f]{64}");
    }

    static void verify(File binary, String expected) throws IOException {
        if (binary.length() == 0 || binary.length() > MAX_BYTES)
            throw new IOException("Invalid miner size.");
        try (FileInputStream input = new FileInputStream(binary)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int size;
            while ((size = input.read(buffer)) != -1) digest.update(buffer, 0, size);
            StringBuilder actual = new StringBuilder();
            for (byte value : digest.digest())
                actual.append(String.format(java.util.Locale.ROOT, "%02x", value & 0xff));
            if (!actual.toString().equals(expected))
                throw new IOException(
                        "Miner integrity check failed. Download the version approved by this APK.");
        } catch (NoSuchAlgorithmException impossible) {
            throw new IOException("SHA-256 unavailable.", impossible);
        }
    }
}
