package fr.blanco.tv;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import org.json.JSONObject;

/** Launch only on a genuine system boot; never replace Home or relaunch on app updates. */
public class BootReceiver extends BroadcastReceiver {
  public void onReceive(Context context, Intent intent) {
    if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
    try {
      Vault vault = RuntimeState.vault(context);
      JSONObject state = vault.read();
      if (!state.optBoolean("autoStart", true) || state.optBoolean("revoked")) return;
      vault.put("ownerExited", false);
      vault.put("maintenanceUntil", 0);
      vault.put("lastBootLaunch", "requested");
      context.startActivity(
          new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    } catch (Exception denied) {
      try {
        RuntimeState.vault(context).put("lastBootLaunch", "blocked");
      } catch (Exception ignored) {
      }
    }
  }
}
