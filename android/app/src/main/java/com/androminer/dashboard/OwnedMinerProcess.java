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
        java.util.List<String> executables = new java.util.ArrayList<>();
        for (String library : MinerEngine.libraryNames()) {
            executables.add(context.getApplicationInfo().nativeLibraryDir + "/" + library);
            executables.add(new File(context.getFilesDir(), "miners/" + library).getAbsolutePath());
        }
        String[] allowed = executables.toArray(new String[0]);
        for (File entry : entries) {
            if (!entry.getName().matches("[0-9]+")) continue;
            int pid;
            try {
                pid = Integer.parseInt(entry.getName());
            } catch (NumberFormatException ignored) {
                continue;
            }
            if (!matches(readCommand(entry), allowed)) continue;
            try {
                android.os.Process.killProcess(pid);
            } catch (RuntimeException denied) {
                throw new IOException(
                        "A previous miner could not be stopped. Force stop AndroMiner in Android settings.",
                        denied);
            }
            long deadline = SystemClock.elapsedRealtime() + 1000;
            while (matches(readCommand(entry), allowed)
                    && SystemClock.elapsedRealtime() < deadline) SystemClock.sleep(25);
            if (matches(readCommand(entry), allowed))
                throw new IOException(
                        "A previous miner is still running. Force stop AndroMiner in Android settings.");
        }
    }

    static boolean matches(String command, String... executables) {
        String[] args = command.split("\u0000");
        if (args.length == 0 || !java.util.Arrays.asList(executables).contains(args[0]))
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
