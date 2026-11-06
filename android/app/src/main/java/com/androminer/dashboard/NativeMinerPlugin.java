package com.androminer.dashboard;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
        name = "NativeMiner",
        permissions = {
            @Permission(
                    alias = "notifications",
                    strings = {Manifest.permission.POST_NOTIFICATIONS})
        })
public class NativeMinerPlugin extends Plugin {
    private NativeMiningRuntime runtime;

    @Override
    public void load() {
        runtime = MiningGuardService.runtime(getContext());
        runtime.setProgressListener(progress -> notifyListeners("downloadProgress", progress));
        runtime.setBenchmarkListener(event -> notifyListeners("benchmarkLog", event));
    }

    @Override
    protected void handleOnResume() {
        runtime.setVisible(true);
    }

    @Override
    protected void handleOnPause() {
        runtime.setVisible(false);
    }

    @Override
    protected void handleOnDestroy() {
        runtime.setProgressListener(null);
        runtime.setBenchmarkListener(null);
        super.handleOnDestroy();
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33
                && ContextCompat.checkSelfPermission(
                                getContext(), Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationsResult");
            return;
        }
        runtime.start(call);
    }

    @PermissionCallback
    private void notificationsResult(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED) runtime.start(call);
        else
            call.reject(
                    "Allow notifications in Android settings before mining. The session needs a visible Stop control.");
    }

    @PluginMethod
    public void status(PluginCall call) {
        runtime.status(call);
    }

    @PluginMethod
    public void info(PluginCall call) {
        runtime.info(call);
    }

    @PluginMethod
    public void download(PluginCall call) {
        runtime.download(call);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        runtime.stop(call);
    }

    @PluginMethod
    public void pause(PluginCall call) {
        runtime.pause(call);
    }

    @PluginMethod
    public void updateSafety(PluginCall call) {
        runtime.updateSafety(call);
    }

    @PluginMethod
    public void deleteHistory(PluginCall call) {
        runtime.deleteHistory(call);
    }

    @PluginMethod
    public void benchmark(PluginCall call) {
        runtime.benchmark(call);
    }

    @PluginMethod
    public void cancelBenchmark(PluginCall call) {
        runtime.cancelBenchmark(call);
    }

    @PluginMethod
    public void testPool(PluginCall call) {
        runtime.testPool(call);
    }
}
