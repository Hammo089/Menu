package fr.blanco.tv;

import android.content.Context;
import java.io.*;
import java.net.*;
import java.util.*;

final class MediaCache {
  private final File root;

  MediaCache(Context c) {
    root = new File(c.getFilesDir(), "media");
    root.mkdirs();
  }

  File get(String url, boolean refresh) throws Exception {
    if (!Api.https(url)) throw new IOException("Lien HTTPS requis");
    File target = new File(root, PinPolicy.sha256(url));
    if (target.isFile() && !refresh) {
      target.setLastModified(System.currentTimeMillis());
      return target;
    }
    File temp = new File(root, target.getName() + ".part");
    try {
      String current = url;
      for (int hop = 0; hop < 4; hop++) {
        if (!Api.https(current)) throw new IOException("Redirection non sécurisée");
        javax.net.ssl.HttpsURLConnection c =
            (javax.net.ssl.HttpsURLConnection) new URL(current).openConnection();
        c.setInstanceFollowRedirects(false);
        c.setConnectTimeout(9000);
        c.setReadTimeout(15000);
        try {
          int code = c.getResponseCode();
          if (code >= 300 && code < 400) {
            String next = c.getHeaderField("Location");
            if (next == null) throw new IOException("Redirection invalide");
            current = new URL(new URL(current), next).toString();
            continue;
          }
          if (code != 200) throw new IOException("Téléchargement indisponible");
          if (c.getContentLengthLong() > 25L * 1024 * 1024)
            throw new IOException("Fichier supérieur à 25Mo");
          try (InputStream in = c.getInputStream();
              OutputStream out = new FileOutputStream(temp)) {
            byte[] buf = new byte[32768];
            int n;
            long total = 0;
            while ((n = in.read(buf)) != -1) {
              total += n;
              if (total > 25L * 1024 * 1024 || Thread.currentThread().isInterrupted())
                throw new IOException("Téléchargement interrompu");
              out.write(buf, 0, n);
            }
          }
          if (!temp.renameTo(target)) {
            if (target.exists()) target.delete();
            if (!temp.renameTo(target)) throw new IOException("Cache indisponible");
          }
          trim(target);
          return target;
        } finally {
          c.disconnect();
        }
      }
      throw new IOException("Trop de redirections");
    } catch (Exception e) {
      temp.delete();
      if (target.isFile()) return target;
      throw e;
    }
  }

  private void trim(File keep) {
    File[] files = root.listFiles();
    if (files == null) return;
    Arrays.sort(files, Comparator.comparingLong(File::lastModified));
    long total = 0;
    for (File f : files) total += f.length();
    for (File f : files)
      if (total > 200L * 1024 * 1024 && !f.equals(keep)) {
        long size = f.length();
        if (f.delete()) total -= size;
      }
  }
}
