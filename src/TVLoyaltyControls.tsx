import { TVLoyalty } from './TVLoyalty';
import {
  defaultTVLoyalty,
  validTVLoyaltyUrl,
  tvLoyaltySettings,
  type TVLoyaltySettings,
} from './tvLoyalty';
import type { Language, Settings } from './types';
export default function TVLoyaltyControls({
  settings,
  onChange,
  lang,
}: {
  settings: Settings;
  onChange: (value: Partial<Settings>) => void;
  lang: Language;
}) {
  const l = (ar: string, fr: string) => (lang === 'ar' ? ar : fr);
  const value = tvLoyaltySettings(settings.tvLoyalty);
  const change = (patch: Partial<TVLoyaltySettings>) =>
    onChange({ tvLoyalty: { ...value, ...patch } });
  return (
    <article className="admin-panel form-panel tv-loyalty-editor">
      <h3>{l('شريط الولاء ورمز QR', 'Bandeau fidélité et QR')}</h3>
      <label className="check-field">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => change({ enabled: e.target.checked })}
        />
        {l('إظهار شريط الولاء', 'Afficher le bandeau fidélité')}
      </label>
      <label className="check-field">
        <input
          type="checkbox"
          checked={value.qrVisible}
          onChange={(e) => change({ qrVisible: e.target.checked })}
        />
        {l('إظهار رمز QR', 'Afficher le QR')}
      </label>
      {(
        [
          ['eyebrow', 'السطر العلوي', 'Petite accroche'],
          ['title', 'العنوان', 'Titre'],
          ['description', 'شرح التسجيل', 'Explication'],
          ['footnote', 'السطر السفلي', 'Dernière ligne'],
        ] as const
      ).map(([key, ar, fr]) => (
        <label key={key}>
          {l(ar, fr)}
          <input
            maxLength={160}
            value={value[key]}
            onChange={(e) => change({ [key]: e.target.value })}
          />
        </label>
      ))}
      <label>
        {l('رابط رمز QR', 'Destination du QR')}
        <input
          type="url"
          placeholder="https://…"
          dir="ltr"
          maxLength={500}
          value={value.url}
          onChange={(e) => change({ url: e.target.value.trim() })}
        />
      </label>
      <p>
        {l(
          'اترك الرابط فارغًا لصفحة التسجيل الحالية. يمكنك حذف نص أي سطر لإخفائه. الروابط المخصصة تبدأ بـ https://.',
          'Laissez le lien vide pour la page d’inscription actuelle. Effacez une ligne pour la masquer. Les liens personnalisés commencent par https://.',
        )}
      </p>
      {!validTVLoyaltyUrl(value.url) && (
        <p role="alert">
          {l(
            'أدخل رابط HTTPS صالحًا قبل النشر.',
            'Saisissez un lien HTTPS valide avant de publier.',
          )}
        </p>
      )}
      <label>
        {l('مكان الشريط', 'Position du bandeau')}
        <select
          value={value.position}
          onChange={(e) => change({ position: e.target.value as TVLoyaltySettings['position'] })}
        >
          <option value="bottom">{l('أسفل', 'En bas')}</option>
          <option value="top">{l('أعلى', 'En haut')}</option>
        </select>
      </label>
      <label>
        {l('جهة رمز QR', 'Côté du QR')}
        <select
          value={value.qrSide}
          onChange={(e) => change({ qrSide: e.target.value as TVLoyaltySettings['qrSide'] })}
        >
          <option value="left">{l('يسار', 'Gauche')}</option>
          <option value="right">{l('يمين', 'Droite')}</option>
        </select>
      </label>
      {(
        [
          ['height', 'مساحة الشريط من الشاشة', 'Hauteur du bandeau', 10, 24],
          ['qrScale', 'حجم رمز QR', 'Taille du QR', 60, 110],
          ['textScale', 'حجم الكتابة', 'Taille du texte', 70, 140],
        ] as const
      ).map(([key, ar, fr, min, max]) => (
        <label key={key}>
          {l(ar, fr)} · {value[key]}%
          <input
            type="range"
            min={min}
            max={max}
            value={value[key]}
            onChange={(e) => change({ [key]: Number(e.target.value) })}
          />
        </label>
      ))}
      {(
        [
          ['background', 'لون خلفية الشريط', 'Fond du bandeau'],
          ['textColor', 'لون كتابة الشريط', 'Texte du bandeau'],
          ['borderColor', 'لون إطار الشريط', 'Bordure du bandeau'],
          ['qrColor', 'لون رمز QR', 'Couleur du QR'],
        ] as const
      ).map(([key, ar, fr]) => (
        <label className="color-field" key={key}>
          {l(ar, fr)}
          <input
            type="color"
            value={value[key]}
            onChange={(e) => change({ [key]: e.target.value })}
          />
        </label>
      ))}
      <p>
        {l(
          'اختَر لون QR داكنًا ليسهل مسحه. تنشر هذه الإعدادات على كل شاشات التلفزيون.',
          'Choisissez un QR foncé pour faciliter la lecture. Ces réglages seront publiés sur toutes vos TV.',
        )}
      </p>
      <div
        className="tv-loyalty-preview"
        dir="ltr"
        aria-label={l('معاينة شريط الولاء', 'Aperçu du bandeau fidélité')}
      >
        <TVLoyalty settings={{ ...value, enabled: true }} />
      </div>
      {!value.enabled && (
        <p>
          {l(
            'الشريط مخفي على التلفزيون. هذه معاينة فقط.',
            'Bandeau masqué sur la TV. Cet aperçu reste visible ici.',
          )}
        </p>
      )}
      <button className="button" onClick={() => change({ ...defaultTVLoyalty })}>
        {l('استعادة إعدادات شريط الولاء', 'Réinitialiser le bandeau')}
      </button>
    </article>
  );
}
