package fr.blanco.tv;

import android.content.*;

public class TickReceiver extends BroadcastReceiver {
  public void onReceive(Context c, Intent i) {
    try {
      c.startForegroundService(new Intent(c, SyncService.class));
    } catch (Exception ignored) {
    }
  }
}
