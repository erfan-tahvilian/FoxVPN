// SPDX-License-Identifier: GPL-3.0-or-later
package com.foxvpn.android;

import android.app.Application;
import android.content.ComponentName;
import android.content.res.Configuration;
import android.net.ConnectivityManager;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Handler;
import android.os.Looper;
import android.service.quicksettings.TileService;
import android.util.Base64;
import com.foxvpn.nativebridge.mobile.Backend;
import com.foxvpn.nativebridge.mobile.Host;
import com.foxvpn.nativebridge.mobile.Mobile;
import com.foxvpn.nativebridge.libbox.Libbox;
import com.foxvpn.nativebridge.libbox.SetupOptions;
import java.lang.ref.WeakReference;
import java.security.KeyStore;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import org.json.JSONObject;

public final class FoxApp extends Application implements Host {
    final Handler main = new Handler(Looper.getMainLooper());
    final ExecutorService actions = Executors.newSingleThreadExecutor();
    Backend backend;
    volatile FoxVpnService vpn;
    volatile Network network;
    volatile LinkProperties physicalLinks;
    volatile JSONObject state = new JSONObject();
    volatile String initializationError;
    WeakReference<MainActivity> activity = new WeakReference<>(null);
    private CryptoVault vault;
    private ConnectivityManager connectivity;
    private String certificates;
    @Override public void onCreate() {
        super.onCreate(); vault = new CryptoVault(this);
        connectivity = getSystemService(ConnectivityManager.class);
        network = connectivity.getActiveNetwork(); physicalLinks = connectivity.getLinkProperties(network);
        connectivity.registerNetworkCallback(new NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN).build(), new ConnectivityManager.NetworkCallback() {
            @Override public void onAvailable(Network value) {
                network = value; physicalLinks = connectivity.getLinkProperties(value); updateNetwork();
            }
            @Override public void onLinkPropertiesChanged(Network value, LinkProperties links) {
                if (value.equals(network)) { physicalLinks = links; updateNetwork(); }
            }
            @Override public void onLost(Network value) {
                if (value.equals(network)) {
                    network = null; physicalLinks = null;
                    for (Network candidate : connectivity.getAllNetworks()) {
                        NetworkCapabilities caps = connectivity.getNetworkCapabilities(candidate);
                        if (caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)
                            && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) {
                            network = candidate; physicalLinks = connectivity.getLinkProperties(candidate); break;
                        }
                    }
                    updateNetwork();
                }
            }
            private void updateNetwork() { FoxVpnService service = vpn; if (service != null) service.networkChanged(); }
        });
        try {
            certificates = loadCertificates();
            SetupOptions options = new SetupOptions();
            options.setBasePath(getFilesDir().getAbsolutePath()); options.setWorkingPath(getFilesDir().getAbsolutePath());
            options.setTempPath(getCacheDir().getAbsolutePath()); options.setFixAndroidStack(true);
            Libbox.setup(options); Libbox.setLocale("en");
            backend = Mobile.newBackend(this, vault.read()); backend.setDark(isDark());
            state = new JSONObject(backend.snapshot());
            actions.execute(() -> backend.call("servers", "[]"));
        } catch (Exception e) { initializationError = "Secure storage could not be initialized. Restart Fox VPN or reinstall if the problem persists."; }
    }
    boolean isDark() { return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES; }
    @Override public void onConfigurationChanged(Configuration config) {
        super.onConfigurationChanged(config); if (backend != null) backend.setDark(isDark());
    }
    @Override public void save(String value) throws Exception { vault.write(value); }
    @Override public void changed(String value) {
        try { state = new JSONObject(value); } catch (Exception e) { return; }
        main.post(() -> {
            MainActivity current = activity.get(); if (current != null) current.receive(value);
            TileService.requestListeningState(this, new ComponentName(this, FoxTileService.class));
            FoxVpnService service = vpn; if (service != null) service.stateChanged();
        });
    }
    @Override public boolean protect(int fd) { FoxVpnService service = vpn; return service == null || service.protect(fd); }
    @Override public String dnsAddress() {
        LinkProperties links = physicalLinks;
        if (links == null || links.getDnsServers().isEmpty()) return "";
        return links.getDnsServers().get(0).getHostAddress();
    }
    @Override public String certificates() { return certificates == null ? "" : certificates; }
    static String loadCertificates() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidCAStore"); store.load(null);
        StringBuilder pem = new StringBuilder(); Enumeration<String> aliases = store.aliases();
        while (aliases.hasMoreElements()) {
            java.security.cert.Certificate cert = store.getCertificate(aliases.nextElement());
            if (cert != null) pem.append("-----BEGIN CERTIFICATE-----\n")
                .append(Base64.encodeToString(cert.getEncoded(), Base64.NO_WRAP)).append("\n-----END CERTIFICATE-----\n");
        }
        return pem.toString();
    }
    String connection() { return state.optString("connection", "disconnected"); }
    void stopVpn() {
        if (backend != null) backend.disconnect();
        FoxVpnService service = vpn; if (service != null) service.requestStop();
    }
}
