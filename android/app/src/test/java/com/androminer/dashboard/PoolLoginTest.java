package com.androminer.dashboard;

import static org.junit.Assert.*;

import org.junit.Test;

public class PoolLoginTest {
    @Test
    public void dotIsTheDefaultSeparator() {
        assertEquals("wallet.rig", PoolLogin.user("wallet", "rig", "."));
        assertEquals("wallet.rig", PoolLogin.user("wallet", "rig", null));
    }

    @Test
    public void slashIsUsedWhenAPoolAsksForIt() {
        assertEquals("wallet/rig", PoolLogin.user("wallet", "rig", "/"));
    }

    @Test
    public void unknownSeparatorsFallBackToDot() {
        assertEquals("wallet.rig", PoolLogin.user("wallet", "rig", ":"));
        assertEquals("wallet.rig", PoolLogin.user("wallet", "rig", "; rm -rf"));
    }

    @Test
    public void aWalletThatAlreadyCarriesAWorkerIsLeftAlone() {
        assertEquals("wallet.mine", PoolLogin.user("wallet.mine", "rig", "."));
        assertEquals("wallet/mine", PoolLogin.user("wallet/mine", "rig", "/"));
    }

    @Test
    public void blankWorkerLeavesTheWalletUntouched() {
        assertEquals("wallet", PoolLogin.user("wallet", "", "/"));
        assertEquals("wallet", PoolLogin.user("wallet", "  ", "."));
        assertEquals("wallet", PoolLogin.user("wallet", null, "."));
    }
}
