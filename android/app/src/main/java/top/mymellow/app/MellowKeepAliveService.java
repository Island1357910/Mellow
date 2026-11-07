package top.mymellow.app;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

public class MellowKeepAliveService extends Service {
    private PowerManager.WakeLock lock;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        MellowNotes.ensure(this);
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notice = new NotificationCompat.Builder(this, MellowNotes.QUIET)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle("半糖还在后台")
            .setContentText("新消息会弹到通知栏。划掉小手机后就会停。")
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(pending)
            .build();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(MellowNotes.KEEPALIVE_ID, notice, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else if (Build.VERSION.SDK_INT >= 29) {
            startForeground(MellowNotes.KEEPALIVE_ID, notice, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(MellowNotes.KEEPALIVE_ID, notice);
        }
        if (lock == null || !lock.isHeld()) {
            PowerManager manager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (manager != null) {
                lock = manager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "mellow:keepalive");
                lock.setReferenceCounted(false);
                lock.acquire(12L * 60L * 60L * 1000L);
            }
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (lock != null && lock.isHeld()) lock.release();
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE);
        else stopForeground(true);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
