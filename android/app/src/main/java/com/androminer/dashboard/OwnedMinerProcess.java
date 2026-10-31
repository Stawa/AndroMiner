package com.androminer.dashboard;

import android.content.Context;
import android.os.SystemClock;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

final class OwnedMinerProcess {
    static void stopOrphans(Context context) throws IOException {
        File[] entries = new File("/proc").listFiles();
        if (entries == null)
            throw new IOException(
                    "Cannot check for a previous miner process. Restart the app before mining.");
        String bundled = context.getApplicationInfo().nativeLibraryDir + "/libxmrig.so";
        String downloaded = new File(context.getFilesDir(), "miners/libxmrig.so").getAbsolutePath();
        for (File entry : entries) {
            if (!entry.getName().matches("[0-9]+")) continue;
            int pid;
            try {
                pid = Integer.parseInt(entry.getName());
            } catch (NumberFormatException ignored) {
                continue;
            }
            if (!matches(readCommand(entry), bundled, downloaded)) continue;
            try {
                android.os.Process.killProcess(pid);
            } catch (RuntimeException denied) {
                throw new IOException(
                        "A previous miner could not be stopped. Force stop AndroMiner in Android settings.",
                        denied);
            }
            long deadline = SystemClock.elapsedRealtime() + 1000;
            while (matches(readCommand(entry), bundled, downloaded)
                    && SystemClock.elapsedRealtime() < deadline) SystemClock.sleep(25);
            if (matches(readCommand(entry), bundled, downloaded))
                throw new IOException(
                        "A previous miner is still running. Force stop AndroMiner in Android settings.");
        }
    }

    static boolean matches(String command, String bundled, String downloaded) {
        String[] args = command.split("\u0000");
        if (args.length == 0 || (!args[0].equals(bundled) && !args[0].equals(downloaded)))
            return false;
        for (String arg : args) if (arg.equals("--api-id=androminer-android")) return true;
        return false;
    }

    private static String readCommand(File entry) {
        try (FileInputStream input = new FileInputStream(new File(entry, "cmdline"))) {
            byte[] bytes = new byte[8192];
            int count = input.read(bytes);
            return count <= 0 ? "" : new String(bytes, 0, count, StandardCharsets.UTF_8);
        } catch (IOException inaccessible) {
            return "";
        }
    }
}
