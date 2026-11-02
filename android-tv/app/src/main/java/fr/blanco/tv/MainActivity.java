package fr.blanco.tv;

import android.app.*;
import android.app.admin.*;
import android.content.*;
import android.graphics.*;
import android.os.*;
import android.text.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.io.*;
import java.lang.ref.WeakReference;
import java.util.concurrent.*;
import org.json.*;

public class MainActivity extends Activity {
  private static WeakReference<MainActivity> ref = new WeakReference<>(null);

  public static MainActivity current() {
    return ref.get();
  }

  private FrameLayout root, player;
  private TextView black, message;
  private WebView web;
  private VideoView video;
  private ImageView image;
  private Vault vault;
  private MediaCache cache;
  private final Handler ui = new Handler(Looper.getMainLooper());
  private final ExecutorService io = Executors.newSingleThreadExecutor();
  private final ExecutorService mediaIo = Executors.newSingleThreadExecutor();
  private Future<?> download;
  private boolean forceMedia = false;
  private String signature = "", itemKey = "", shownSetup = "";
  private int sequence = 0, item = 0;
  private boolean showingBlack = false, offlineMenu = false, lastOnline = false, manager = false;
  private Runnable next;
  private AlertDialog pinDialog;
  private final BroadcastReceiver state =
      new BroadcastReceiver() {
        public void onReceive(Context c, Intent i) {
          refresh();
        }
      };

  public void onCreate(Bundle s) {
    super.onCreate(s);
    ref = new WeakReference<>(this);
    vault = RuntimeState.vault(this);
    cache = new MediaCache(this);
    getWindow()
        .setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
    getWindow().getDecorView().setSystemUiVisibility(5894);
    if (Build.VERSION.SDK_INT >= 27) {
      setShowWhenLocked(true);
      setTurnScreenOn(true);
    }
    root = new FrameLayout(this);
    root.setBackgroundColor(Color.BLACK);
    setContentView(root);
    player = new FrameLayout(this);
    root.addView(player, new FrameLayout.LayoutParams(-1, -1));
    black = text("", 24, Color.WHITE);
    black.setBackgroundColor(Color.BLACK);
    root.addView(black, new FrameLayout.LayoutParams(-1, -1));
    View corner = new View(this);
    FrameLayout.LayoutParams hotspot =
        new FrameLayout.LayoutParams(dp(100), dp(100), Gravity.TOP | Gravity.LEFT);
    root.addView(corner, hotspot);
    corner.setOnLongClickListener(
        v -> {
          askPin();
          return true;
        });
    corner.setFocusable(false);
    if (Build.VERSION.SDK_INT >= 33)
      registerReceiver(state, new IntentFilter(Config.STATE), Context.RECEIVER_NOT_EXPORTED);
    else registerReceiver(state, new IntentFilter(Config.STATE));
    startForegroundService(new Intent(this, SyncService.class));
    refresh();
  }

  protected void onDestroy() {
    unregisterReceiver(state);
    if (next != null) ui.removeCallbacks(next);
    if (pinDialog != null) pinDialog.dismiss();
    if (web != null) web.destroy();
    if (video != null) video.stopPlayback();
    io.shutdownNow();
    mediaIo.shutdownNow();
    if (current() == this) ref.clear();
    super.onDestroy();
  }

  protected void onResume() {
    super.onResume();
    getWindow().getDecorView().setSystemUiVisibility(5894);
    if (!manager) refresh();
  }

  public void onBackPressed() {
    askPin();
  }

  public boolean onKeyLongPress(int key, android.view.KeyEvent e) {
    if (key == android.view.KeyEvent.KEYCODE_MENU || key == android.view.KeyEvent.KEYCODE_BACK) {
      askPin();
      return true;
    }
    return super.onKeyLongPress(key, e);
  }

  private int dp(int n) {
    return Math.round(n * getResources().getDisplayMetrics().density);
  }

