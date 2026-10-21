// SPDX-License-Identifier: GPL-3.0-or-later
package com.foxvpn.android;
import java.util.Locale;
final class ConnectionStats {
    private ConnectionStats(){}
    static String bytes(long value){
        double size=Math.max(0,value);String[] units={"B","KB","MB","GB","TB"};int unit=0;
        while(size>=1024&&unit<units.length-1){size/=1024;unit++;}
        return unit==0?String.format(Locale.ENGLISH,"%.0f %s",size,units[unit]):String.format(Locale.ENGLISH,"%.1f %s",size,units[unit]);
    }
    static String duration(long started,long now){
        long seconds=started>0?Math.max(0,(now-started)/1000):0;
        return String.format(Locale.ENGLISH,"%02d:%02d:%02d",seconds/3600,(seconds/60)%60,seconds%60);
    }
    static String summary(long down,long up,long started,long now){return "↓ "+bytes(down)+"  ↑ "+bytes(up)+"  · "+duration(started,now);}
    static String details(long down,long up,long started,long now){return "Downloaded: "+bytes(down)+"\nUploaded: "+bytes(up)+"\nSession: "+duration(started,now);}
}
