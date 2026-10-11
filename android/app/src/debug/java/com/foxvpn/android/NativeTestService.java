// SPDX-License-Identifier: GPL-3.0-or-later
package com.foxvpn.android;

import android.content.Intent;
import com.foxvpn.nativebridge.libbox.*;
import java.util.concurrent.CountDownLatch;

// Debug-only integration harness. No credentials, fabricated sessions or test actions are present in release APKs.
public final class NativeTestService extends FoxVpnService {
    static volatile NativeTestService instance;
    static volatile int observedFd = -1;
    static volatile Exception failure;
    static volatile CountDownLatch started = new CountDownLatch(1),closed = new CountDownLatch(1);
    private BoxService testEngine;
    private final java.util.concurrent.atomic.AtomicBoolean closing=new java.util.concurrent.atomic.AtomicBoolean();
    @Override public void onCreate(){super.onCreate();instance=this;}
    @Override public int onStartCommand(Intent intent,int flags,int id){
        new Thread(() -> {
            try {
                String config="{\"log\":{\"level\":\"error\"},\"inbounds\":[{\"type\":\"tun\",\"address\":[\"172.29.0.1/30\",\"fdfe:dcba:9876::1/126\"],\"mtu\":1500,\"auto_route\":false,\"stack\":\"mixed\"}],\"outbounds\":[{\"type\":\"direct\",\"tag\":\"direct\"}],\"route\":{\"auto_detect_interface\":true,\"final\":\"direct\"}}";
                testEngine=Libbox.newService(config,this);testEngine.start();
            }catch(Exception e){failure=e;}finally{started.countDown();}
        },"FoxVPN-native-test").start();
        return START_NOT_STICKY;
    }
    @Override public int openTun(TunOptions options)throws Exception{int fd=super.openTun(options);observedFd=fd;return fd;}
    // This harness does not create a core session; unrelated signed-out UI updates must not stop its test engine.
    @Override void stateChanged(){}
    @Override void requestStop(){
        if(!closing.compareAndSet(false,true))return;
        new Thread(() -> {
            try{if(testEngine!=null)testEngine.close();}catch(Exception e){failure=e;}
            finally{testEngine=null;super.requestStop();}
        },"FoxVPN-native-test-stop").start();
    }
    @Override public void onDestroy(){super.onDestroy();instance=null;closed.countDown();}
}
