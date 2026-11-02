package fr.blanco.tv;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import org.json.*;

final class Api {
  static JSONObject call(String action, JSONObject payload) throws Exception {
    javax.net.ssl.HttpsURLConnection c =
        (javax.net.ssl.HttpsURLConnection) new URL(Config.API).openConnection();
    c.setConnectTimeout(12000);
    c.setReadTimeout(15000);
    c.setRequestMethod("POST");
    c.setRequestProperty("apikey", Config.PUBLIC_KEY);
    c.setRequestProperty("Content-Type", "application/json");
    c.setDoOutput(true);
    try {
      JSONObject request = new JSONObject().put("action", action).put("payload", payload);
      try (OutputStream out = c.getOutputStream()) {
        out.write(request.toString().getBytes(StandardCharsets.UTF_8));
      }
      int code = c.getResponseCode();
      InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
      if (in == null) throw new IOException("Connexion indisponible");
      ByteArrayOutputStream bytes = new ByteArrayOutputStream();
      byte[] buf = new byte[8192];
      int n;
      while ((n = in.read(buf)) != -1) {
        if (bytes.size() + n > 2000000) throw new IOException("Réponse trop volumineuse");
        bytes.write(buf, 0, n);
      }
      in.close();
      JSONObject result = new JSONObject(bytes.toString("UTF-8"));
      if (code >= 400) throw new IOException(result.optString("message", "Serveur indisponible"));
      return result;
    } finally {
      c.disconnect();
    }
  }

  static boolean https(String u) {
    try {
      URL x = new URL(u);
      return x.getProtocol().equals("https") && x.getHost().length() > 0 && x.getUserInfo() == null;
    } catch (Exception e) {
      return false;
    }
  }
}
