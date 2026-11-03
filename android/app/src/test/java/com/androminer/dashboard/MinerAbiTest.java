package com.androminer.dashboard;

import static org.junit.Assert.*;

import org.junit.Test;

public class MinerAbiTest {
    @Test
    public void selectsFirstSupportedDeviceAbi() {
        assertEquals("arm64-v8a", MinerAbi.select(new String[] {"arm64-v8a", "armeabi-v7a"}));
        assertEquals("armeabi-v7a", MinerAbi.select(new String[] {"armeabi-v7a", "armeabi"}));
        assertEquals("armeabi-v7a", MinerAbi.select(new String[] {"x86", "armeabi-v7a"}));
        assertNull(MinerAbi.select(new String[] {"x86_64", "x86"}));
        assertNull(MinerAbi.select(null));
    }

    @Test
    public void detectsNeonFromCpuFeatures() {
        assertTrue(
                MinerAbi.cpuInfoHasNeon(
                        "Processor\t: ARMv7\nFeatures\t: half thumb fastmult vfp neon vfpv3\n"));
        assertTrue(MinerAbi.cpuInfoHasNeon("Features : fp asimd evtstrm aes"));
        assertFalse(MinerAbi.cpuInfoHasNeon("Features\t: half thumb fastmult vfp edsp vfpv3 tls\n"));
        assertFalse(MinerAbi.cpuInfoHasNeon("model name : neonlike"));
        assertFalse(MinerAbi.cpuInfoHasNeon(""));
        assertFalse(MinerAbi.cpuInfoHasNeon(null));
    }

    @Test
    public void downloadsAreApprovedOnlyForArm64() {
        assertTrue(MinerIntegrity.hasApprovedDownload("arm64-v8a"));
        assertFalse(MinerIntegrity.hasApprovedDownload("armeabi-v7a"));
        assertFalse(MinerIntegrity.hasApprovedDownload(null));
        assertThrows(
                IllegalArgumentException.class,
                () -> MinerIntegrity.expectedHash("armeabi-v7a", "tls"));
        assertEquals(64, MinerIntegrity.expectedHash("arm64-v8a", "tls").length());
    }
}
