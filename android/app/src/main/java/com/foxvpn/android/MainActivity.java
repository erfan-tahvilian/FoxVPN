// SPDX-License-Identifier: GPL-3.0-or-later
package com.foxvpn.android;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.net.VpnService;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.webkit.WebViewAssetLoader;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final int VPN_PERMISSION = 1, NOTIFICATION_PERMISSION = 2, EXPORT = 3;
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final Set<String> ACTIONS = Set.of("state","login","verify","logout","servers","ping","account","settings","theme","select","connect","cancel","disconnect","exit","clearLogs","exportLogs","openLink","chooseApps","locationSort","selectAccount","removeAccount","accountPreferences","cancelAccountLogin");
    private static final Set<String> LOCATION_SORTS = Set.of("ping-asc","ping-desc","name-asc","name-desc");
    WebView web;
    private boolean loaded, pendingConnect;
    private String exportText;
    private FoxApp app() { return (FoxApp) getApplication(); }
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (loaded && app().backend != null) receive(app().backend.snapshot());
            app().main.postDelayed(this, 1000);
        }
    };
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        if (app().backend == null) {
            android.widget.TextView error = new android.widget.TextView(this);
            error.setText(app().initializationError); error.setTextColor(Color.WHITE); error.setPadding(24,48,24,24); setContentView(error); return;
        }
        web = new WebView(this);
        android.widget.FrameLayout container=new android.widget.FrameLayout(this);
        container.setBackgroundColor(Color.rgb(16,17,23));
        container.addView(web,new android.widget.FrameLayout.LayoutParams(-1,-1));setContentView(container);
        if(Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE|android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        web.setBackgroundColor(Color.rgb(16,17,23));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(false);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.getSettings().setSupportMultipleWindows(false);
        web.getSettings().setMediaPlaybackRequiresUserGesture(true);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        // App labels and controls must not open WebView's text/image selection menu.
        // Keep the native editing menu available inside actual text fields.
        web.setOnLongClickListener(view -> web.getHitTestResult().getType()!=WebView.HitTestResult.EDIT_TEXT_TYPE);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        container.setOnApplyWindowInsetsListener((view,insets) -> {
            android.widget.FrameLayout.LayoutParams layout=(android.widget.FrameLayout.LayoutParams)web.getLayoutParams();
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.ime());
                layout.setMargins(bars.left,bars.top,bars.right,bars.bottom);
            } else layout.setMargins(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            web.setLayoutParams(layout);
            return Build.VERSION.SDK_INT>=30?android.view.WindowInsets.CONSUMED:insets.consumeSystemWindowInsets();
        });
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (!ORIGIN.equals(request.getUrl().getScheme()+"://"+request.getUrl().getHost())) return new WebResourceResponse("text/plain","UTF-8",403,"Forbidden",java.util.Map.of(),new java.io.ByteArrayInputStream(new byte[0]));
                return assets.shouldInterceptRequest(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !request.getUrl().toString().startsWith(ORIGIN+"/assets/");
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (!url.equals(ORIGIN+"/assets/src/ui/index.html")) return;
                loaded = true; receive(app().backend.snapshot());
                if (pendingConnect) { pendingConnect = false; if (app().state.optBoolean("signedIn")) beginConnect(); else web.evaluateJavascript("navigate('account')",null); }
            }
        });
        web.addJavascriptInterface(new Bridge(), "FoxAndroid");
        app().activity = new java.lang.ref.WeakReference<>(this);
        pendingConnect = getIntent().getBooleanExtra("connect",false);
        web.loadUrl(ORIGIN+"/assets/src/ui/index.html");
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);setIntent(intent);
        if (intent.getBooleanExtra("connect",false)) {
            if (loaded) { if (app().state.optBoolean("signedIn")) beginConnect(); else web.evaluateJavascript("navigate('account')",null); }
            else pendingConnect = true;
        }
    }
    @Override protected void onResume() { super.onResume();app().activity=new java.lang.ref.WeakReference<>(this);if(app().backend!=null)app().backend.setDark(app().isDark());app().main.post(tick); }
    @Override protected void onPause() { app().main.removeCallbacks(tick);super.onPause(); }
    @Override protected void onDestroy() { app().main.removeCallbacks(tick);if(app().activity.get()==this)app().activity.clear();if(web!=null){web.removeJavascriptInterface("FoxAndroid");web.destroy();}super.onDestroy(); }
    void receive(String state) {
        if(!loaded||web==null)return;
        try{
            JSONObject settings=new JSONObject(state).getJSONObject("settings");
            String theme=settings.optString("theme","system");
            boolean light="light".equals(theme)||"system".equals(theme)&&!app().isDark();
            int color=light?Color.rgb(247,248,250):Color.rgb(16,17,23);
            web.setBackgroundColor(color);((android.view.View)web.getParent()).setBackgroundColor(color);getWindow().setStatusBarColor(color);getWindow().setNavigationBarColor(color);
            if(Build.VERSION.SDK_INT>=30){
                android.view.WindowInsetsController controller=getWindow().getInsetsController();
                if(controller!=null){int flags=android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS|android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;controller.setSystemBarsAppearance(light?flags:0,flags);}
            }else{
                android.view.View decor=getWindow().getDecorView();int flags=android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                decor.setSystemUiVisibility(light?decor.getSystemUiVisibility()|flags:decor.getSystemUiVisibility()&~flags);
            }
        }catch(Exception ignored){}
        web.evaluateJavascript("window.fox.receive("+state+")",null);
    }
    private void respond(String id,String value) { app().main.post(() -> {if(web!=null&&loaded)web.evaluateJavascript("window.fox.resolve("+JSONObject.quote(id)+","+value+")",null);}); }
    private String envelope(boolean ok,String error) {try {JSONObject result=new JSONObject().put("ok",ok).put("data",JSONObject.NULL);if(error!=null)result.put("error",error);return result.toString();}catch(Exception e){return "{\"ok\":false,\"error\":\"Request failed\"}";}}
    final class Bridge {
        @JavascriptInterface public String getLocationSort() {
            String saved=getSharedPreferences("interface",MODE_PRIVATE).getString("locationSort","ping-asc");
            return LOCATION_SORTS.contains(saved)?saved:"ping-asc";
        }
        @JavascriptInterface public void request(String id,String channel,String arguments) {
            if (id==null||id.length()>64||arguments==null||arguments.length()>131072||!ACTIONS.contains(channel))return;
            (channel.equals("servers")?app().catalog:app().actions).execute(() -> {
                try {
                    JSONArray args=new JSONArray(arguments);
                    switch(channel){
                        case "settings":
                            String mode=args.getJSONObject(0).optString("splitMode","exclude");
                            if(!mode.equals("exclude")&&!mode.equals("include"))throw new IllegalArgumentException("Invalid VPN routing mode");
                            respond(id,app().backend.call(channel,arguments));break;
                        case "locationSort":
                            String sort=args.getString(0);
                            if(!LOCATION_SORTS.contains(sort))throw new IllegalArgumentException("Invalid location sorting");
                            if(!getSharedPreferences("interface",MODE_PRIVATE).edit().putString("locationSort",sort).commit())throw new java.io.IOException("Could not save location sorting.");
                            respond(id,envelope(true,null));break;
                        case "connect": app().main.post(MainActivity.this::beginConnect);respond(id,envelope(true,null));break;
                        case "cancel":case "disconnect":app().stopVpn();respond(id,envelope(true,null));break;
                        case "logout":app().stopVpn();respond(id,app().backend.call(channel,arguments));break;
                        case "openLink":
                            String target=switch(args.optString(0)){case "source" -> "https://github.com/erfan-tahvilian/FoxVPN";case "license" -> "https://github.com/erfan-tahvilian/FoxVPN/blob/main/LICENSE";case "account" -> "https://accounts.firefox.com/signup";case "accountSettings" -> "https://accounts.firefox.com/settings";default -> throw new IllegalArgumentException("Unsupported link");};
                            app().main.post(() -> startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(target))));respond(id,envelope(true,null));break;
                        case "exportLogs":
                            exportText=app().backend.logExport();
                            app().main.post(() -> startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("text/plain").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,"FoxVPN-diagnostics.txt"),EXPORT));
                            respond(id,envelope(true,null));break;
                        case "chooseApps": app().main.post(MainActivity.this::chooseApps);respond(id,envelope(true,null));break;
                        default:respond(id,app().backend.call(channel,arguments));break;
                    }
                }catch(Exception e){respond(id,envelope(false,e.getMessage()==null?"Request failed":e.getMessage()));}
            });
        }
    }
    private void beginConnect() {
        if (!app().state.optBoolean("signedIn")) { if(web!=null)web.evaluateJavascript("navigate('account')",null);return; }
        if (!"disconnected".equals(app().connection()))return;
        JSONObject settings=app().state.optJSONObject("settings");
        if(settings!=null&&!settings.optBoolean("proxyOnly")&&"include".equals(settings.optString("splitMode"))&&(settings.optJSONArray("excludedApps")==null||settings.optJSONArray("excludedApps").length()==0)){
            new android.app.AlertDialog.Builder(this).setTitle("No apps selected").setMessage("Choose at least one app in Settings > Split tunneling before connecting.").setPositiveButton("Open settings",(dialog,which)->{if(web!=null)web.evaluateJavascript("showSplitSettings()",null);}).setNegativeButton("Cancel",null).show();return;
        }

        if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED&&!getPreferences(MODE_PRIVATE).getBoolean("notificationAsked",false)){
            getPreferences(MODE_PRIVATE).edit().putBoolean("notificationAsked",true).apply();requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},NOTIFICATION_PERMISSION);return;
        }
        prepareVpn();
    }
    private void prepareVpn(){
        if(app().state.optJSONObject("settings").optBoolean("proxyOnly")){FoxVpnService.connect(this);return;}
        Intent permission=VpnService.prepare(this);if(permission!=null)startActivityForResult(permission,VPN_PERMISSION);else FoxVpnService.connect(this);
    }
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] grants){super.onRequestPermissionsResult(request,permissions,grants);if(request==NOTIFICATION_PERMISSION)prepareVpn();}
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==VPN_PERMISSION){if(result==RESULT_OK)FoxVpnService.connect(this);else Toast.makeText(this,"VPN permission is required to connect.",Toast.LENGTH_SHORT).show();}
        if(request==EXPORT&&result==RESULT_OK&&data!=null&&data.getData()!=null&&exportText!=null){String text=exportText;exportText=null;app().actions.execute(() -> {try(java.io.OutputStream stream=getContentResolver().openOutputStream(data.getData())){if(stream==null)throw new java.io.IOException();stream.write(text.getBytes(java.nio.charset.StandardCharsets.UTF_8));}catch(Exception e){app().main.post(() -> Toast.makeText(this,"Could not export diagnostics.",Toast.LENGTH_SHORT).show());}});}
    }
    private void chooseApps(){
        if(!"disconnected".equals(app().connection()))return;
        String theme=app().state.optJSONObject("settings").optString("theme","system");
        boolean light="light".equals(theme)||"system".equals(theme)&&!app().isDark();
        android.view.ContextThemeWrapper context=new android.view.ContextThemeWrapper(this,light?android.R.style.Theme_Material_Light_Dialog_Alert:android.R.style.Theme_Material_Dialog_Alert);
        new AppPicker(context,getPackageName(),app().state.optJSONObject("settings").optJSONArray("excludedApps"),"include".equals(app().state.optJSONObject("settings").optString("splitMode")),selected -> {
            web.evaluateJavascript("(()=>{const field=document.getElementById('excludedApps');field.value="+JSONObject.quote(String.join("\n",selected))+";field.dispatchEvent(new Event('change',{bubbles:true}));})()",null);
        }).show();
    }
}
