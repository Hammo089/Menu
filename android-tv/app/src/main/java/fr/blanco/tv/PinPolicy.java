package fr.blanco.tv;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

public final class PinPolicy {
  public static String hex(byte[] bytes) {
    StringBuilder s = new StringBuilder();
    for (byte b : bytes) s.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
    return s.toString();
  }

  public static byte[] unhex(String s) {
    if (s == null || (s.length() % 2) != 0 || !s.matches("[a-f0-9]+"))
      throw new IllegalArgumentException("Invalid hex");
    byte[] out = new byte[s.length() / 2];
    for (int i = 0; i < out.length; i++)
      out[i] = (byte) Integer.parseInt(s.substring(i * 2, i * 2 + 2), 16);
    return out;
  }

  public static String randomToken() {
    byte[] b = new byte[32];
    new SecureRandom().nextBytes(b);
    return hex(b);
  }

  public static String sha256(String text) {
    try {
      return hex(
          MessageDigest.getInstance("SHA-256")
              .digest(text.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public static boolean verify(char[] pin, String salt, String expected, int iterations) {
    try {
      if (pin.length < 6
          || pin.length > 12
          || iterations != 210000
          || salt.length() != 32
          || expected.length() != 64) return false;
      PBEKeySpec spec = new PBEKeySpec(pin, unhex(salt), iterations, 256);
      byte[] out =
          SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
      spec.clearPassword();
      boolean ok = MessageDigest.isEqual(out, unhex(expected));
      Arrays.fill(out, (byte) 0);
      return ok;
    } catch (Exception e) {
      return false;
    } finally {
      Arrays.fill(pin, '\0');
    }
  }

  public static long lockUntil(int failures, long now) {
    return failures > 0 && failures % 5 == 0
        ? now + Math.min(1800000L, 60000L * (failures / 5))
        : 0;
  }

  private PinPolicy() {}
}
