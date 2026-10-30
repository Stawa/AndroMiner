package com.androminer.dashboard;

import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
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
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, window.getDecorView());
        int systemBars =
                WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.navigationBars();

        WindowCompat.setDecorFitsSystemWindows(window, !enabled);
        if (enabled) {
            controller.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            controller.hide(systemBars);
        } else {
            controller.show(systemBars);
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_DEFAULT);
        }
    }
}
