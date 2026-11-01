package com.androminer.dashboard;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/** Keeps protection and the emergency stop available when the WebView is suspended. */
public class MiningGuardService extends Service {
    private static NativeMiningRuntime runtime;

    static synchronized NativeMiningRuntime runtime(Context context) {
        if (runtime == null) runtime = new NativeMiningRuntime(context);
        return runtime;
    }

    interface Session {
        String check();

        void stop(String reason);

        String label();
    }

    private static final String CHANNEL = "androminer_session_guard";
    private static final String STOP = "com.androminer.STOP_MINING";
    private static final int ID = 2002;
    private static volatile Session session;
    private static volatile CompletableFuture<Void> ready;
    private static volatile CompletableFuture<Void> ended = CompletableFuture.completedFuture(null);
    private static volatile boolean created;
    private ScheduledExecutorService watchdog;
    private Session owner;
    private boolean watching;
    private NotificationCompat.Builder notification;
    private String lastLabel = "Starting";

    static boolean notificationsEnabled(Context context) {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel =
                    context.getSystemService(NotificationManager.class)
                            .getNotificationChannel(CHANNEL);
            return channel == null
                    || channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
        }
        return true;
    }

    static void begin(Context context, Session owner) throws Exception {
        ended.get(5, TimeUnit.SECONDS);
        session = owner;
        CompletableFuture<Void> started = new CompletableFuture<>();
        ended = new CompletableFuture<>();
        ready = started;
        try {
            ContextCompat.startForegroundService(
                    context, new Intent(context, MiningGuardService.class));
            started.get(5, TimeUnit.SECONDS);
        } catch (Exception failure) {
            end(context);
            if (!created) ended.complete(null);
            throw failure;
        }
    }

    static void end(Context context) {
        session = null;
        context.stopService(new Intent(context, MiningGuardService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        created = true;
        watchdog = Executors.newSingleThreadScheduledExecutor();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || session == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (STOP.equals(intent.getAction())) {
            requestStop("Stopped from the mining notification.");
            return START_NOT_STICKY;
        }
        owner = session;
        try {
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.cancel(2001);
            if (Build.VERSION.SDK_INT >= 26) {
                manager.createNotificationChannel(
                        new NotificationChannel(
                                CHANNEL,
                                "Active mining & protection",
                                NotificationManager.IMPORTANCE_LOW));
            }
            PendingIntent open =
                    PendingIntent.getActivity(
                            this,
                            0,
                            new Intent(this, MainActivity.class),
                            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            PendingIntent stop =
                    PendingIntent.getService(
                            this,
                            1,
                            new Intent(this, MiningGuardService.class).setAction(STOP),
                            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            notification =
                    new NotificationCompat.Builder(this, CHANNEL)
                            .setSmallIcon(R.drawable.ic_mining_notification)
                            .setContentTitle("AndroMiner · Starting")
                            .setContentText(
                                    "CPU mining with native device protection. Tap Stop to end the run.")
                            .setContentIntent(open)
                            .setOngoing(true)
                            .setSilent(true)
                            .addAction(R.drawable.ic_mining_notification, "Stop mining", stop);
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(
                        ID, notification.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(ID, notification.build());
            }
            CompletableFuture<Void> pending = ready;
            if (pending != null) pending.complete(null);
            if (!watching && !watchdog.isShutdown()) {
                watching = true;
                watchdog.scheduleWithFixedDelay(
                        () -> {
                            Session owner = session;
                            if (owner == null) return;
                            try {
                                String reason = owner.check();
                                if (reason != null) requestStop(reason);
                                String label = owner.label();
                                if (session == owner && !lastLabel.equals(label)) {
                                    lastLabel = label;
                                    manager.notify(
                                            ID,
                                            notification
                                                    .setContentTitle("AndroMiner · " + label)
                                                    .build());
                                }
                            } catch (RuntimeException failure) {
                                requestStop(
                                        "Device protection could not read sensors. Mining stopped.");
                            }
                        },
                        2,
                        2,
                        TimeUnit.SECONDS);
            }
        } catch (RuntimeException failure) {
            CompletableFuture<Void> pending = ready;
            if (pending != null) pending.completeExceptionally(failure);
            requestStop("Foreground mining notification could not start.");
        }
        return START_NOT_STICKY;
    }

    private static void requestStop(String reason) {
        Session owner = session;
        if (owner != null) owner.stop(reason);
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        requestStop("Mining stopped when the app was removed from recent apps.");
    }

    @Override
    public void onDestroy() {
        if (session == owner) requestStop("Mining protection service ended.");
        watchdog.shutdownNow();
        stopForeground(STOP_FOREGROUND_REMOVE);
        created = false;
        ended.complete(null);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