  private TextView text(String s, int size, int color) {
    TextView t = new TextView(this);
    t.setText(s);
    t.setTextSize(size);
    t.setTextColor(color);
    t.setGravity(Gravity.CENTER);
    return t;
  }

  private Button button(String s, Runnable run) {
    Button b = new Button(this);
    b.setText(s);
    b.setAllCaps(false);
    b.setOnClickListener(v -> run.run());
    return b;
  }

  private void clearPlayer() {
    sequence++;
    if (download != null) {
      download.cancel(true);
      download = null;
    }
    if (next != null) {
      ui.removeCallbacks(next);
      next = null;
    }
    if (video != null) {
      video.stopPlayback();
      video = null;
    }
    if (web != null) {
      web.destroy();
      web = null;
    }
    image = null;
    player.removeAllViews();
  }

  private void setup(String title, String subtitle, String code) {
    String key = title + subtitle + code;
    if (key.equals(shownSetup)) return;
    shownSetup = key;
    clearPlayer();
    LinearLayout panel = new LinearLayout(this);
    panel.setOrientation(LinearLayout.VERTICAL);
    panel.setGravity(Gravity.CENTER);
    panel.setPadding(dp(45), dp(25), dp(45), dp(25));
    panel.setBackgroundColor(Color.rgb(247, 246, 242));
    player.addView(panel, new FrameLayout.LayoutParams(-1, -1));
    panel.addView(text("Blanco TV", 36, Color.rgb(30, 60, 46)));
    panel.addView(text(title, 23, Color.rgb(30, 60, 46)));
    if (!code.isEmpty()) {
      TextView number = text(code, 48, Color.rgb(30, 60, 46));
      number.setTextIsSelectable(true);
      panel.addView(number);
      if (code.matches("[A-F0-9]{10}")) {
        try {
          web = new WebView(this);
          web.setBackgroundColor(Color.TRANSPARENT);
          web.getSettings().setJavaScriptEnabled(true);
          web.getSettings().setAllowFileAccess(false);
          web.getSettings().setAllowContentAccess(false);
          web.getSettings().setBlockNetworkLoads(true);
          web.setWebViewClient(
              new WebViewClient() {
                public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                  return true;
                }
              });
          panel.addView(web, new LinearLayout.LayoutParams(dp(190), dp(190)));
          web.loadUrl("file:///android_asset/pairing.html#" + code);
        } catch (Exception unavailable) {
          panel.addView(
              text("Scannez indisponible : saisissez le code ci-dessus.", 16, Color.DKGRAY));
        }
      }
    }
    panel.addView(text(subtitle, 18, Color.DKGRAY));
    panel.addView(
        button(
            "Actualiser / تحديث",
            () -> {
              shownSetup = "";
              refresh();
            }));
    panel.addView(button("Sortie / خروج", this::askPin));
  }

  private void refresh() {
    if (manager) return;
    JSONObject local = vault.read(), snapshot = local.optJSONObject("snapshot");
    if (local.optBoolean("revoked")) {
      black.setVisibility(View.GONE);
      setup(
          "Accès révoqué / تم إلغاء الربط",
          "Utilisez le code de sortie pour réassocier l’écran.",
          "");
      return;
    }
    if (snapshot == null) {
      black.setVisibility(View.GONE);
      String code = local.optString("pairCode", "…");
      setup(
          "Associez cet écran / ربط الشاشة",
          Config.SITE
              + "/admin/screens\n"
              + "Saisissez ce code et choisissez le code de sortie.\n"
              + "رمز الاقتران صالح ١٥ دقيقة؛ يتجدد تلقائيًا.",
          code);
      return;
    }
    shownSetup = "";
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    enableKiosk();
    boolean open = RuntimeState.open(this);
    if (!open) {
      if (next != null) {
        ui.removeCallbacks(next);
        next = null;
      }
      black.setVisibility(View.VISIBLE);
      showingBlack = true;
      getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
      if (video != null && video.isPlaying()) video.pause();
      return;
    }
    black.setVisibility(View.GONE);
    JSONObject cfg = snapshot.optJSONObject("config");
    if (cfg == null) return;
    String sig =
        snapshot.optInt("revision")
            + "/"
            + PinPolicy.sha256(
                snapshot.optJSONObject("menu") == null
                    ? ""
                    : snapshot.optJSONObject("menu").toString());
    boolean reconnect = offlineMenu && RuntimeState.online && !lastOnline;
    lastOnline = RuntimeState.online;
    if (!signature.equals(sig) || showingBlack || reconnect) {
      signature = sig;
      showingBlack = false;
      item = 0;
      play(forceMedia);
      forceMedia = false;
    }
  }

  private void enableKiosk() {
    try {
      ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
      if (am.getLockTaskModeState() == ActivityManager.LOCK_TASK_MODE_LOCKED) return;
      if (RuntimeState.owner(this)) {
        DevicePolicyManager p = RuntimeState.policy(this);
        p.setLockTaskPackages(RuntimeState.admin(this), new String[] {getPackageName()});
        if (Build.VERSION.SDK_INT >= 28) p.setLockTaskFeatures(RuntimeState.admin(this), 0);
        startLockTask();
      }
    } catch (Exception ignored) {
    }
  }

  public void reload() {
    signature = "";
    manager = false;
    forceMedia = true;
    refresh();
  }

  private void play(boolean refreshCache) {
    if (manager || !RuntimeState.open(this)) return;
    JSONObject snapshot = vault.read().optJSONObject("snapshot");
    if (snapshot == null) return;
    JSONObject cfg = snapshot.optJSONObject("config");
    if (cfg == null) return;
    String mode = cfg.optString("mode", "menu");
    clearPlayer();
    offlineMenu = false;
    RuntimeState.cachedMenu = false;
    RuntimeState.playbackError = "";
    if (mode.equals("menu")) {
      String url =
          Config.SITE
              + "/tv?managed=1&orientation="
              + cfg.optString("orientation", "portrait")
              + "&rotation="
              + cfg.optInt("rotation", 0);
      showWeb(url, true);
      return;
    }
    if (mode.equals("url")) {
      showWeb(cfg.optString("url"), false);
      return;
    }
    JSONArray items = cfg.optJSONArray("items");
    if (items == null || items.length() == 0) {
      showMessage("Aucun contenu programmé / لا يوجد محتوى");
      return;
    }
    item %= items.length();
    JSONObject entry = items.optJSONObject(item);
    if (entry == null) return;
    String type = entry.optString("type"), url = entry.optString("url");
    itemKey = url;
    int ticket = sequence;
    int duration = Math.max(5, Math.min(3600, entry.optInt("duration", 10)));
    next =
        () -> {
          item++;
          play(false);
        };
    ui.postDelayed(next, duration * 1000L);
    if (type.equals("url")) {
      showWeb(url, false);
      return;
    }
    showMessage("Chargement… / جارٍ التحميل");
    download =
        mediaIo.submit(
            () -> {
              try {
                File file = cache.get(url, refreshCache);
                ui.post(
                    () -> {
                      if (ticket != sequence || !url.equals(itemKey) || manager || showingBlack)
                        return;
                      player.removeAllViews();
                      if (type.equals("video")) {
                        video = new VideoView(this);
                        player.addView(video, new FrameLayout.LayoutParams(-1, -1, Gravity.CENTER));
                        video.setVideoPath(file.getAbsolutePath());
                        video.setOnCompletionListener(
                            v -> {
                              if (next != null) ui.removeCallbacks(next);
                              item++;
                              play(false);
                            });
                        video.setOnErrorListener(
                            (v, w, e) -> {
                              showMessage("Vidéo non prise en charge / صيغة فيديو غير مدعومة");
                              return true;
                            });
                        video.setOnPreparedListener(
                            v -> {
                              if (!showingBlack) video.start();
                            });
                      } else {
                        try {
                          BitmapFactory.Options o = new BitmapFactory.Options();
                          o.inJustDecodeBounds = true;
                          BitmapFactory.decodeFile(file.getAbsolutePath(), o);
                          o.inSampleSize = 1;
                          while (o.outWidth / o.inSampleSize > 3840
                              || o.outHeight / o.inSampleSize > 2160) o.inSampleSize *= 2;
                          o.inJustDecodeBounds = false;
                          Bitmap bitmap = BitmapFactory.decodeFile(file.getAbsolutePath(), o);
                          if (bitmap == null) throw new IOException();
                          image = new ImageView(this);
                          image.setScaleType(ImageView.ScaleType.FIT_CENTER);
                          image.setImageBitmap(bitmap);
                          player.addView(image, new FrameLayout.LayoutParams(-1, -1));
                        } catch (Exception e) {
                          showMessage("Image indisponible / الصورة غير متاحة");
                        }
                      }
                    });
              } catch (Exception e) {
                ui.post(
                    () -> {
                      if (ticket == sequence)
                        showMessage(
                            "Contenu indisponible hors ligne ou fichier supérieur à 25Mo / المحتوى"
                                + " غير متاح");
                    });
              }
            });
  }

  private void showMessage(String msg) {
    if (!msg.startsWith("Chargement")) RuntimeState.playbackError = msg;
    player.removeAllViews();
    message = text(msg, 21, Color.WHITE);
    message.setPadding(dp(35), dp(20), dp(35), dp(20));
    player.addView(message, new FrameLayout.LayoutParams(-1, -1));
  }

  private void showWeb(String url, boolean menu) {
    if (!Api.https(url)) {
      showMessage("Lien HTTPS requis / رابط غير صالح");
      return;
    }
    try {
      web = new WebView(this);
    } catch (Exception unsupported) {
      showMessage(
          "Android System WebView indisponible. Images et vidéos restent utilisables. / WebView غير"
              + " متوفر");
      return;
    }
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setAllowFileAccess(false);
    s.setAllowContentAccess(false);
    s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setSafeBrowsingEnabled(true);
    s.setSupportMultipleWindows(false);
    s.setCacheMode(WebSettings.LOAD_DEFAULT);
    web.setWebChromeClient(
        new WebChromeClient() {
          public void onPermissionRequest(PermissionRequest r) {
            r.deny();
          }
        });
    web.setDownloadListener((u, a, d, m, n) -> {});
    web.setWebViewClient(
        new WebViewClient() {
          public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
            return !Api.https(r.getUrl().toString());
          }

          public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
            if (r.isForMainFrame()) {
              if (menu) loadOffline();
              else showMessage("Page indisponible hors ligne / الصفحة تحتاج إنترنت");
            }
          }

          public void onPageFinished(WebView v, String u) {
            if (offlineMenu) applyOffline(v);
          }
        });
    player.removeAllViews();
    player.addView(web, new FrameLayout.LayoutParams(-1, -1));
    web.loadUrl(url);
  }

  private String asset(String name) throws IOException {
    try (InputStream in = getAssets().open(name);
        ByteArrayOutputStream out = new ByteArrayOutputStream()) {
      byte[] b = new byte[8192];
      int n;
      while ((n = in.read(b)) != -1) out.write(b, 0, n);
      return out.toString("UTF-8");
    }
  }

  private void loadOffline() {
    if (web == null || offlineMenu) return;
    offlineMenu = true;
    RuntimeState.cachedMenu = true;
    try {
      web.loadDataWithBaseURL(
          "https://offline.blanco.invalid/",
          asset("offline-menu.html"),
          "text/html",
          "UTF-8",
          null);
    } catch (Exception e) {
      showMessage("Menu hors ligne indisponible / المنيو غير متاحة");
    }
  }

  private void applyOffline(WebView view) {
    JSONObject snapshot = vault.read().optJSONObject("snapshot");
    if (snapshot == null) return;
    JSONObject cfg = snapshot.optJSONObject("config"), menu = snapshot.optJSONObject("menu");
    if (menu == null || cfg == null) return;
    view.evaluateJavascript(
        "window.setMenu("
            + JSONObject.quote(menu.toString())
            + ","
            + JSONObject.quote(cfg.optString("orientation", "portrait"))
            + ","
            + cfg.optInt("rotation", 0)
            + ")",
        null);
  }

  private void askPin() {
    if (pinDialog != null && pinDialog.isShowing()) return;
    JSONObject local = vault.read();
    JSONObject snapshot = local.optJSONObject("snapshot");
    if (snapshot == null) {
      finish();
      return;
    }
    long lockedUntil = local.optLong("pinLockedUntil");
    if (lockedUntil > System.currentTimeMillis()) {
      Toast.makeText(
              this,
              "Patientez / انتظر "
                  + Math.max(1, (lockedUntil - System.currentTimeMillis()) / 1000)
                  + "s",
              Toast.LENGTH_LONG)
          .show();
      return;
    }
    EditText field = new EditText(this);
    field.setInputType(
        android.text.InputType.TYPE_CLASS_NUMBER
            | android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD);
    field.setFilters(new InputFilter[] {new InputFilter.LengthFilter(12)});
    field.setSingleLine(true);
    field.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
    field.setHint("6–12 chiffres / أرقام");
    LinearLayout box = new LinearLayout(this);
    box.setPadding(dp(28), dp(10), dp(28), dp(10));
    box.addView(field, new LinearLayout.LayoutParams(-1, -2));
    pinDialog =
        new AlertDialog.Builder(this)
            .setTitle("Code de sortie / كود الخروج")
            .setMessage("Saisissez le code administrateur, même hors ligne.")
            .setView(box)
            .setNegativeButton("Annuler / إلغاء", (d, w) -> {})
            .setPositiveButton("Ouvrir / فتح", null)
            .create();
    pinDialog.setOnShowListener(
        d ->
            pinDialog
                .getButton(AlertDialog.BUTTON_POSITIVE)
                .setOnClickListener(
                    v -> {
                      String raw = field.getText().toString();
                      field.setText("");
                      if (!raw.matches("[0-9]{6,12}")) {
                        field.setError("6–12 chiffres");
                        return;
                      }
                      JSONObject fresh = vault.read().optJSONObject("snapshot");
                      JSONObject auth = fresh == null ? null : fresh.optJSONObject("pinAuth");
                      if (auth == null) return;
                      Button positive = pinDialog.getButton(AlertDialog.BUTTON_POSITIVE);
                      positive.setEnabled(false);
                      char[] digits = raw.toCharArray();
                      io.execute(
                          () -> {
                            boolean ok =
                                PinPolicy.verify(
                                    digits,
                                    auth.optString("salt"),
                                    auth.optString("hash"),
                                    auth.optInt("iterations"));
                            ui.post(
                                () -> {
                                  if (isDestroyed() || isFinishing()) return;
                                  positive.setEnabled(true);
                                  JSONObject latest = vault.read().optJSONObject("snapshot");
                                  JSONObject currentAuth =
                                      latest == null ? null : latest.optJSONObject("pinAuth");
                                  boolean unchanged =
                                      currentAuth != null
                                          && auth.optString("hash")
                                              .equals(currentAuth.optString("hash"));
                                  if (ok && unchanged) {
                                    vault.put("pinFailures", 0);
                                    vault.put("pinLockedUntil", 0);
                                    pinDialog.dismiss();
                                    openManager();
                                  } else {
                                    int attempts = vault.read().optInt("pinFailures") + 1;
                                    vault.put("pinFailures", attempts);
                                    if (attempts % 5 == 0) {
                                      vault.put(
                                          "pinLockedUntil",
                                          PinPolicy.lockUntil(
                                              attempts, System.currentTimeMillis()));
                                      pinDialog.dismiss();
                                    } else field.setError("Code incorrect / الكود غير صحيح");
                                  }
                                });
                          });
                    }));
    pinDialog.show();
    if (pinDialog.getWindow() != null)
      pinDialog.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
  }

  private void openManager() {
    manager = true;
    ui.postDelayed(
        () -> {
          if (manager && !isDestroyed()) {
            manager = false;
            signature = "";
            vault.put("maintenanceUntil", 0);
            refresh();
          }
        },
        15 * 60 * 1000L);
    if (next != null) ui.removeCallbacks(next);
    if (video != null) video.pause();
    try {
      stopLockTask();
    } catch (Exception ignored) {
    }
    vault.put("maintenanceUntil", System.currentTimeMillis() + 15 * 60 * 1000L);
    black.setVisibility(View.GONE);
    clearPlayer();
    LinearLayout panel = new LinearLayout(this);
    panel.setOrientation(LinearLayout.VERTICAL);
    panel.setGravity(Gravity.CENTER);
    panel.setPadding(dp(30), dp(15), dp(30), dp(15));
    panel.setBackgroundColor(Color.rgb(247, 246, 242));
    player.addView(panel, new FrameLayout.LayoutParams(-1, -1));
    panel.addView(text("Blanco TV · Administration", 28, Color.rgb(30, 60, 46)));
    panel.addView(
        text(
            RuntimeState.owner(this)
                ? "Kiosque administré / وضع مُدار"
                : "Mode affichage : Home et les réglages système peuvent permettre de sortir.\n"
                    + "قفل كامل غير مضمون بدون إدارة الجهاز.",
            16,
            Color.DKGRAY));
    panel.addView(
        button(
            "Reprendre le kiosque / العودة للعرض",
            () -> {
              manager = false;
              signature = "";
              vault.put("maintenanceUntil", 0);
              refresh();
            }));
    panel.addView(
        button(
            "Paramètres Android / إعدادات أندرويد",
            () -> {
              try {
                startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS));
              } catch (Exception e) {
                Toast.makeText(this, "Indisponible", Toast.LENGTH_SHORT).show();
              }
            }));
    panel.addView(
        button(
            "Choisir l’écran d’accueil / اختيار الواجهة",
            () -> {
              try {
                startActivity(new Intent(android.provider.Settings.ACTION_HOME_SETTINGS));
              } catch (Exception e) {
                Toast.makeText(
                        this, "À configurer selon le modèle / حسب الموديل", Toast.LENGTH_LONG)
                    .show();
              }
            }));
    panel.addView(
        button(
            "Autoriser la veille de l’appareil / صلاحية السكون",
            () -> {
              Intent i = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
              i.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, RuntimeState.admin(this));
              i.putExtra(
                  DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                  "Autorise uniquement le verrouillage demandé depuis votre administration"
                      + " Blanco.");
              try {
                startActivity(i);
              } catch (Exception e) {
                Toast.makeText(this, "Non pris en charge", Toast.LENGTH_LONG).show();
              }
            }));
    panel.addView(
        button(
            "Réassocier cet écran / إعادة ربط الشاشة",
            () ->
                new AlertDialog.Builder(this)
                    .setTitle("Réassocier ? / إعادة الربط؟")
                    .setMessage(
                        "La configuration locale sera effacée. Révoquez aussi l’ancienne entrée"
                            + " dans l’administration.")
                    .setNegativeButton("Annuler", null)
                    .setPositiveButton(
                        "Réassocier",
                        (d, w) -> {
                          vault.reset();
                          manager = false;
                          signature = "";
                          shownSetup = "";
                          stopService(new Intent(this, SyncService.class));
                          startForegroundService(new Intent(this, SyncService.class));
                          refresh();
                        })
                    .show()));
  }
}
