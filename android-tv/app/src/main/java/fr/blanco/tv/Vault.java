package fr.blanco.tv;

import android.content.*;
import android.security.keystore.*;
import android.util.Base64;
import java.security.KeyStore;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import org.json.*;

final class Vault {
  private static final String ALIAS = "blanco-tv-device-v1";
  private final SharedPreferences prefs;
  private JSONObject state;

  Vault(Context c) {
    prefs = c.getSharedPreferences("blanco-device", Context.MODE_PRIVATE);
    try {
      String raw = prefs.getString("sealed", "");
      if (raw.isEmpty()) state = new JSONObject();
      else {
        String[] parts = raw.split("\\.");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(
            Cipher.DECRYPT_MODE,
            key(),
            new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
        state =
            new JSONObject(
                new String(
                    cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)),
                    java.nio.charset.StandardCharsets.UTF_8));
      }
    } catch (Exception e) {
      state = new JSONObject();
    }
  }

  private javax.crypto.SecretKey key() throws Exception {
    KeyStore store = KeyStore.getInstance("AndroidKeyStore");
    store.load(null);
    if (!store.containsAlias(ALIAS)) {
      KeyGenerator gen =
          KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
      gen.init(
          new KeyGenParameterSpec.Builder(
                  ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
              .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
              .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
              .build());
      return gen.generateKey();
    }
    return (javax.crypto.SecretKey) store.getKey(ALIAS, null);
  }

  synchronized JSONObject read() {
    try {
      return new JSONObject(state.toString());
    } catch (JSONException e) {
      return new JSONObject();
    }
  }

  synchronized void put(String name, Object value) {
    try {
      state.put(name, value);
      save();
    } catch (Exception e) {
      throw new IllegalStateException("Stockage sécurisé indisponible", e);
    }
  }

  private void save() throws Exception {
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.ENCRYPT_MODE, key());
    byte[] out = cipher.doFinal(state.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
    if (!prefs
        .edit()
        .putString(
            "sealed",
            Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
                + "."
                + Base64.encodeToString(out, Base64.NO_WRAP))
        .commit()) throw new IllegalStateException("Storage failed");
  }

  synchronized String token() {
    String t = state.optString("token", "");
    if (!t.matches("[a-f0-9]{64}")) {
      t = PinPolicy.randomToken();
      put("token", t);
    }
    return t;
  }

  synchronized void reset() {
    state = new JSONObject();
    try {
      save();
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }
}
