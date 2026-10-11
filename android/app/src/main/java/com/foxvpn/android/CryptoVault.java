// SPDX-License-Identifier: GPL-3.0-or-later
package com.foxvpn.android;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileOutputStream;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class CryptoVault {
    private static final String ALIAS = "foxvpn.session.v1";
    private final AtomicFile file;
    CryptoVault(Context context) { file = new AtomicFile(new File(context.getFilesDir(), "session.enc")); }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias(ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true).build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(ALIAS, null);
    }
    synchronized String read() throws Exception {
        if (!file.getBaseFile().exists()) return "{}";
        byte[] packet = file.readFully();
        if (packet.length < 29 || packet[0] != 1) throw new Exception("Invalid encrypted session file");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Arrays.copyOfRange(packet, 1, 13)));
        return new String(cipher.doFinal(packet, 13, packet.length - 13), java.nio.charset.StandardCharsets.UTF_8);
    }
    synchronized void write(String value) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
        byte[] encrypted = cipher.doFinal(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        FileOutputStream stream = null;
        try {
            stream = file.startWrite(); stream.write(1); stream.write(cipher.getIV()); stream.write(encrypted); file.finishWrite(stream);
        } catch (Exception e) { if (stream != null) file.failWrite(stream); throw e; }
    }
}
