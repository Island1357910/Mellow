package top.mymellow.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.CookieJar;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/** Narrow first-party bridge. No WebView cookie jar and no arbitrary URLs. */
@CapacitorPlugin(name = "NeteaseDirect")
public class NeteaseDirectPlugin extends Plugin {
    private static final Set<String> PATHS = new HashSet<>(Arrays.asList(
        "/weapi/login/qrcode/unikey", "/weapi/login/qrcode/client/login",
        "/weapi/w/nuser/account/get", "/weapi/user/playlist", "/weapi/v6/playlist/detail",
        "/weapi/cloudsearch/pc", "/weapi/v3/song/detail", "/weapi/song/enhance/player/url", "/weapi/song/lyric"
    ));
    private final OkHttpClient client = new OkHttpClient.Builder()
        .cookieJar(CookieJar.NO_COOKIES).followRedirects(false).followSslRedirects(false)
        .connectTimeout(15, TimeUnit.SECONDS).readTimeout(20, TimeUnit.SECONDS)
        .callTimeout(25, TimeUnit.SECONDS).build();

    @PluginMethod
    public void request(PluginCall call) {
        String path = call.getString("path", "");
        String body = call.getString("body", "");
        String cookie = call.getString("cookie", "");
        if (!PATHS.contains(path) || body.length() > 131072 || cookie.length() > 16000 || cookie.contains("\r") || cookie.contains("\n")) {
            call.reject("网易云请求格式不正确"); return;
        }
        Request request = new Request.Builder().url("https://music.163.com" + path)
            .header("Referer", "https://music.163.com/")
            .header("User-Agent", "Mozilla/5.0")
            .header("Cookie", "os=pc; appver=3.1.17; " + cookie)
            .post(RequestBody.create(body, MediaType.get("application/x-www-form-urlencoded; charset=utf-8")))
            .build();
        client.newCall(request).enqueue(new Callback() {
            @Override public void onFailure(Call requestCall, IOException error) {
                call.reject("无法直连网易云，请检查网络或稍后重试");
            }
            @Override public void onResponse(Call requestCall, Response response) {
                try (Response result = response) {
                    if (result.body() == null) { call.reject("网易云没有返回内容"); return; }
                    // Keep cookies only in this call's response; never persist a shared native jar.
                    JSObject output = new JSObject();
                    output.put("status", result.code());
                    output.put("data", new JSObject(result.body().string()));
                    output.put("setCookie", android.text.TextUtils.join(", ", result.headers("Set-Cookie")));
                    call.resolve(output);
                } catch (Exception error) { call.reject("网易云返回了无法读取的内容，请稍后重试"); }
            }
        });
    }
    @Override protected void handleOnDestroy() {
        client.dispatcher().cancelAll();
        super.handleOnDestroy();
    }
}
