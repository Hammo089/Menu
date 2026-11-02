package fr.blanco.tv;

import android.app.*;
import android.content.*;
import android.os.*;
import java.util.concurrent.*;
import org.json.*;

public class SyncService extends Service {
  private ScheduledExecutorService worker;
  private final Handler main = new Handler(Looper.getMainLooper());

  public void onCreate() {
    super.onCreate();
    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    nm.createNotificationChannel(
        new NotificationChannel("blanco-tv", "Blanco TV", NotificationManager.IMPORTANCE_LOW));
    PendingIntent open =
        PendingIntent.getActivity(
            this,
            0,
            new Intent(this, MainActivity.class),
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    Notification n =
        new Notification.Builder(this, "blanco-tv")
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setContentTitle("Blanco TV")
            .setContentText("Écran du magasin · contenu et horaires")
            .setContentIntent(open)
            .build();
    startForeground(17, n);
    worker = Executors.newSingleThreadScheduledExecutor();
    worker.scheduleWithFixedDelay(this::tick, 0, 15, TimeUnit.SECONDS);
  }

  public int onStartCommand(Intent i, int flags, int id) {
    return START_STICKY;
  }

  public IBinder onBind(Intent i) {
    return null;
  }

  public void onDestroy() {
    if (worker != null) worker.shutdownNow();
    super.onDestroy();
  }

  private void tick() {
    Vault vault = RuntimeState.vault(this);
    try {
      JSONObject local = vault.read();
      if (local.optBoolean("revoked")) {
        RuntimeState.notifyUi(this);
        return;
      }
      if (local.optJSONObject("snapshot") == null) {
        JSONObject pair = Api.call("pair", new JSONObject().put("token", vault.token()));
        if (pair.optBoolean("revoked")) {
          vault.put("revoked", true);
          return;
        }
        if (pair.has("error")) throw new Exception(pair.optString("error"));
        if (pair.has("pairCode")) vault.put("pairCode", pair.getString("pairCode"));
      }
      JSONArray acks = local.optJSONArray("acks");
      if (acks == null) acks = new JSONArray();
      JSONObject response =
          Api.call(
              "sync",
              new JSONObject()
                  .put("token", vault.token())
                  .put("status", RuntimeState.status(this))
                  .put("acks", acks));
      if (response.optBoolean("revoked")) {
        vault.put("revoked", true);
        RuntimeState.online = true;
        RuntimeState.notifyUi(this);
        return;
      }
      if (response.has("error")) throw new Exception(response.optString("error"));
      RuntimeState.online = true;
      RuntimeState.connectionMessage = "";
      if (acks.length() > 0) vault.put("acks", new JSONArray());
      if (response.has("serverNow"))
        RuntimeState.clockOffset =
            java.time.Instant.parse(response.getString("serverNow")).toEpochMilli()
                - System.currentTimeMillis();
      if (response.optBoolean("paired")) {
        JSONObject snapshot = new JSONObject();
        for (String key : new String[] {"id", "name", "config", "pinAuth", "revision", "menu"})
          snapshot.put(key, response.opt(key));
        JSONObject previous = vault.read().optJSONObject("snapshot");
        if (previous == null || !previous.toString().equals(snapshot.toString())) {
          JSONObject oldPin = previous == null ? null : previous.optJSONObject("pinAuth");
          JSONObject newPin = snapshot.optJSONObject("pinAuth");
          if (oldPin != null
              && newPin != null
              && !oldPin.optString("hash").equals(newPin.optString("hash"))) {
            vault.put("pinFailures", 0);
            vault.put("pinLockedUntil", 0);
          }
          vault.put("snapshot", snapshot);
        }
        JSONArray commands = response.optJSONArray("commands");
        if (commands != null)
          for (int i = 0; i < commands.length(); i++) execute(commands.getJSONObject(i));
      }
    } catch (Exception e) {
      RuntimeState.online = false;
      RuntimeState.connectionMessage = "Hors ligne · dernier contenu conservé";
    } finally {
      RuntimeState.notifyUi(this);
      scheduleTick();
    }
  }

  private void scheduleTick() {
    try {
      AlarmManager alarm = (AlarmManager) getSystemService(ALARM_SERVICE);
      PendingIntent p =
          PendingIntent.getBroadcast(
              this,
              0,
              new Intent(this, TickReceiver.class),
              PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
      alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 60000, p);
    } catch (Exception ignored) {
    }
  }

  private void ack(String id, String result, String message) {
    try {
      Vault v = RuntimeState.vault(this);
      JSONArray a = v.read().optJSONArray("acks");
      if (a == null) a = new JSONArray();
      a.put(new JSONObject().put("id", id).put("result", result).put("message", message));
      v.put("acks", a);
    } catch (Exception ignored) {
    }
  }

  private void execute(JSONObject command) throws Exception {
    String id = command.getString("id"), kind = command.getString("kind");
    if (java.time.Instant.parse(command.getString("expiresAt")).toEpochMilli()
        <= RuntimeState.now()) return;
    Vault v = RuntimeState.vault(this);
    JSONArray old = v.read().optJSONArray("executed");
    if (old == null) old = new JSONArray();
    for (int i = 0; i < old.length(); i++) if (id.equals(old.optString(i))) return;
    JSONArray ids = new JSONArray();
    for (int i = Math.max(0, old.length() - 99); i < old.length(); i++) ids.put(old.get(i));
    ids.put(id);
    v.put("executed", ids);
    try {
      if (kind.equals("sleep")) {
        if (!RuntimeState.policy(this).isAdminActive(RuntimeState.admin(this))) {
          ack(id, "unsupported", "Administration de l’appareil non activée");
          return;
        }
        ack(id, "requested", "Mise en veille demandée ; vérifier l’état de la TV");
        RuntimeState.policy(this).lockNow();
      } else if (kind.equals("reboot")) {
        if (!RuntimeState.owner(this)) {
          ack(id, "unsupported", "Réservé au mode Device Owner");
          return;
        }
        ack(id, "requested", "Redémarrage Android demandé");
        RuntimeState.policy(this).reboot(RuntimeState.admin(this));
      } else if (kind.equals("wake")) {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        PowerManager.WakeLock lock =
            pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "Blanco:Wake");
        lock.acquire(2000);
        show();
        ack(id, "requested", "Réveil demandé ; dépend du modèle et de la veille");
      } else if (kind.equals("reload") || kind.equals("restart_app")) {
        main.post(
            () -> {
              MainActivity a = MainActivity.current();
              if (a != null) {
                if (kind.equals("restart_app")) a.recreate();
                else a.reload();
              } else show();
            });
        ack(id, "requested", "Demande transmise à l’application");
      } else ack(id, "unsupported", "Commande inconnue");
    } catch (Exception e) {
      ack(id, "failed", "Le système Android a refusé cette action");
    }
  }

  private void show() {
    try {
      RuntimeState.vault(this).put("maintenanceUntil", 0);
      startActivity(
          new Intent(this, MainActivity.class)
              .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP));
    } catch (Exception ignored) {
    }
  }
}
