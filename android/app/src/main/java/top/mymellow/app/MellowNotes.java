package top.mymellow.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

final class MellowNotes {
    static final String MAIL = "mellow-mail";
    static final String QUIET = "mellow-quiet";
    static final int KEEPALIVE_ID = 7;

    private MellowNotes() {}

    static void ensure(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel mail = new NotificationChannel(MAIL, "角色来信", NotificationManager.IMPORTANCE_HIGH);
        mail.setDescription("角色发来的消息");
        mail.enableVibration(true);
        NotificationChannel quiet = new NotificationChannel(QUIET, "后台运行", NotificationManager.IMPORTANCE_MIN);
        quiet.setDescription("挂在后台时，小手机还能把新消息送到通知栏");
        quiet.setShowBadge(false);
        quiet.setSound(null, null);
        manager.createNotificationChannel(mail);
        manager.createNotificationChannel(quiet);
    }
}
