package top.mymellow.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PhoneNotify")
public class PhoneNotifyPlugin extends Plugin {
    private static final int REQUEST = 4811;

    private boolean granted() {
        if (Build.VERSION.SDK_INT < 33) return true;
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private JSObject result(boolean ok) {
        JSObject data = new JSObject();
        data.put("granted", ok);
        return data;
    }

    @PluginMethod
    public void permission(PluginCall call) {
        call.resolve(result(granted()));
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (granted()) {
            call.resolve(result(true));
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.resolve(result(false));
            return;
        }
        saveCall(call);
        ActivityCompat.requestPermissions(activity, new String[] { Manifest.permission.POST_NOTIFICATIONS }, REQUEST);
    }

    @Override
    protected void handleRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == REQUEST) {
            PluginCall saved = getSavedCall();
            if (saved != null) {
                boolean ok = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
                saved.resolve(result(ok));
                freeSavedCall();
            }
            return;
        }
        super.handleRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    @PluginMethod
    public void show(PluginCall call) {
        if (!granted()) {
            call.resolve();
            return;
        }
        MellowNotes.ensure(getContext());
        String title = call.getString("title", "半糖");
        String body = call.getString("body", "有一条新消息");
        if (title == null || title.trim().isEmpty()) title = "半糖";
        if (body == null || body.trim().isEmpty()) body = "有一条新消息";
        if (body.length() > 120) body = body.substring(0, 120);
        Intent open = new Intent(getContext(), MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            getContext(), 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        int id = (int) (System.currentTimeMillis() % 20000) + 20;
        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), MellowNotes.MAIL)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(pending);
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(id, builder.build());
        call.resolve();
    }

    @PluginMethod
    public void setStayAwake(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        Intent intent = new Intent(getContext(), MellowKeepAliveService.class);
        if (!on) {
            getContext().stopService(intent);
            call.resolve();
            return;
        }
        if (!granted()) {
            call.resolve();
            return;
        }
        if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(intent);
        else getContext().startService(intent);
        call.resolve();
    }
}
