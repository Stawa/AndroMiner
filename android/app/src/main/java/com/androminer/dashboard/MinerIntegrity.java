package com.androminer.dashboard;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/** Trust roots are shipped inside the signed APK, never downloaded alongside the executable. */
final class MinerIntegrity {
    static final String REVISION = "795a6861630a26064aa68a334a713dda4e7de608";
    static final long MAX_BYTES = 64L * 1024 * 1024;

    static String expectedHash(String variant) {
        if ("tls".equals(variant))
            return "a7020df77da43412d1da15df718c1295a69014edfc4533a502f0f2ca7872733e";
        if ("notls".equals(variant))
            return "8f46e1d83a224d4a9d8cb4d2005198b5efd60feb942afef590381800f2e808da";
        throw new IllegalArgumentException("Unknown miner variant.");
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
