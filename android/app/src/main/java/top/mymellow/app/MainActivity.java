package top.mymellow.app;

import android.graphics.Color;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NeteaseDirectPlugin.class);
        registerPlugin(PhoneNotifyPlugin.class);
        super.onCreate(savedInstanceState);
        if (bridge == null || bridge.getWebView() == null) {
            showStartupHelp();
            return;
        }
        bridge.getWebView().setBackgroundColor(Color.rgb(253, 251, 247));
        // User-selected songs resolve their authorized URL asynchronously.
        bridge.getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attributes = window.getAttributes();
            attributes.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(attributes);
        }
        // Only the keyboard may resize the app; system bars/cutouts never add white margins.
        ViewCompat.setOnApplyWindowInsetsListener(window.getDecorView(), (view, insets) -> {
            int keyboardHeight = insets.isVisible(WindowInsetsCompat.Type.ime())
                ? insets.getInsets(WindowInsetsCompat.Type.ime()).bottom : 0;
            view.setPadding(0, 0, 0, keyboardHeight);
            return insets;
        });
        window.getDecorView().post(this::enterFullscreen);
    }

    private void showStartupHelp() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(android.view.Gravity.CENTER);
        int padding = (int) (24 * getResources().getDisplayMetrics().density);
        panel.setPadding(padding, padding, padding, padding);
        panel.setBackgroundColor(Color.rgb(253, 251, 247));
        TextView message = new TextView(this);
        message.setText("半糖暂时无法启动\n\n请在手机应用商店更新 Android System WebView 或 Chrome，再重新打开。请勿卸载半糖或清除应用数据。\n\n手机：" + Build.MANUFACTURER + " " + Build.MODEL + "\nAndroid " + Build.VERSION.RELEASE);
        message.setTextColor(Color.rgb(58, 58, 58));
        message.setTextSize(17);
        panel.addView(message);
        Button retry = new Button(this);
        retry.setText("重新打开");
        retry.setOnClickListener(view -> recreate());
        panel.addView(retry);
        Button browser = new Button(this);
        browser.setText("使用网页版（本地数据独立）");
        browser.setOnClickListener(view -> {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://mymellow.top/"))); }
            catch (android.content.ActivityNotFoundException error) { message.append("\n未找到可用浏览器。"); }
        });
        panel.addView(browser);
        setContentView(panel);
    }

    @Override
    public void onPause() {
        super.onPause();
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().onResume();
            bridge.getWebView().resumeTimers();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        getWindow().getDecorView().post(this::enterFullscreen);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterFullscreen();
    }

    private void enterFullscreen() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
            getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
