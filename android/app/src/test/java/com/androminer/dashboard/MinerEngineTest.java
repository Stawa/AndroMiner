package com.androminer.dashboard;

import static org.junit.Assert.*;

import java.util.HashSet;
import java.util.Set;
import org.junit.Test;

public class MinerEngineTest {
    @Test
    public void everyEngineHasItsOwnIdAndLibrary() {
        Set<String> ids = new HashSet<>();
        Set<String> libraries = new HashSet<>();
        for (MinerEngine engine : MinerEngine.all()) {
            assertTrue("duplicate id " + engine.id, ids.add(engine.id));
            if (engine.launchable())
                assertTrue("shared library " + engine.libraryName, libraries.add(engine.libraryName));
        }
        assertEquals(MinerEngine.libraryNames().size(), libraries.size());
    }

    @Test
    public void xmrigStaysTheDefaultAndKeepsItsFileName() {
        assertEquals(MinerEngine.XMRIG, MinerEngine.byId(null).id);
        assertEquals("libxmrig.so", MinerEngine.byId(MinerEngine.XMRIG).libraryName);
        assertEquals(MinerEngine.Status.SUPPORTED, MinerEngine.byId(MinerEngine.XMRIG).status);
        assertNull(MinerEngine.byId("not-an-engine"));
    }

    @Test
    public void newEnginesAreExperimentalUntilValidatedOnADevice() {
        for (String id : new String[] {MinerEngine.XMRIGCC, MinerEngine.XLARIG})
            assertEquals(MinerEngine.Status.EXPERIMENTAL, MinerEngine.byId(id).status);
    }

    @Test
    public void onlyAbisThatWereActuallyBuiltAreClaimed() {
        for (MinerEngine engine : MinerEngine.all()) {
            if (!engine.launchable()) continue;
            assertTrue(engine.id, engine.supportsAbi(MinerAbi.ARM64));
            assertTrue(engine.id, engine.supportsAbi(MinerAbi.ARM32));
            assertFalse(engine.supportsAbi(null));
            assertFalse(engine.supportsAbi("x86_64"));
            assertNotNull(engine.problem("x86_64", engine.algorithms.get(0)));
        }
    }

    @Test
    public void algorithmsAreNotInterchangeableBetweenEngines() {
        MinerEngine xlarig = MinerEngine.byId(MinerEngine.XLARIG);
        MinerEngine xmrig = MinerEngine.byId(MinerEngine.XMRIG);
        assertNull(xlarig.problem(MinerAbi.ARM64, "panthera"));
        assertNotNull(xlarig.problem(MinerAbi.ARM64, "rx/0"));
        assertNotNull(xmrig.problem(MinerAbi.ARM64, "panthera"));
        assertNotNull(xmrig.problem(MinerAbi.ARM64, "rx/arq"));
        assertNull(MinerEngine.byId(MinerEngine.XMRIGCC).problem(MinerAbi.ARM64, "rx/0"));
        assertNotNull(MinerEngine.byId(MinerEngine.XMRIGCC).problem(MinerAbi.ARM64, "panthera"));
    }

    @Test
    public void onlyLaunchableEnginesAreDownloadable() {
        for (MinerEngine engine : MinerEngine.all())
            if (engine.downloadable) assertTrue(engine.id, engine.launchable());
    }

    @Test
    public void downloadsStayOffUntilHashesAreActuallyPinned() {
        String revision = "0123456789abcdef0123456789abcdef01234567";
        String hash = "a".repeat(64);
        java.util.Map<String, String> both = new java.util.HashMap<>();
        both.put("xmrigcc/arm64-v8a/tls", hash);
        both.put("xmrigcc/arm64-v8a/notls", hash);
        assertTrue(MinerIntegrity.approved(revision, both, "xmrigcc", MinerAbi.ARM64));

        java.util.Map<String, String> oneVariant = new java.util.HashMap<>(both);
        oneVariant.remove("xmrigcc/arm64-v8a/notls");
        assertFalse(MinerIntegrity.approved(revision, oneVariant, "xmrigcc", MinerAbi.ARM64));
        assertFalse(MinerIntegrity.approved("", both, "xmrigcc", MinerAbi.ARM64));
        assertFalse(MinerIntegrity.approved("not-a-commit", both, "xmrigcc", MinerAbi.ARM64));
        assertFalse(MinerIntegrity.approved(revision, both, "xmrigcc", MinerAbi.ARM32));
        assertFalse(MinerIntegrity.approved(revision, both, "xlarig", MinerAbi.ARM64));
        both.put("xmrigcc/arm64-v8a/tls", "not-a-hash");
        assertFalse(MinerIntegrity.approved(revision, both, "xmrigcc", MinerAbi.ARM64));
    }

    @Test
    public void shippedPinsAreEitherCompleteOrAbsent() {
        for (String id : new String[] {MinerEngine.XMRIGCC, MinerEngine.XLARIG}) {
            if (MinerIntegrity.hasApprovedDownload(id, MinerAbi.ARM64)) {
                assertEquals(40, MinerIntegrity.revision(id).length());
                for (String variant : new String[] {"tls", "notls"})
                    assertEquals(64, MinerIntegrity.expectedHash(id, MinerAbi.ARM64, variant).length());
            } else {
                assertThrows(
                        IllegalArgumentException.class,
                        () -> MinerIntegrity.expectedHash(id, MinerAbi.ARM64, "tls"));
            }
        }
        assertTrue(MinerIntegrity.hasApprovedDownload(MinerEngine.XMRIG, MinerAbi.ARM64));
        assertEquals(MinerIntegrity.REVISION, MinerIntegrity.revision(MinerEngine.XMRIG));
    }

    @Test
    public void orphanDetectionRecognisesEveryEngineExecutable() {
        String marker = "--api-id=androminer-android";
        for (String library : MinerEngine.libraryNames())
            assertTrue(
                    OwnedMinerProcess.matches(
                            "/app/" + library + "\u0000" + marker + "\u0000",
                            "/app/libxmrig.so",
                            "/app/" + library));
        assertFalse(
                OwnedMinerProcess.matches(
                        "/other/libxlarig.so\u0000" + marker + "\u0000", "/app/libxlarig.so"));
    }
}
