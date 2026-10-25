// SPDX-License-Identifier: GPL-3.0-or-later
package com.foxvpn.android;

import static org.junit.Assert.*;
import android.content.Context;
import android.content.Intent;
import android.net.VpnService;
import android.os.ParcelFileDescriptor;
import android.webkit.WebView;
import com.foxvpn.nativebridge.libbox.Libbox;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.rule.ActivityTestRule;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.Until;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONObject;

@RunWith(AndroidJUnit4.class)
public class AndroidIntegrationTest {
    @Rule public ActivityTestRule<MainActivity> activity=new ActivityTestRule<>(MainActivity.class);
    private String js(String script)throws Exception{
        CountDownLatch result=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> activity.getActivity().web.evaluateJavascript(script,text->{value.set(text);result.countDown();}));
        assertTrue(result.await(15,TimeUnit.SECONDS));return value.get();
    }
    private void dismissLauncherAnr(UiDevice device){
        if(device.hasObject(By.res("android:id/alertTitle").text("Pixel Launcher isn't responding"))){
            UiObject2 close=device.findObject(By.res("android:id/aerr_close"));
            if(close!=null){android.util.Log.w("FoxVPNTest","Dismissing unrelated emulator Pixel Launcher ANR");close.click();}
        }
    }
    private UiObject2 awaitNative(androidx.test.uiautomator.BySelector selector,long timeout)throws Exception{
        UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        long deadline=System.currentTimeMillis()+timeout;
        do{dismissLauncherAnr(device);UiObject2 found=device.findObject(selector);if(found!=null)return found;Thread.sleep(100);}while(System.currentTimeMillis()<deadline);
        return null;
    }
    private void ready()throws Exception{
        long deadline=System.currentTimeMillis()+20000;
        while(System.currentTimeMillis()<deadline){if("true".equals(js("!!window.fox && !!document.getElementById('connect') && typeof currentState!=='undefined' && currentState!==null")))return;Thread.sleep(250);}
        fail("Android interface did not initialize");
    }
    @Test public void connectionNotificationStatistics(){
        assertEquals("Downloaded: 1.0 MB\nUploaded: 2.0 KB",ConnectionStats.details(1048576,2048));
        assertEquals("0 B",ConnectionStats.bytes(-1));
        assertEquals("↓ 1.0 KB  ↑ 2.0 KB",ConnectionStats.summary(1024,2048));
    }
    @Test public void interfaceAndStateIsolation()throws Exception{
        ready();assertEquals("\"Fox VPN\"",js("document.title"));assertEquals("true",js("document.documentElement.scrollWidth<=window.innerWidth"));
        assertEquals("\"none\"",js("getComputedStyle(document.querySelector('h1')).userSelect"));
        assertEquals("\"rgba(0, 0, 0, 0)\"",js("getComputedStyle(document.getElementById('connect')).webkitTapHighlightColor"));
        assertEquals("\"text\"",js("getComputedStyle(document.querySelector('input[type=email]')).userSelect"));
        assertEquals("true",js("(()=>{const h=document.querySelector('header').getBoundingClientRect(),t=document.getElementById('theme-toggle').getBoundingClientRect(),a=document.querySelector('.account-chip .avatar').getBoundingClientRect();return Math.abs(t.left+t.width/2-h.left-h.width/2)<1 && Math.abs(t.top+t.height/2-h.top-h.height/2)<1 && Math.abs(a.width-a.height)<1})()"));
        assertEquals("true",js("(()=>{const before=currentState;render({...before,signedIn:true,email:'nora@example.com'});const correct=document.querySelector('.account-chip .avatar').textContent==='N';render(before);return correct})()"));
        for(String page:new String[]{"home","locations","account","settings","logs"}){
            js("navigate('"+page+"')");assertEquals("true",js("document.querySelector('.page.active').id==='"+page+"'"));
        }
        assertEquals("false",js("'access_token' in currentState || 'refresh_token' in currentState"));
        assertEquals("false",js("document.getElementById('excludedApps').closest('label').hidden"));
        assertEquals("true",js("!!document.getElementById('choose-apps') && !document.querySelector('#settings-form button[type=submit]')"));
        assertEquals("false",js("Array.from(document.querySelectorAll('button')).some(x=>x.textContent==='Add Quick Settings tile')"));
        js("window.fox.call('theme','light')");Thread.sleep(500);
        assertEquals("true",js("document.body.classList.contains('light')"));
        js("window.fox.call('theme','dark')");Thread.sleep(500);
        assertEquals("false",js("document.body.classList.contains('light')"));
        java.io.File screenshot=new java.io.File(activity.getActivity().getFilesDir(),"android-overview.png");
        js("navigate('home')");Thread.sleep(500);
        assertTrue("System bars overlap the interface",activity.getActivity().web.getTop()>0);
        assertTrue(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(screenshot));
    }
    @Test public void secureStorageRejectsTampering()throws Exception{
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        CryptoVault vault=new CryptoVault(context);
        String original=vault.read();vault.write("{\"token\":\"fixture-private-value\"}");
        assertEquals("{\"token\":\"fixture-private-value\"}",vault.read());
        java.io.File file=new java.io.File(context.getFilesDir(),"session.enc");byte[] encrypted=Files.readAllBytes(file.toPath());
        assertFalse(new String(encrypted,StandardCharsets.UTF_8).contains("fixture-private-value"));
        encrypted[encrypted.length-1]^=1;Files.write(file.toPath(),encrypted);
        boolean rejected=false;try{vault.read();}catch(Exception e){rejected=true;}
        assertTrue("Tampered vault was accepted",rejected);vault.write(original);
    }
    @Test public void locationSortingSurvivesRelaunch()throws Exception{
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        android.content.SharedPreferences preferences=context.getSharedPreferences("interface",Context.MODE_PRIVATE);
        String original=preferences.getString("locationSort",null);
        try{
            assertTrue(preferences.edit().remove("locationSort").commit());
            activity.finishActivity();activity.launchActivity(null);ready();
            assertEquals("\"ping-asc\"",js("document.getElementById('server-sort').value"));
            assertEquals("\"ping-asc,ping-desc,name-asc,name-desc\"",js("Array.from(document.getElementById('server-sort').options,x=>x.value).join(',')"));
            js("document.getElementById('server-sort').value='name-desc';document.getElementById('server-sort').dispatchEvent(new Event('change'))");
            long deadline=System.currentTimeMillis()+5000;
            while(!"name-desc".equals(preferences.getString("locationSort",null))&&System.currentTimeMillis()<deadline)Thread.sleep(50);
            assertEquals("name-desc",preferences.getString("locationSort",null));
            activity.finishActivity();activity.launchActivity(null);ready();
            assertEquals("\"name-desc\"",js("document.getElementById('server-sort').value"));
            assertEquals("true",js("document.getElementById('server-sort-trigger').textContent.includes('Descending')"));
        }finally{
            android.content.SharedPreferences.Editor edit=preferences.edit();
            if(original==null)edit.remove("locationSort");else edit.putString("locationSort",original);
            assertTrue(edit.commit());
        }
    }
    @Test public void androidPreferencesSaveWithoutSubmit()throws Exception{
        ready();FoxApp app=(FoxApp)InstrumentationRegistry.getInstrumentation().getTargetContext().getApplicationContext();
        JSONObject original=new JSONObject(app.state.getJSONObject("settings").toString());
        boolean before=app.state.getJSONObject("settings").getBoolean("proxyOnly");
        try{
            js("navigate('settings');document.getElementById('proxyOnly').click()");
            long deadline=System.currentTimeMillis()+5000;
            while(app.state.getJSONObject("settings").getBoolean("proxyOnly")==before&&System.currentTimeMillis()<deadline)Thread.sleep(100);
            assertEquals(!before,app.state.getJSONObject("settings").getBoolean("proxyOnly"));
            activity.finishActivity();activity.launchActivity(null);ready();
            assertEquals(String.valueOf(!before),js("document.getElementById('proxyOnly').checked"));
            js("navigate('settings');document.getElementById('split-mode').value='include';document.getElementById('split-mode').dispatchEvent(new Event('change',{bubbles:true}))");
            deadline=System.currentTimeMillis()+5000;
            while(!"include".equals(app.state.getJSONObject("settings").optString("splitMode"))&&System.currentTimeMillis()<deadline)Thread.sleep(100);
            assertEquals("include",app.state.getJSONObject("settings").getString("splitMode"));
            activity.finishActivity();activity.launchActivity(null);ready();
            assertEquals("\"include\"",js("document.getElementById('split-mode').value"));
            js("navigate('settings');document.getElementById('excludedApps').value='com.myirancell';document.getElementById('excludedApps').dispatchEvent(new Event('change',{bubbles:true}))");
            deadline=System.currentTimeMillis()+5000;
            while(!app.state.getJSONObject("settings").getJSONArray("excludedApps").toString().contains("com.myirancell")&&System.currentTimeMillis()<deadline)Thread.sleep(100);
            assertTrue(app.state.getJSONObject("settings").getJSONArray("excludedApps").toString().contains("com.myirancell"));
            js("navigate('settings');document.getElementById('choose-apps').click()");
            UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
            assertNotNull(awaitNative(By.clazz("android.widget.EditText").text("Search apps"),5000));
            UiObject2 manual=device.wait(Until.findObject(By.text("com.myirancell")),5000);assertNotNull(manual);manual.click();
            Thread.sleep(500);assertEquals("false",js("document.getElementById('excludedApps').value.includes('com.myirancell')"));
            UiObject2 search=device.findObject(By.clazz("android.widget.EditText"));search.setText("no-such-foxvpn-app-123");
            assertNotNull(device.wait(Until.findObject(By.text("No apps found")),5000));
            device.pressBack();UiObject2 done=device.findObject(By.text("Done"));if(done!=null)done.click();
        }finally{
            app.backend.call("settings","["+original+"]");
        }
    }
    @Test public void nativeVpnPermissionProtectAndCleanup()throws Exception{
        ready();Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        FoxApp app=(FoxApp)context.getApplicationContext();
        JSONObject original=new JSONObject(app.state.getJSONObject("settings").toString());
        try{
            for(String dns:new String[]{"automatic","cloudflare","google","quad9","off","custom"}){
                JSONObject settings=new JSONObject(original.toString());
                settings.put("doh",dns.equals("custom")?"automatic":dns);
                settings.put("customDns",dns.equals("custom")?"1.1.1.1":"");
                JSONObject response=new JSONObject(app.backend.call("settings","["+settings+"]"));
                assertTrue("DNS settings rejected: "+dns,response.getBoolean("ok"));
                String rawConfig=app.backend.engineConfig();
                JSONObject actualConfig=new JSONObject(FoxVpnService.nativeConfig(rawConfig));
                assertEquals("Android TUN must use userspace TCP", "gvisor",actualConfig.getJSONArray("inbounds").getJSONObject(0).getString("stack"));
                assertEquals("Do not alter proxy destinations",new JSONObject(rawConfig).getJSONArray("outbounds").toString(),actualConfig.getJSONArray("outbounds").toString());
                assertEquals("Do not alter DNS settings",new JSONObject(rawConfig).getJSONObject("dns").toString(),actualConfig.getJSONObject("dns").toString());
                Libbox.checkConfig(actualConfig.toString());
                JSONObject allowlistSource=new JSONObject(rawConfig);
                allowlistSource.getJSONArray("inbounds").getJSONObject(0).put("exclude_package",new org.json.JSONArray().put("com.android.chrome"));
                JSONObject allowlist=new JSONObject(FoxVpnService.nativeConfig(allowlistSource.toString(),"include"));
                JSONObject tun=allowlist.getJSONArray("inbounds").getJSONObject(0);
                assertFalse("Allow and deny lists must not be combined",tun.has("exclude_package"));
                assertEquals("com.android.chrome",tun.getJSONArray("include_package").getString(0));
                Libbox.checkConfig(allowlist.toString());
            }
        }finally{app.backend.call("settings","["+original+"]");}
        Intent permission=VpnService.prepare(context);
        if(permission!=null){
            InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> activity.getActivity().startActivityForResult(permission,90));
            UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
            // System consent is asynchronous and may briefly suppress clicks after the dialog opens.
            long deadline=System.currentTimeMillis()+30000;
            while(VpnService.prepare(context)!=null&&System.currentTimeMillis()<deadline){
                dismissLauncherAnr(device);
                UiObject2 okay=device.findObject(By.res("android:id/button1"));
                if(okay==null)okay=device.findObject(By.pkg("com.android.vpndialogs").text(java.util.regex.Pattern.compile("(?i)(OK|Connect|Allow)")));
                if(okay!=null&&okay.isEnabled())okay.click();
                Thread.sleep(500);
            }
            device.waitForIdle();
            if(VpnService.prepare(context)!=null){
                device.dumpWindowHierarchy(new java.io.File(context.getFilesDir(),"vpn-consent.xml"));
                device.takeScreenshot(new java.io.File(context.getFilesDir(),"vpn-consent.png"));
            }
        }
        assertNull(VpnService.prepare(context));
        for(int cycle=0;cycle<5;cycle++){
        NativeTestService.started=new CountDownLatch(1);NativeTestService.closed=new CountDownLatch(1);NativeTestService.failure=null;NativeTestService.observedFd=-1;
        context.startService(new Intent(context,NativeTestService.class));
        assertTrue("Native engine did not start",NativeTestService.started.await(30,TimeUnit.SECONDS));
        if(NativeTestService.failure!=null)throw NativeTestService.failure;
        assertTrue("Native TUN was not established",NativeTestService.observedFd>=0);
        java.net.DatagramSocket socket=new java.net.DatagramSocket();
        assertTrue("Socket protection failed",NativeTestService.instance.protect(socket));socket.close();
        // Android binds an established VPN service. Stop its engine/TUN first, as the real app does.
        NativeTestService.instance.requestStop();
        assertTrue("Native cleanup did not complete",NativeTestService.closed.await(30,TimeUnit.SECONDS));
        if(NativeTestService.failure!=null)throw NativeTestService.failure;
        assertNull(NativeTestService.instance);
        assertEquals("disconnected",app.connection());
        }
    }
}
