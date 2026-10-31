package com.androminer.dashboard;

import static org.junit.Assert.*;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.Test;

public class MiningGuardServiceTest {
    @Test
    public void watchdogRunsAfterActivityMovesToBackground() throws Exception {
        android.app.Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        Context context = instrumentation.getTargetContext();
        assertEquals("com.androminer.validation", context.getPackageName());
        Activity activity =
                instrumentation.startActivitySync(
                        new Intent(context, MainActivity.class)
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        CountDownLatch stopped = new CountDownLatch(1);
        try {
            MiningGuardService.begin(
                    context,
                    new MiningGuardService.Session() {
                        public String check() {
                            return "Session duration limit reached.";
                        }

                        public String label() {
                            return "Connecting / waiting for work";
                        }

                        public void stop(String reason) {
                            if (reason.equals("Session duration limit reached."))
                                stopped.countDown();
                            MiningGuardService.end(context);
                        }
                    });
            instrumentation.runOnMainSync(() -> activity.moveTaskToBack(true));
            assertTrue(
                    "Native watchdog must run with no visible WebView",
                    stopped.await(8, TimeUnit.SECONDS));
        } finally {
            MiningGuardService.end(context);
            instrumentation.runOnMainSync(activity::finish);
        }
    }
}
