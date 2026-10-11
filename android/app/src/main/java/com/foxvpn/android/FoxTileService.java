// SPDX-License-Identifier: GPL-3.0-or-later
package com.foxvpn.android;

import android.app.PendingIntent;
import android.content.Intent;
import android.graphics.drawable.Icon;
import android.net.VpnService;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

public final class FoxTileService extends TileService {
    private FoxApp app() { return (FoxApp) getApplication(); }
    @Override public void onStartListening() { super.onStartListening(); refresh(); }
    private void refresh() {
        Tile tile = getQsTile(); if (tile == null) return;
        String connection = app().connection();
        tile.setIcon(Icon.createWithResource(this, R.drawable.ic_fox_tile));
        tile.setLabel("Fox VPN");
        tile.setState("connected".equals(connection) ? Tile.STATE_ACTIVE : Tile.STATE_INACTIVE);
        if (Build.VERSION.SDK_INT >= 29) tile.setSubtitle("connected".equals(connection) ? "Connected"
            : "connecting".equals(connection) ? "Connecting…" : "Disconnected");
        tile.updateTile();
    }
    @Override public void onClick() {
        super.onClick();
        if (isLocked()) { unlockAndRun(this::toggle); } else toggle();
    }
    private void toggle() {
        if (!"disconnected".equals(app().connection())) { app().stopVpn(); refresh(); return; }
        if (app().backend == null || !app().state.optBoolean("signedIn") || VpnService.prepare(this) != null) {
            Intent intent = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("connect", true);
            if (Build.VERSION.SDK_INT >= 34) startActivityAndCollapse(PendingIntent.getActivity(this, 7, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            else startActivityAndCollapse(intent);
            return;
        }
        FoxVpnService.connect(this);
    }
}
