package fr.blanco.tv;

import android.content.*;

public class BootReceiver extends BroadcastReceiver {
  public void onReceive(Context c, Intent i) {
    try {
      c.startForegroundService(new Intent(c, SyncService.class));
      if (RuntimeState.owner(c))
        c.startActivity(new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    } catch (Exception ignored) {
    }
  }
}
