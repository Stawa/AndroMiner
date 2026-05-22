package com.androminer.dashboard;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MiningNotification")
public class MiningNotificationPlugin extends Plugin {
  private static final String CHANNEL_ID = "androminer_mining_status";
  private static final int MINING_NOTIFICATION_ID = 2001;

  @PluginMethod
  public void show(PluginCall call) {
    if (!canPostNotifications()) {
      call.resolve();
      return;
    }

    createChannel();

    String title = call.getString("title", "AndroMiner");
    String body = call.getString("body", "Mining session is active");

    NotificationCompat.Builder builder =
        new NotificationCompat.Builder(getContext(), CHANNEL_ID)
            .setSmallIcon(com.androminer.dashboard.R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setOngoing(true)
            .setSilent(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW);

    NotificationManagerCompat.from(getContext()).notify(MINING_NOTIFICATION_ID, builder.build());
    call.resolve();
  }

  @PluginMethod
  public void cancel(PluginCall call) {
    NotificationManagerCompat.from(getContext()).cancel(MINING_NOTIFICATION_ID);
    call.resolve();
  }

  private boolean canPostNotifications() {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
        || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED;
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return;
    }

    NotificationChannel channel =
        new NotificationChannel(
            CHANNEL_ID, "Mining status", NotificationManager.IMPORTANCE_LOW);
    channel.setDescription("Shows active AndroMiner mining session status.");

    NotificationManager manager =
        (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
    if (manager != null) {
      manager.createNotificationChannel(channel);
    }
  }
}
