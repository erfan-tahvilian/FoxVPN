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
    static String summary(long down,long up){return "↓ "+bytes(down)+"  ↑ "+bytes(up);}
    static String details(long down,long up){return "Downloaded: "+bytes(down)+"\nUploaded: "+bytes(up);}
}
