package com.androminer.dashboard;

import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ImmersiveMode")
public class ImmersiveModePlugin extends Plugin {

    @PluginMethod
    public void enter(PluginCall call) {
        setImmersiveMode(call, true);
    }

    @PluginMethod
    public void exit(PluginCall call) {
        setImmersiveMode(call, false);
    }

    private void setImmersiveMode(PluginCall call, boolean enabled) {
        if (getActivity() == null) {
            call.reject("Android activity is unavailable.");
            return;
        }

        getActivity()
                .runOnUiThread(
                        () -> {
                            applyImmersiveMode(enabled);

                            JSObject result = new JSObject();
                            result.put("active", enabled);
                            call.resolve(result);
                        });
    }

    private void applyImmersiveMode(boolean enabled) {
        Window window = getActivity().getWindow();
        View decorView = window.getDecorView();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = decorView.getWindowInsetsController();
            if (controller != null) {
                int systemBars = WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars();

                if (enabled) {
                    controller.hide(systemBars);
                    controller.setSystemBarsBehavior(
                            WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                } else {
                    controller.show(systemBars);
                }
            }
        }

        if (enabled) {
            decorView.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
            return;
        }

        decorView.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }
}
