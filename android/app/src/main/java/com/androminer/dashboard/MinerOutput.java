package com.androminer.dashboard;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Parses only the current speed, never an older window when the current one is n/a. */
final class MinerOutput {
    private static final Pattern SPEED =
            Pattern.compile(
                    "\\bspeed\\s+(?:10s/60s/15m\\s+)?([0-9]+(?:\\.[0-9]+)?|n/a)(?:\\s+[0-9.n/a]+){0,2}\\s+([kKmM]?H/s)",
                    Pattern.CASE_INSENSITIVE);

    static String clean(String line) {
        return line.replaceAll("\\x1B\\[[0-9;]*[a-zA-Z]", "");
    }

    static Double currentSpeed(String line) {
        Matcher match = SPEED.matcher(clean(line));
        if (!match.find() || "n/a".equalsIgnoreCase(match.group(1))) return null;
        double scale =
                match.group(2).equalsIgnoreCase("MH/s")
                        ? 1000000
                        : match.group(2).equalsIgnoreCase("kH/s") ? 1000 : 1;
        double speed = Double.parseDouble(match.group(1)) * scale;
        return Double.isFinite(speed) ? speed : null;
    }
}
