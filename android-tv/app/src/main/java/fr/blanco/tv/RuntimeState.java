package fr.blanco.tv;

import android.app.admin.*;
import android.content.*;
import android.content.pm.*;
import android.os.*;
import org.json.*;

final class RuntimeState {
  static volatile String playbackError = "";
  static volatile boolean cachedMenu = false;
  static volatile Vault vault;
  static volatile boolean online = false;
  static volatile String connectionMessage = "";
  static volatile long clockOffset = 0;

  static synchronized Vault vault(Context c) {
    if (vault == null) vault = new Vault(c.getApplicationContext());
    return vault;
  }

  static ComponentName admin(Context c) {
    return new ComponentName(c, AdminReceiver.class);
  }

  static DevicePolicyManager policy(Context c) {
    return (DevicePolicyManager) c.getSystemService(Context.DEVICE_POLICY_SERVICE);
  }

  static boolean owner(Context c) {
    return policy(c).isDeviceOwnerApp(c.getPackageName());
  }

  static boolean home(Context c) {
    Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
    ResolveInfo r = c.getPackageManager().resolveActivity(i, PackageManager.MATCH_DEFAULT_ONLY);
    return r != null && c.getPackageName().equals(r.activityInfo.packageName);
  }

  static long now() {
    return System.currentTimeMillis() + clockOffset;
  }

  static boolean open(Context c) {
    try {
      JSONObject data = vault(c).read(), s = data.optJSONObject("snapshot");
      if (s == null || data.optBoolean("revoked")) return false;
      JSONObject cfg = s.getJSONObject("config"), schedule = cfg.getJSONObject("schedule");
      java.util.List<SchedulePolicy.Window> days = new java.util.ArrayList<>();
      JSONArray array = schedule.getJSONArray("days");
      for (int i = 0; i < array.length(); i++) {
        JSONObject d = array.getJSONObject(i);
        days.add(
            new SchedulePolicy.Window(
                d.getInt("day"),
                d.getBoolean("enabled"),
                d.getString("start"),
                d.getString("end")));
      }
      return SchedulePolicy.open(
          cfg.optString("override", "auto"),
          schedule.optBoolean("enabled"),
          days,
          java.time.Instant.ofEpochMilli(now()).atZone(java.time.ZoneOffset.UTC));
    } catch (Exception e) {
      return false;
    }
  }

  static void notifyUi(Context c) {
    c.sendBroadcast(new Intent(Config.STATE).setPackage(c.getPackageName()));
  }

  static JSONObject status(Context c) throws JSONException {
    return new JSONObject()
        .put("contentError", playbackError)
        .put("cachedMenu", cachedMenu)
        .put("model", Build.MODEL)
        .put("manufacturer", Build.MANUFACTURER)
        .put("osVersion", Build.VERSION.RELEASE)
        .put("sdk", Build.VERSION.SDK_INT)
        .put("appVersion", "1.0.0-pilot")
        .put("deviceOwner", owner(c))
        .put("defaultHome", home(c))
        .put("canSleep", policy(c).isAdminActive(admin(c)))
        .put("wakeGuaranteed", false)
        .put("webViewAvailable", android.webkit.WebView.getCurrentWebViewPackage() != null)
        .put("screenOn", ((PowerManager) c.getSystemService(Context.POWER_SERVICE)).isInteractive())
        .put("blackScreen", !open(c))
        .put(
            "maintenance",
            vault(c).read().optLong("maintenanceUntil") > System.currentTimeMillis());
  }
}
