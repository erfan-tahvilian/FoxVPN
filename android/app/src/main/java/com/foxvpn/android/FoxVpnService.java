// SPDX-License-Identifier: GPL-3.0-or-later
package com.foxvpn.android;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.LinkProperties;
import android.net.NetworkCapabilities;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import com.foxvpn.nativebridge.libbox.*;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import org.json.JSONObject;

public class FoxVpnService extends VpnService implements PlatformInterface {
    static final String CHANNEL="foxvpn.connection";
    static final int NOTIFICATION=101;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final Object engineLock=new Object();
    private BoxService engine;
    private ParcelFileDescriptor tun;
    private volatile boolean starting,stopping;
    private final java.util.concurrent.atomic.AtomicBoolean cleanupQueued=new java.util.concurrent.atomic.AtomicBoolean();
    private InterfaceUpdateListener interfaceListener;
    private FoxApp app(){return (FoxApp)getApplication();}
    public static void connect(Context context){context.startForegroundService(new Intent(context,FoxVpnService.class).setAction("connect"));}
    @Override public void onCreate(){
        super.onCreate();app().vpn=this;
        getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(CHANNEL,"VPN connection",NotificationManager.IMPORTANCE_LOW));
    }
    @Override public int onStartCommand(Intent intent,int flags,int startID){
        if(intent!=null&&"disconnect".equals(intent.getAction())){app().stopVpn();return START_NOT_STICKY;}
        if(starting||stopping||!"disconnected".equals(app().connection()))return START_NOT_STICKY;
        starting=true;startForeground(NOTIFICATION,notification("Connecting…"));
        worker.execute(() -> {
            try {
                if(app().backend==null)throw new Exception("Fox VPN could not start");
                JSONObject response=new JSONObject(app().backend.call("connect","[]"));
                if(!response.optBoolean("ok"))throw new Exception(response.optString("error","Connection failed"));
                if(stopping||"disconnected".equals(app().connection()))return;
                if(!app().state.optJSONObject("settings").optBoolean("proxyOnly")){
                    if(VpnService.prepare(this)!=null)throw new Exception("VPN permission is required");
                    synchronized(engineLock){
                        if(stopping)return;
                        engine=Libbox.newService(app().backend.engineConfig(),this);
                        engine.start();
                    }
                }
                if(stopping){requestStop();return;}app().backend.ready();
            }catch(Exception e){if(!stopping&&app().backend!=null)app().backend.failed(e.getMessage()==null?"Connection failed":e.getMessage());requestStop();}
            finally{starting=false;if(stopping||"disconnected".equals(app().connection()))requestStop();}
        });
        return START_NOT_STICKY;
    }
    void stateChanged(){
        if(stopping)return;
        String connection=app().connection();
        if("disconnected".equals(connection)){if(!starting)requestStop();return;}
        getSystemService(NotificationManager.class).notify(NOTIFICATION,notification("connected".equals(connection)?"Connected":"Connecting…"));
    }
    private Notification notification(String status){
        PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,FoxVpnService.class).setAction("disconnect"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        JSONObject server=app().state.optJSONObject("activeServer");
        String text=status;if(server!=null&&"connected".equals(app().connection()))text+=" · "+server.optString("city")+", "+server.optString("country");
        return new Notification.Builder(this,CHANNEL).setSmallIcon(R.drawable.ic_fox_tile).setContentTitle("Fox VPN").setContentText(text)
            .setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true).setCategory(Notification.CATEGORY_SERVICE)
            .addAction(new Notification.Action.Builder(null,"Disconnect",stop).build()).build();
    }
    void requestStop(){
        stopping=true;if(app().backend!=null)app().backend.disconnect();
        if(!cleanupQueued.compareAndSet(false,true))return;
        worker.execute(() -> {
            synchronized(engineLock){if(engine!=null){try{engine.close();}catch(Exception ignored){}engine=null;}if(tun!=null){try{tun.close();}catch(Exception ignored){}tun=null;}}
            app().main.post(() -> {stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();});
        });
    }
    @Override public void onRevoke(){app().stopVpn();super.onRevoke();}
    @Override public void onDestroy(){stopping=true;if(app().backend!=null)app().backend.disconnect();synchronized(engineLock){if(engine!=null){try{engine.close();}catch(Exception ignored){}engine=null;}if(tun!=null){try{tun.close();}catch(Exception ignored){}tun=null;}}if(app().vpn==this)app().vpn=null;worker.shutdown();super.onDestroy();}

    @Override public int openTun(TunOptions options)throws Exception{
        if(VpnService.prepare(this)!=null)throw new Exception("VPN permission was revoked");
        Builder builder=new Builder().setSession("Fox VPN").setMtu(options.getMTU());
        builder.addDisallowedApplication(getPackageName());
        RoutePrefixIterator addresses=options.getInet4Address();while(addresses.hasNext()){RoutePrefix p=addresses.next();builder.addAddress(p.address(),p.prefix());}
        addresses=options.getInet6Address();while(addresses.hasNext()){RoutePrefix p=addresses.next();builder.addAddress(p.address(),p.prefix());}
        builder.addDnsServer(options.getDNSServerAddress().getValue());
        RoutePrefixIterator routes=options.getInet4RouteRange();while(routes.hasNext()){RoutePrefix p=routes.next();builder.addRoute(p.address(),p.prefix());}
        routes=options.getInet6RouteRange();while(routes.hasNext()){RoutePrefix p=routes.next();builder.addRoute(p.address(),p.prefix());}
        StringIterator packages=options.getExcludePackage();while(packages.hasNext()){String pkg=packages.next();if(!pkg.equals(getPackageName())){try{builder.addDisallowedApplication(pkg);}catch(android.content.pm.PackageManager.NameNotFoundException ignored){}}}
        if(Build.VERSION.SDK_INT>=29)builder.setMetered(false);
        tun=builder.establish();if(tun==null)throw new Exception("Android could not establish the VPN interface");return tun.getFd();
    }
    @Override public LocalDNSTransport localDNSTransport(){return null;}
    @Override public boolean usePlatformAutoDetectInterfaceControl(){return true;}
    @Override public void autoDetectInterfaceControl(int fd)throws Exception{if(!protect(fd))throw new Exception("Could not protect a VPN socket");}
    @Override public void writeLog(String message){/* Traffic and upstream credentials are not forwarded to the UI. */}
    @Override public boolean useProcFS(){return false;}
    @Override public int findConnectionOwner(int protocol,String source,int sourcePort,String destination,int destinationPort)throws Exception{
        if(Build.VERSION.SDK_INT>=29)return getSystemService(ConnectivityManager.class).getConnectionOwnerUid(protocol,new InetSocketAddress(source,sourcePort),new InetSocketAddress(destination,destinationPort));
        throw new Exception("Connection owner lookup requires Android 10");
    }
    @Override public String packageNameByUid(int uid){String[] packages=getPackageManager().getPackagesForUid(uid);return packages==null||packages.length==0?"":packages[0];}
    @Override public int uidByPackageName(String name)throws Exception{return getPackageManager().getApplicationInfo(name,0).uid;}
    @Override public void startDefaultInterfaceMonitor(InterfaceUpdateListener listener){interfaceListener=listener;networkChanged();}
    @Override public void closeDefaultInterfaceMonitor(InterfaceUpdateListener listener){interfaceListener=null;}
    void networkChanged(){
        InterfaceUpdateListener listener=interfaceListener;if(listener==null)return;
        LinkProperties links=app().physicalLinks;
        String name=links==null?"":links.getInterfaceName();if(name==null)name="";
        int index=-1;try{NetworkInterface value=NetworkInterface.getByName(name);if(value!=null)index=value.getIndex();}catch(Exception ignored){}
        NetworkCapabilities caps=app().network==null?null:getSystemService(ConnectivityManager.class).getNetworkCapabilities(app().network);
        listener.updateDefaultInterface(name,index,caps!=null&&!caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED),false);
    }
    static final class Strings implements StringIterator{
        final java.util.Iterator<String> iterator;final int length;
        Strings(List<String> values){iterator=values.iterator();length=values.size();}
        @Override public boolean hasNext(){return iterator.hasNext();}
        @Override public String next(){return iterator.next();}
        @Override public int len(){return length;}
    }
    @Override public NetworkInterfaceIterator getInterfaces()throws Exception{
        List<com.foxvpn.nativebridge.libbox.NetworkInterface> interfaces=new ArrayList<>();
        for(NetworkInterface value:Collections.list(NetworkInterface.getNetworkInterfaces())){
            if(!value.isUp())continue;
            com.foxvpn.nativebridge.libbox.NetworkInterface entry=new com.foxvpn.nativebridge.libbox.NetworkInterface();
            entry.setIndex(value.getIndex());entry.setMTU(value.getMTU());entry.setName(value.getName());
            List<String> addresses=new ArrayList<>();value.getInterfaceAddresses().forEach(address -> addresses.add(address.getAddress().getHostAddress().split("%")[0]+"/"+address.getNetworkPrefixLength()));
            entry.setAddresses(new Strings(addresses));entry.setFlags(1|64|(value.isLoopback()?8:0)|(value.isPointToPoint()?16:0)|(value.supportsMulticast()?4096:0));
            LinkProperties links=app().physicalLinks;
            List<String> dns=new ArrayList<>();if(links!=null&&value.getName().equals(links.getInterfaceName()))links.getDnsServers().forEach(address -> dns.add(address.getHostAddress()));
            entry.setDNSServer(new Strings(dns));entry.setType(0);interfaces.add(entry);
        }
        java.util.Iterator<com.foxvpn.nativebridge.libbox.NetworkInterface> iterator=interfaces.iterator();
        return new NetworkInterfaceIterator(){@Override public boolean hasNext(){return iterator.hasNext();}@Override public com.foxvpn.nativebridge.libbox.NetworkInterface next(){return iterator.next();}};
    }
    @Override public boolean underNetworkExtension(){return false;}
    @Override public boolean includeAllNetworks(){return false;}
    @Override public WIFIState readWIFIState(){return null;}
    @Override public StringIterator systemCertificates(){
        String value=app().certificates();List<String> certs=new ArrayList<>();
        for(String part:value.split("-----END CERTIFICATE-----"))if(part.contains("-----BEGIN CERTIFICATE-----"))certs.add(part.trim()+"\n-----END CERTIFICATE-----\n");
        return new Strings(certs);
    }
    @Override public void clearDNSCache(){}
    @Override public void sendNotification(com.foxvpn.nativebridge.libbox.Notification notification){}
}
