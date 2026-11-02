import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Monitor, Plus, RefreshCw, LogOut, ArrowLeft, ShieldCheck, Download } from 'lucide-react';
import { supabase } from '../lib';
import {
  defaultConfig,
  exitPinHash,
  tvRpc,
  scheduleOpen,
  type TVConfig,
  type TVDevice,
  type TVCommand,
} from './lib';
import './screens.css';
type Translate = (ar: string, fr: string) => string;
const APK =
  'https://raw.githubusercontent.com/Hammo089/Menu/main/android-tv/dist/blanco-tv-pilot.apk';
const daysAr = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];
const daysFr = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export default function ScreensAdmin() {
  const [lang, setLang] = useState<'ar' | 'fr'>(() =>
    localStorage.getItem('blanco-screens-lang') === 'fr' ? 'fr' : 'ar',
  );
  const l: Translate = (ar, fr) => (lang === 'ar' ? ar : fr);
  const [signed, setSigned] = useState<boolean | null>(null),
    [devices, setDevices] = useState<TVDevice[]>([]);
  const [selected, setSelected] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const [code, setCode] = useState(() => {
      const value = new URLSearchParams(window.location.search).get('pair') || '';
      return /^[A-Fa-f0-9]{10}$/.test(value) ? value.toUpperCase() : '';
    }),
    [name, setName] = useState('Blanco TV'),
    [pin, setPin] = useState(''),
    [confirm, setConfirm] = useState('');
  useEffect(() => {
    document.title = 'Blanco TV — Gestion des écrans';
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('blanco-screens-lang', lang);
    return () => {
      document.documentElement.dir = 'ltr';
    };
  }, [lang]);
  useEffect(() => {
    if (!supabase) {
      setSigned(false);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => setSigned(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSigned(!!session));
    return () => data.subscription.unsubscribe();
  }, []);
  const authGeneration = useRef(0);
  useEffect(() => {
    authGeneration.current++;
    if (signed === false) {
      setDevices([]);
      setSelected('');
      setPin('');
      setConfirm('');
      setCode('');
    }
  }, [signed]);
  const load = useCallback(async () => {
    try {
      const generation = authGeneration.current;
      const data = await tvRpc('list');
      if (generation !== authGeneration.current) return;
      setDevices(data.devices || []);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    if (!signed) return;
    void load();
    const id = setInterval(() => void load(), 15000);
    return () => clearInterval(id);
  }, [signed, load]);
  async function login(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setPassword('');
    if (err) setError(l('تحقق من بيانات حساب الإدارة.', 'Vérifiez votre compte administrateur.'));
    setBusy(false);
  }
  async function claim(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (pin !== confirm)
        throw new Error(l('الكودان غير متطابقين.', 'Les deux codes sont différents.'));
      const hashed = await exitPinHash(pin);
      const data = await tvRpc('claim', {
        pairCode: code.replace(/[\s-]/g, '').toUpperCase(),
        name,
        ...hashed,
      });
      setCode('');
      setPin('');
      setConfirm('');
      await load();
      setSelected(data.id || '');
      setNotice(
        l(
          'تم ربط الشاشة. سيصلها الإعداد وكود الخروج عند اتصالها.',
          'Écran associé. Il recevra sa configuration et son code à la prochaine connexion.',
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const chosen = devices.find((d) => d.id === selected);
  return (
    <main className="screen-admin" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <header className="screen-header">
        <a href="/admin">
          <ArrowLeft size={18} /> {l('لوحة التحكم', 'Administration')}
        </a>
        <span className="screen-brand">
          Blanco <small>TV</small>
        </span>
        <div>
          <button onClick={() => setLang(lang === 'ar' ? 'fr' : 'ar')}>
            {lang === 'ar' ? 'FR' : 'عربي'}
          </button>
          {signed && (
            <button
              aria-label={l('خروج', 'Déconnexion')}
              onClick={() => void supabase?.auth.signOut()}
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </header>
      <section className="screen-hero">
        <span>BLANCO · GRENOBLE</span>
        <h1>{l('شاشات المحل، بمكان واحد.', 'Vos écrans, au même endroit.')}</h1>
        <p>
          {l(
            'المحتوى والجداول وكود الخروج. قدرات الطاقة تظهر حسب صلاحيات الجهاز.',
            'Contenus, horaires et code de sortie. Les fonctions d’alimentation dépendent des droits de chaque appareil.',
          )}
        </p>
        <a className="button dark" href={APK}>
          <Download size={18} />{' '}
          {l('تنزيل تطبيق التلفزيون — نسخة تجريبية', 'Télécharger l’application TV — pilote')}
        </a>
        <a className="button" href="/telecharger">
          <Download size={18} />{' '}
          {l('أداة التثبيت من الكمبيوتر — Windows', 'Installation depuis Windows')}
        </a>
      </section>
      {error && (
        <p className="screen-alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="screen-notice" role="status">
          {notice}
        </p>
      )}
      {signed === null ? (
        <p>{l('جارٍ التحميل…', 'Chargement…')}</p>
      ) : !signed ? (
        <form className="screen-card screen-login" onSubmit={(e) => void login(e)}>
          <h2>{l('حساب الإدارة', 'Compte administrateur')}</h2>
          <label>
            {l('البريد الإلكتروني', 'E-mail')}
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            {l('كلمة السر', 'Mot de passe')}
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="button dark" disabled={busy || !supabase}>
            {l('دخول', 'Connexion')}
          </button>
          {!supabase && (
            <p>
              {l(
                'اربط Supabase لتفعيل إدارة الشاشات.',
                'Configurez Supabase pour gérer les écrans.',
              )}
            </p>
          )}
        </form>
      ) : (
        <>
          <div className="screen-stats">
            <div>
              <Monitor />
              <strong>{devices.filter((d) => !d.revoked).length}</strong>
              <span>{l('شاشات مرتبطة', 'Écrans associés')}</span>
            </div>
            <div>
              <ShieldCheck />
              <strong>
                {devices.filter((d) => d.status.deviceOwner === true && !d.revoked).length}
              </strong>
              <span>{l('إدارة جهاز كاملة', 'Appareils administrés')}</span>
            </div>
            <div>
              <strong>Europe/Paris</strong>
              <span>{l('توقيت الجداول', 'Fuseau des horaires')}</span>
            </div>
          </div>
          <div className="screen-columns">
            <aside>
              <form className="screen-card" onSubmit={(e) => void claim(e)}>
                <h2>
                  <Plus size={20} /> {l('ربط شاشة جديدة', 'Associer un écran')}
                </h2>
                <p>
                  {l(
                    'افتح تطبيق Blanco TV على التلفزيون وأدخل الرمز الظاهر عليه.',
                    'Ouvrez Blanco TV sur la télévision et saisissez le code affiché.',
                  )}
                </p>
                <label>
                  {l('رمز الاقتران', 'Code d’association')}
                  <input
                    dir="ltr"
                    placeholder="A1B2C3D4E5"
                    minLength={10}
                    maxLength={14}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
                <label>
                  {l('اسم الشاشة', 'Nom de l’écran')}
                  <input
                    maxLength={80}
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  {l('كود الخروج — من ٦ إلى ١٢ رقمًا', 'Code de sortie — 6 à 12 chiffres')}
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    maxLength={12}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />
                </label>
                <label>
                  {l('تأكيد كود الخروج', 'Confirmer le code de sortie')}
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
                <button className="button dark" disabled={busy}>
                  {l('ربط الشاشة', 'Associer l’écran')}
                </button>
              </form>
              <section className="screen-card">
                <header>
                  <h2>{l('الشاشات', 'Écrans')}</h2>
                  <button
                    aria-label={l('تحديث الشاشات', 'Actualiser les écrans')}
                    onClick={() => void load()}
                  >
                    <RefreshCw size={18} />
                  </button>
                </header>
                {devices.length === 0 && (
                  <p>{l('ما في شاشات مربوطة بعد.', 'Aucun écran associé pour le moment.')}</p>
                )}
                {devices.map((d) => (
                  <button
                    className={`screen-device ${d.id === selected ? 'selected' : ''}`}
                    key={d.id}
                    onClick={() => setSelected(d.id)}
                  >
                    <Monitor size={22} />
                    <span>
                      <strong>{d.name}</strong>
                      <small>
                        {d.revoked
                          ? l('ملغاة', 'Révoqué')
                          : d.lastSeenAt && Date.now() - Date.parse(d.lastSeenAt) < 90000
                            ? l('متصلة', 'Connecté')
                            : l('غير متصلة الآن', 'Hors ligne')}
                      </small>
                    </span>
                  </button>
                ))}
              </section>
            </aside>
            {chosen ? (
              <DeviceEditor key={chosen.id} device={chosen} l={l} lang={lang} onRefresh={load} />
            ) : (
              <section className="screen-card screen-empty">
                <Monitor size={44} />
                <h2>{l('اختَر شاشة لتعديلها', 'Choisissez un écran')}</h2>
                <p>
                  {l(
                    'الشاشة الجديدة تظهر بعد إدخال رمز الاقتران. التطبيق يحفظ كود الخروج والجداول محليًا.',
                    'Le nouvel écran apparaît après association. L’application conserve localement le code de sortie et les horaires.',
                  )}
                </p>
                <a
                  href="https://github.com/Hammo089/Menu/blob/main/docs/BLANCO-TV.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  {l('دليل التطبيق والتجهيز', 'Guide de préparation')}
                </a>
              </section>
            )}
          </div>
        </>
      )}
    </main>
  );
}
function DeviceEditor({
  device,
  l,
  lang,
  onRefresh,
}: {
  device: TVDevice;
  l: Translate;
  lang: 'ar' | 'fr';
  onRefresh: () => Promise<void>;
}) {
  const [config, setConfig] = useState<TVConfig>(structuredClone(device.config || defaultConfig()));
  const [name, setName] = useState(device.name),
    [revision, setRevision] = useState(device.revision);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [pin, setPin] = useState(''),
    [confirm, setConfirm] = useState(''),
    [history, setHistory] = useState<TVCommand[]>([]);
  const patch = (p: Partial<TVConfig>) => setConfig((c) => ({ ...c, ...p }));
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    await tvRpc('save', { id: device.id, revision, config, name });
    setRevision((r) => r + 1);
    await onRefresh();
    setNotice(
      l(
        'تم النشر. يظهر عند اتصال الشاشة التالي.',
        'Publié. Application à la prochaine connexion de la TV.',
      ),
    );
  }
  const command = (kind: string) =>
    run(async () => {
      await tvRpc('command', { id: device.id, kind, requestId: crypto.randomUUID() });
      setNotice(
        l(
          'أُرسل الطلب، بانتظار تأكيد التلفزيون. ينتهي بعد دقيقتين إذا لم يُنفّذ.',
          'Demande envoyée, en attente de confirmation de la TV. Expiration après deux minutes.',
        ),
      );
      setHistory((await tvRpc('history', { id: device.id })).commands || []);
    });
  const status = device.status;
  return (
    <section className="screen-card screen-editor">
      <header>
        <div>
          <span>BLANCO TV</span>
          <h2>{device.name}</h2>
        </div>
        <button
          onClick={() => {
            setConfig(structuredClone(device.config));
            setName(device.name);
            setRevision(device.revision);
            setNotice(l('تم تحميل آخر إعدادات منشورة.', 'Dernière configuration publiée chargée.'));
          }}
        >
          {l('إعادة تحميل الإعدادات', 'Recharger les réglages')}
        </button>
      </header>
      {error && (
        <p className="screen-alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="screen-notice" role="status">
          {notice}
        </p>
      )}
      <div className="screen-meta">
        <span>{String(status.model || l('الموديل لم يصل بعد', 'Modèle non reçu'))}</span>
        <span>Android {String(status.osVersion || '—')}</span>
        <span>
          {status.deviceOwner === true
            ? l('Kiosk مُدار', 'Kiosque administré')
            : l(
                'وضع عرض — قفل النظام غير مضمون',
                'Mode affichage — verrouillage système non garanti',
              )}
        </span>
        <span>
          {l('آخر اتصال', 'Dernier contact')}:{' '}
          {device.lastSeenAt
            ? new Date(device.lastSeenAt).toLocaleString(lang === 'ar' ? 'ar' : 'fr', {
                timeZone: 'Europe/Paris',
              })
            : '—'}
        </span>
      </div>
      <p>
        {l('آخر حالة أبلغ عنها الجهاز', 'Dernier état signalé par l’appareil')}:{' '}
        {status.ownerExited === true
          ? l('خروج بالكود · واجهة التلفزيون', 'Sortie par PIN · accueil TV')
          : status.screenOn === false
            ? l('سكون', 'Veille')
            : status.blackScreen === true
              ? l('شاشة سوداء', 'Écran noir')
              : l('عرض المحتوى', 'Affichage')}
        {status.cachedMenu === true ? l(' · منيو محفوظة محليًا', ' · menu en cache') : ''}
      </p>
      {typeof status.contentError === 'string' && status.contentError && (
        <p className="screen-alert">{status.contentError}</p>
      )}
      <fieldset disabled={device.revoked || busy}>
        <label>
          {l('اسم الشاشة', 'Nom de l’écran')}
          <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="screen-fields">
          <label>
            {l('حالة العرض', 'État de l’affichage')}
            <select
              value={config.override}
              onChange={(e) => patch({ override: e.target.value as TVConfig['override'] })}
            >
              <option value="auto">{l('حسب الجدول', 'Selon le planning')}</option>
              <option value="open">{l('عرض المحتوى باستمرار', 'Afficher en continu')}</option>
              <option value="closed">{l('شاشة سوداء', 'Écran noir')}</option>
            </select>
          </label>
          <label>
            {l('المحتوى', 'Contenu')}
            <select
              aria-label={l('المحتوى', 'Contenu')}
              value={config.mode}
              onChange={(e) => patch({ mode: e.target.value as TVConfig['mode'] })}
            >
              <option value="menu">{l('منيو التلفزيون', 'Menu TV Blanco')}</option>
              <option value="url">{l('صفحة ويب', 'Page web')}</option>
              <option value="playlist">
                {l('قائمة صور وفيديو وصفحات', 'Images, vidéos et pages')}
              </option>
            </select>
          </label>
        </div>
        {config.mode === 'url' && (
          <label>
            {l('رابط HTTPS', 'Lien HTTPS')}
            <input
              type="url"
              dir="ltr"
              placeholder="https://…"
              value={config.url}
              onChange={(e) => patch({ url: e.target.value })}
            />
          </label>
        )}
        {config.mode === 'playlist' && (
          <div className="screen-playlist">
            <h3>{l('قائمة العرض', 'Liste de lecture')}</h3>
            {config.items.map((item, i) => (
              <div className="screen-item" key={i}>
                <select
                  aria-label={l(`نوع العنصر ${i + 1}`, `Type de l’élément ${i + 1}`)}
                  value={item.type}
                  onChange={(e) =>
                    patch({
                      items: config.items.map((x, j) =>
                        j === i ? { ...x, type: e.target.value as typeof item.type } : x,
                      ),
                    })
                  }
                >
                  <option value="image">{l('صورة', 'Image')}</option>
                  <option value="video">{l('فيديو', 'Vidéo')}</option>
                  <option value="url">{l('صفحة', 'Page')}</option>
                </select>
                <input
                  aria-label={l(`رابط العنصر ${i + 1}`, `Lien de l’élément ${i + 1}`)}
                  type="url"
                  dir="ltr"
                  placeholder="https://…"
                  value={item.url}
                  onChange={(e) =>
                    patch({
                      items: config.items.map((x, j) =>
                        j === i ? { ...x, url: e.target.value } : x,
                      ),
                    })
                  }
                />
                <label>
                  {l('ثانية', 'Secondes')}
                  <input
                    type="number"
                    min={5}
                    max={3600}
                    value={item.duration}
                    onChange={(e) =>
                      patch({
                        items: config.items.map((x, j) =>
                          j === i ? { ...x, duration: Number(e.target.value) } : x,
                        ),
                      })
                    }
                  />
                </label>
                <button onClick={() => patch({ items: config.items.filter((_, j) => j !== i) })}>
                  {l('حذف', 'Retirer')}
                </button>
              </div>
            ))}
            <button
              className="button"
              disabled={config.items.length >= 30}
              onClick={() =>
                patch({ items: [...config.items, { type: 'image', url: '', duration: 10 }] })
              }
            >
              {l('إضافة عنصر', 'Ajouter un élément')}
            </button>
            <p>
              {l(
                'مدة الفيديو هي الحد الأقصى للعنصر؛ ينتقل للعنصر التالي عند انتهائه. تُحفظ ملفات الصور والفيديو المدعومة محليًا حتى ٢٠٠ ميغابايت.',
                'La durée est une limite par vidéo ; la lecture avance aussi en fin de vidéo. Images et vidéos compatibles sont mises en cache, jusqu’à 200Mo.',
              )}
            </p>
          </div>
        )}
        <div className="screen-fields">
          <label>
            {l('اتجاه المنيو', 'Orientation du menu')}
            <select
              value={config.orientation}
              onChange={(e) => patch({ orientation: e.target.value as TVConfig['orientation'] })}
            >
              <option value="portrait">{l('عمودي', 'Vertical')}</option>
              <option value="landscape">{l('أفقي', 'Horizontal')}</option>
            </select>
          </label>
          <label>
            {l('تدوير المنيو', 'Rotation du menu')}
            <select
              value={config.rotation}
              onChange={(e) => patch({ rotation: Number(e.target.value) as TVConfig['rotation'] })}
            >
              {[0, 90, 180, 270].map((x) => (
                <option key={x} value={x}>
                  {x}°
                </option>
              ))}
            </select>
          </label>
        </div>
        <section className="screen-schedule">
          <h3>{l('جدول العمل · توقيت غرونوبل', 'Horaires · heure de Grenoble')}</h3>
          <label className="screen-check">
            <input
              type="checkbox"
              checked={config.schedule.enabled}
              onChange={(e) =>
                patch({ schedule: { ...config.schedule, enabled: e.target.checked } })
              }
            />
            {l('تفعيل الجدول الأسبوعي', 'Activer le planning hebdomadaire')}
          </label>
          {config.schedule.days.map((day, i) => (
            <div className="screen-day" key={day.day}>
              <label className="screen-check">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(e) =>
                    patch({
                      schedule: {
                        ...config.schedule,
                        days: config.schedule.days.map((x, j) =>
                          j === i ? { ...x, enabled: e.target.checked } : x,
                        ),
                      },
                    })
                  }
                />
                {(lang === 'ar' ? daysAr : daysFr)[day.day - 1]}
              </label>
              <input
                type="time"
                aria-label={l(`بداية ${daysAr[day.day - 1]}`, `Début ${daysFr[day.day - 1]}`)}
                value={day.start}
                onChange={(e) =>
                  patch({
                    schedule: {
                      ...config.schedule,
                      days: config.schedule.days.map((x, j) =>
                        j === i ? { ...x, start: e.target.value } : x,
                      ),
                    },
                  })
                }
              />
              <span>—</span>
              <input
                type="time"
                aria-label={l(`نهاية ${daysAr[day.day - 1]}`, `Fin ${daysFr[day.day - 1]}`)}
                value={day.end}
                onChange={(e) =>
                  patch({
                    schedule: {
                      ...config.schedule,
                      days: config.schedule.days.map((x, j) =>
                        j === i ? { ...x, end: e.target.value } : x,
                      ),
                    },
                  })
                }
              />
            </div>
          ))}
          <p>
            {l(
              'بعد الإغلاق تصبح الشاشة سوداء. إذا كان وقت النهاية قبل البداية، يمتد الدوام لليوم التالي. السكون الحقيقي والإيقاظ يحتاجان دعم الجهاز.',
              'Hors horaires, l’écran devient noir. Une fin avant le début prolonge la plage au lendemain. La veille et le réveil physiques nécessitent le support de l’appareil.',
            )}
          </p>
          <p>
            {l('حسب الإعداد الحالي', 'Avec ces réglages')}:{' '}
            <strong>
              {scheduleOpen(config) ? l('عرض', 'Affichage') : l('شاشة سوداء', 'Écran noir')}
            </strong>
          </p>
        </section>
        <button className="button dark" onClick={() => void run(save)}>
          {l('نشر إعدادات الشاشة', 'Publier les réglages de l’écran')}
        </button>
        <section className="screen-commands">
          <h3>{l('أوامر عن بُعد', 'Commandes à distance')}</h3>
          <div>
            <button className="button" onClick={() => void command('reload')}>
              {l('تحديث المحتوى', 'Recharger le contenu')}
            </button>
            <button className="button" onClick={() => void command('restart_app')}>
              {l('إعادة فتح التطبيق', 'Relancer l’application')}
            </button>
            <button
              className="button"
              disabled={status.canSleep !== true}
              onClick={() => void command('sleep')}
            >
              {l('سكون الجهاز', 'Veille appareil')}
            </button>
            <button className="button" onClick={() => void command('wake')}>
              {l('محاولة إيقاظ الجهاز', 'Tenter le réveil')}
            </button>
            <button
              className="button"
              disabled={status.deviceOwner !== true}
              onClick={() => void command('reboot')}
            >
              {l('إعادة تشغيل Android', 'Redémarrer Android')}
            </button>
          </div>
          <p>
            {l(
              'الإيقاظ محاولة حسب الصلاحيات، وليس تشغيلًا من انقطاع الكهرباء. استلام الطلب لا يعني نجاحه؛ راجع تأكيد الجهاز.',
              'Le réveil est une tentative selon les droits, pas une remise sous tension. L’envoi seul ne confirme pas l’exécution ; consultez la réponse de la TV.',
            )}
          </p>
        </section>
        <section>
          <h3>{l('كود الخروج من Kiosk', 'Code de sortie du kiosque')}</h3>
          <p>
            {l(
              'يُطلب داخل التطبيق عند الضغط على رجوع أو الضغط المطوّل على زاوية الشاشة. التغيير يصل عند المزامنة؛ آخر كود معروف يعمل بلا إنترنت.',
              'Demandé dans l’application avec Retour ou un appui long dans le coin de l’écran. Un changement arrive à la synchronisation ; le dernier code reçu fonctionne hors ligne.',
            )}
          </p>
          <div className="screen-fields">
            <label>
              {l('كود جديد من ٦ إلى ١٢ رقمًا', 'Nouveau code de 6 à 12 chiffres')}
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={12}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            </label>
            <label>
              {l('تأكيد الكود الجديد', 'Confirmer le nouveau code')}
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={12}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
          </div>
          <button
            className="button"
            onClick={() =>
              void run(async () => {
                if (pin !== confirm)
                  throw new Error(l('الكودان غير متطابقين.', 'Les codes sont différents.'));
                await tvRpc('pin', { id: device.id, ...(await exitPinHash(pin)) });
                setPin('');
                setConfirm('');
                await onRefresh();
                setNotice(
                  l(
                    'تم تغيير الكود. أعد تحميل الإعدادات قبل حفظ تعديلات أخرى.',
                    'Code changé. Rechargez les réglages avant de publier d’autres modifications.',
                  ),
                );
              })
            }
          >
            {l('تغيير كود الخروج', 'Changer le code de sortie')}
          </button>
        </section>
      </fieldset>
      <section>
        <h3>{l('سجل الأوامر', 'Historique des commandes')}</h3>
        <button
          className="button"
          onClick={() =>
            void run(async () =>
              setHistory((await tvRpc('history', { id: device.id })).commands || []),
            )
          }
        >
          {l('تحديث سجل الأوامر', 'Actualiser l’historique')}
        </button>
        <ul className="screen-history">
          {history.map((c) => (
            <li key={c.id}>
              <strong>{c.kind}</strong>
              <span>
                {c.acknowledgedAt
                  ? c.result
                  : Date.parse(c.expiresAt) < Date.now()
                    ? l('انتهت بدون تأكيد', 'Expirée sans confirmation')
                    : l('بانتظار الجهاز', 'En attente de la TV')}
              </span>
              <small>{c.message}</small>
            </li>
          ))}
        </ul>
      </section>
      {!device.revoked && (
        <button
          className="screen-danger"
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                l(
                  'إلغاء ربط هذه الشاشة؟ لن تستقبل إعدادات جديدة بعد اتصالها بالخادم.',
                  'Révoquer cet écran ? Son accès sera coupé dès son prochain contact avec le serveur.',
                ),
              )
            )
              void run(async () => {
                await tvRpc('revoke', { id: device.id });
                await onRefresh();
              });
          }}
        >
          {l('إلغاء ربط الشاشة', 'Révoquer cet écran')}
        </button>
      )}
    </section>
  );
}
