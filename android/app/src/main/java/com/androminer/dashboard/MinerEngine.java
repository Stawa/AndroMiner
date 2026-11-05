package com.androminer.dashboard;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * One mining engine: where its executable lives, what it can mine on which ABI, and how far it has
 * been verified. XMRig, XMRigCC and XLArig share XMRig's command line, stdout format and HTTP API,
 * so one runtime drives all of them; this class carries only what differs between them.
 */
final class MinerEngine {
    enum Status {
        /** Built, verified on Android hardware and downloadable or bundled. */
        SUPPORTED,
        /** Built for Android but not yet validated on a device. Selectable with a warning. */
        EXPERIMENTAL,
        /** Cannot be offered on Android. Listed so the reason is visible; never launched. */
        UNSUPPORTED
    }

    static final String XMRIG = "xmrig";
    static final String XMRIGCC = "xmrigcc";
    static final String XLARIG = "xlarig";

    final String id;
    final String name;
    final Status status;
    /** Native library file name, unique per engine so engines never share a file. */
    final String libraryName;
    final String upstream;
    final String version;
    final String license;
    final List<String> algorithms;
    final List<String> protocols;
    final List<String> abis;
    /** Why the engine is unsupported or limited; empty when there is nothing to disclose. */
    final String note;
    /**
     * Whether this engine can be fetched and hash-checked at all. Whether a download is approved in
     * a given APK also needs pinned hashes: see MinerIntegrity.hasApprovedDownload.
     */
    final boolean downloadable;

    private MinerEngine(
            String id,
            String name,
            Status status,
            String libraryName,
            String upstream,
            String version,
            String license,
            List<String> algorithms,
            List<String> protocols,
            List<String> abis,
            String note,
            boolean downloadable) {
        this.id = id;
        this.name = name;
        this.status = status;
        this.libraryName = libraryName;
        this.upstream = upstream;
        this.version = version;
        this.license = license;
        this.algorithms = algorithms;
        this.protocols = protocols;
        this.abis = abis;
        this.note = note;
        this.downloadable = downloadable;
    }

    private static List<String> list(String... values) {
        return Collections.unmodifiableList(Arrays.asList(values));
    }

    private static final List<String> XMRIG_ALGORITHMS =
            list("rx/0", "rx/wow", "gr", "cn/ccx");

    /** XMRig-family engines share one pool client: plain and TLS stratum, daemon RPC, NiceHash. */
    private static final List<String> XMRIG_PROTOCOLS =
            list("stratum+tcp", "stratum+ssl", "daemon", "nicehash");

    private static final List<MinerEngine> ENGINES =
            Collections.unmodifiableList(
                    Arrays.asList(
                            new MinerEngine(
                                    XMRIG,
                                    "XMRig",
                                    Status.SUPPORTED,
                                    "libxmrig.so",
                                    "https://github.com/xmrig/xmrig",
                                    "6.26.0",
                                    "GPL-3.0",
                                    XMRIG_ALGORITHMS,
                                    XMRIG_PROTOCOLS,
                                    list(MinerAbi.ARM64, MinerAbi.ARM32),
                                    "",
                                    true),
                            new MinerEngine(
                                    XMRIGCC,
                                    "XMRigCC",
                                    Status.EXPERIMENTAL,
                                    "libxmrigcc.so",
                                    "https://github.com/Bendr0id/xmrigCC",
                                    "3.4.9",
                                    "GPL-3.0",
                                    XMRIG_ALGORITHMS,
                                    XMRIG_PROTOCOLS,
                                    list(MinerAbi.ARM64, MinerAbi.ARM32),
                                    "Miner only: the remote-control client, remote shell and server are"
                                            + " not built. Not yet validated on a device.",
                                    true),
                            new MinerEngine(
                                    XLARIG,
                                    "XLArig",
                                    Status.EXPERIMENTAL,
                                    "libxlarig.so",
                                    "https://github.com/scala-network/XLArig",
                                    "5.2.4",
                                    "GPL-3.0",
                                    list("panthera"),
                                    XMRIG_PROTOCOLS,
                                    list(MinerAbi.ARM64, MinerAbi.ARM32),
                                    "XMRig 5.x fork, the only supported way to mine Scala (XLA)."
                                            + " Not yet validated on a device.",
                                    true)));

    static List<MinerEngine> all() {
        return ENGINES;
    }

    static MinerEngine byId(String id) {
        if (id == null) return ENGINES.get(0);
        for (MinerEngine engine : ENGINES) if (engine.id.equals(id)) return engine;
        return null;
    }

    boolean launchable() {
        return status != Status.UNSUPPORTED && !libraryName.isEmpty();
    }

    boolean supportsAbi(String abi) {
        return abi != null && abis.contains(abi);
    }

    boolean supportsAlgorithm(String algorithm) {
        return algorithm != null && algorithms.contains(algorithm);
    }

    /** Why this engine cannot run the algorithm on this ABI, or null when it can. */
    String problem(String abi, String algorithm) {
        if (status == Status.UNSUPPORTED) return name + " is not supported on Android. " + note;
        if (!supportsAbi(abi))
            return name + " is not available for this device's CPU (" + (abi == null ? "unsupported" : abi) + ").";
        if (!supportsAlgorithm(algorithm)) return name + " cannot mine " + algorithm + ".";
        return null;
    }

    /** Library file names of every launchable engine, used to recognise leftover miners. */
    static List<String> libraryNames() {
        java.util.ArrayList<String> names = new java.util.ArrayList<>();
        for (MinerEngine engine : ENGINES) if (engine.launchable()) names.add(engine.libraryName);
        return names;
    }
}
