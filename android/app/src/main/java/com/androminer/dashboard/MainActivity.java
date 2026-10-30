package com.androminer.dashboard;

import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String PREFS_NAME = "androminer_permissions";
    private static final String BATTERY_OPTIMIZATION_ASKED = "battery_optimization_asked";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceStatusPlugin.class);
        registerPlugin(ImmersiveModePlugin.class);
        registerPlugin(MiningNotificationPlugin.class);
        registerPlugin(NativeMinerPlugin.class);
        super.onCreate(savedInstanceState);
        requestBatteryOptimizationExemptionOnce();
    }

    private void requestBatteryOptimizationExemptionOnce() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return;
        }

        SharedPreferences preferences = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        if (preferences.getBoolean(BATTERY_OPTIMIZATION_ASKED, false)) {
            return;
        }

        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (powerManager == null || powerManager.isIgnoringBatteryOptimizations(getPackageName())) {
            preferences.edit().putBoolean(BATTERY_OPTIMIZATION_ASKED, true).apply();
            return;
        }

        preferences.edit().putBoolean(BATTERY_OPTIMIZATION_ASKED, true).apply();
        Intent intent =
                new Intent(
                        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                        Uri.parse("package:" + getPackageName()));
        startActivity(intent);
    }
}
