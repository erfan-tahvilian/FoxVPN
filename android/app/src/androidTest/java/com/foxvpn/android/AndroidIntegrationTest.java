// SPDX-License-Identifier: GPL-3.0-or-later
package com.foxvpn.android;

import static org.junit.Assert.*;
import android.content.Context;
import android.content.Intent;
import android.net.VpnService;
import android.os.ParcelFileDescriptor;
import android.webkit.WebView;
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

@RunWith(AndroidJUnit4.class)
public class AndroidIntegrationTest {
    @Rule public ActivityTestRule<MainActivity> activity=new ActivityTestRule<>(MainActivity.class);
    private String js(String script)throws Exception{
        CountDownLatch result=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> activity.getActivity().web.evaluateJavascript(script,text->{value.set(text);result.countDown();}));
        assertTrue(result.await(15,TimeUnit.SECONDS));return value.get();
    }
    private void ready()throws Exception{
        long deadline=System.currentTimeMillis()+20000;
        while(System.currentTimeMillis()<deadline){if("true".equals(js("!!window.fox && !!document.getElementById('connect') && typeof currentState!=='undefined' && currentState!==null")))return;Thread.sleep(250);}
        fail("Android interface did not initialize");
    }
    @Test public void interfaceAndStateIsolation()throws Exception{
        ready();assertEquals("\"Fox VPN\"",js("document.title"));assertEquals("true",js("document.documentElement.scrollWidth<=window.innerWidth"));
        for(String page:new String[]{"home","locations","account","settings","logs"}){
            js("navigate('"+page+"')");assertEquals("true",js("document.querySelector('.page.active').id==='"+page+"'"));
        }
        assertEquals("false",js("'access_token' in currentState || 'refresh_token' in currentState"));
        assertEquals("true",js("document.getElementById('excludedApps').placeholder.includes('com.android.chrome')"));
        assertEquals("true",js("Array.from(document.querySelectorAll('button')).some(x=>x.textContent==='Add Quick Settings tile')"));
        js("window.fox.call('theme','light')");Thread.sleep(500);
        assertEquals("true",js("document.body.classList.contains('light')"));
        js("window.fox.call('theme','dark')");Thread.sleep(500);
        assertEquals("false",js("document.body.classList.contains('light')"));
        java.io.File screenshot=new java.io.File(activity.getActivity().getExternalFilesDir(null),"android-overview.png");
        js("navigate('home')");UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(screenshot);
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
    @Test public void nativeVpnPermissionProtectAndCleanup()throws Exception{
        ready();Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        Intent permission=VpnService.prepare(context);
        if(permission!=null){
            InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> activity.getActivity().startActivityForResult(permission,90));
            UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
            UiObject2 okay=device.wait(Until.findObject(By.res("android:id/button1")),10000);
            assertNotNull("VPN permission dialog did not appear",okay);okay.click();
            device.waitForIdle();
        }
        assertNull(VpnService.prepare(context));
        NativeTestService.started=new CountDownLatch(1);NativeTestService.closed=new CountDownLatch(1);NativeTestService.failure=null;NativeTestService.observedFd=-1;
        context.startService(new Intent(context,NativeTestService.class));
        assertTrue("Native engine did not start",NativeTestService.started.await(30,TimeUnit.SECONDS));
        if(NativeTestService.failure!=null)throw NativeTestService.failure;
        assertTrue("Native TUN was not established",NativeTestService.observedFd>=0);
        java.net.DatagramSocket socket=new java.net.DatagramSocket();
        assertTrue("Socket protection failed",NativeTestService.instance.protect(socket));socket.close();
        context.stopService(new Intent(context,NativeTestService.class));
        assertTrue("Native cleanup did not complete",NativeTestService.closed.await(30,TimeUnit.SECONDS));
        assertNull(NativeTestService.instance);
        FoxApp app=(FoxApp)context.getApplicationContext();assertEquals("disconnected",app.connection());
    }
}
