import { useEffect, useState } from 'react';
import { Download, Monitor, ArrowLeft } from 'lucide-react';
import './downloads.css';
export default function Downloads() {
  const [fr, setFr] = useState(false);
  const t = (ar: string, french: string) => (fr ? french : ar);
  useEffect(() => {
    document.title = 'Blanco TV — Téléchargements';
  }, []);
  return (
    <main className="tv-downloads" dir={fr ? 'ltr' : 'rtl'}>
      <header>
        <a href="/admin/screens">
          Blanco<span>COFFEE & MORE</span>
        </a>
        <button type="button" onClick={() => setFr(!fr)}>
          {fr ? 'العربية' : 'Français'}
        </button>
      </header>
      <section className="tv-download-intro">
        <span>BLANCO TV</span>
        <h1>{t('شاشة المحل، جاهزة للعرض.', 'Votre écran, prêt à accueillir.')}</h1>
        <p>
          {t(
            'نزّل أداة الكمبيوتر لتثبيت التطبيق على التلفزيون، أو نزّل التطبيق مباشرةً. نسخة تجريبية لأجهزة Android TV.',
            'Installez Blanco TV depuis votre ordinateur ou téléchargez directement l’application. Version pilote pour Android TV.',
          )}
        </p>
      </section>
      <section className="tv-download-grid" aria-label={t('ملفات التنزيل', 'Téléchargements')}>
        <article>
          <div className="tv-download-icon">
            <Monitor size={28} />
          </div>
          <span>WINDOWS 10 / 11 · v1.4 · ZIP · 8 MB</span>
          <h2>{t('أداة التثبيت للكمبيوتر', 'Installation depuis Windows')}</h2>
          <p>
            {t(
              'تدخل IP التلفزيون، توافق على الاتصال، بتفحص الجهاز أولاً، وبعد اختيارك بتثبّت Blanco كتطبيق عرض اختياري بدون تغيير واجهة التلفزيون.',
              'Saisissez l’IP du téléviseur et autorisez la connexion. L’outil inspecte d’abord la TV puis installe, sur votre choix, un affichage facultatif sans modifier l’accueil.',
            )}
          </p>
          <a className="tv-download-primary" href="/downloads/Blanco-TV-Windows.zip?v=1.4" download>
            <Download size={19} />
            {t('تحميل أداة Windows', 'Télécharger pour Windows')}
          </a>
          <small>
            {t(
              'فك الضغط كاملاً، ثم شغّل Start-Blanco.cmd.',
              'Extrayez toute l’archive puis lancez Start-Blanco.cmd.',
            )}
          </small>
        </article>
        <article>
          <div className="tv-download-icon">
            <Download size={28} />
          </div>
          <span>ANDROID TV 8+ · v1.4 · APK</span>
          <h2>{t('تطبيق التلفزيون', 'Application pour le téléviseur')}</h2>
          <p>
            {t(
              'للتثبيت اليدوي على التلفزيون. بعد فتح التطبيق، امسح QR لربط الشاشة بحساب إدارة Blanco.',
              'Pour une installation manuelle sur le téléviseur. Ouvrez l’application et scannez le QR pour associer l’écran au compte administrateur Blanco.',
            )}
          </p>
          <a className="tv-download-secondary" href="/downloads/blanco-tv-pilot.apk?v=1.4" download>
            <Download size={19} />
            {t('تحميل تطبيق التلفزيون', 'Télécharger l’APK')}
          </a>
          <small>
            {t(
              'Android System WebView مطلوب لعرض المنيو.',
              'Android System WebView est requis pour afficher le menu.',
            )}
          </small>
        </article>
      </section>
      <section className="tv-download-help">
        <h2>{t('بعد التنزيل', 'Après le téléchargement')}</h2>
        <ol>
          <li>
            {t(
              'خلي الكمبيوتر والتلفزيون على نفس الشبكة وفعّل تصحيح USB أو الشبكة.',
              'Connectez le PC et la TV au même réseau et activez le débogage USB ou réseau.',
            )}
          </li>
          <li>
            {t(
              'شغّل الأداة، أدخل IP ووافق على التفويض من التلفزيون.',
              'Lancez l’outil, saisissez l’IP et acceptez l’autorisation sur la TV.',
            )}
          </li>
          <li>
            {t(
              'امسح QR الظاهر بالتلفزيون، سجّل دخول الإدارة واختار كود خروج خاص فيك.',
              'Scannez le QR de la TV, connectez-vous à l’administration et choisissez votre PIN de sortie.',
            )}
          </li>
        </ol>
        <p>
          {t(
            'هذه النسخة وضع عرض اختياري وليست قفلاً كاملاً: زر Home يبقى متاحاً، وللخروج اضغط رجوع ٧ مرات خلال ٥ ثوانٍ ثم أدخل الكود. لا تغيير للمشغّل أو إدارة الجهاز، مع محاولة استئناف Blanco بعد السكون وإعادته للواجهة أثناء جلسة العرض. الخروج الصحيح بالكود يوقف الاستئناف حتى فتح التطبيق يدوياً أو الإقلاع الكامل إذا كان مفعلاً. Fire TV قد يمنع الاستئناف التلقائي. بعد الإعداد، افصل ADB وأغلق تصحيح الشبكة.',
            'Affichage facultatif sans verrouillage système : Home reste disponible et Retour ×7 en 5 secondes puis le PIN permet de sortir. Aucun changement de lanceur, de gestion de l’appareil ; une reprise est demandée au réveil et pendant la session d’affichage. Une sortie par PIN est respectée jusqu’à l’ouverture manuelle ou au prochain démarrage complet si activé. Fire TV peut refuser la reprise. Déconnectez ADB et désactivez le débogage réseau après installation.',
          )}
        </p>
        <a href="/admin/screens">
          <ArrowLeft size={16} />
          {t('فتح إدارة الشاشات', 'Ouvrir la gestion des écrans')}
        </a>
      </section>
      <footer>
        Blanco · Grenoble{' '}
        <span>
          {t(
            'رمز الربط مختلف عن كود الخروج.',
            'Le code d’association est différent du PIN de sortie.',
          )}
        </span>
      </footer>
    </main>
  );
}
