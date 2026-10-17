import { useMemo, useState } from 'react';
import { Eye, X } from 'lucide-react';
import { holidayCatalog, holidaySchedule, parisDate, addDays, type HolidayId } from './holidays';
import { HolidayDecor } from './HolidayEffect';
import type { Settings, Language } from './types';
export default function HolidayControls({
  settings,
  onChange,
  lang,
}: {
  settings: Settings;
  onChange: (value: Partial<Settings>) => void;
  lang: Language;
}) {
  const l = (ar: string, fr: string) => (lang === 'ar' ? ar : fr);
  const [preview, setPreview] = useState<HolidayId | null>(null);
  const today = parisDate(),
    year = Number(today.slice(0, 4));
  const upcoming = useMemo(() => {
    const events = [
      ...holidaySchedule(year, settings.holidayCalendar ?? 'both'),
      ...holidaySchedule(year + 1, settings.holidayCalendar ?? 'both'),
    ];
    const seen = new Set<string>();
    return events.filter((e) => {
      const date = settings.holidayOverrides?.[e.key] || e.date,
        key = `${e.id}:${e.tradition}`;
      if ((!settings.holidayOverrides?.[e.key] && date < addDays(today, -6)) || seen.has(key))
        return false;
      seen.add(key);
      return true;
    });
  }, [year, today, settings.holidayCalendar, settings.holidayOverrides]);
  return (
    <article className="admin-panel form-panel holiday-controls">
      <h3>
        {l('أجواء الأعياد الإسلامية والمسيحية', 'Ambiances des fêtes musulmanes et chrétiennes')}
      </h3>
      <label>
        {l('وضع الأعياد', 'Mode des fêtes')}
        <select
          value={settings.holidayMode ?? 'auto'}
          onChange={(e) => onChange({ holidayMode: e.target.value as Settings['holidayMode'] })}
        >
          <option value="auto">
            {l('تلقائي حسب التاريخ — غرونوبل', 'Automatique — date de Grenoble')}
          </option>
          <option value="off">{l('بدون تأثيرات أعياد', 'Désactivé')}</option>
          {Object.entries(holidayCatalog).map(([id, names]) => (
            <option key={id} value={id}>
              {names[lang === 'ar' ? 0 : 1]}
            </option>
          ))}
        </select>
      </label>
      <label>
        {l('التقويم المسيحي', 'Calendrier chrétien')}
        <select
          value={settings.holidayCalendar ?? 'both'}
          onChange={(e) =>
            onChange({ holidayCalendar: e.target.value as Settings['holidayCalendar'] })
          }
        >
          <option value="both">{l('الغربي والشرقي', 'Occidental et oriental')}</option>
          <option value="western">
            {l('الغربي — كاثوليكي وبروتستانتي', 'Occidental — catholique et protestant')}
          </option>
          <option value="eastern">
            {l('الشرقي — أرثوذكسي بالتقويم اليولياني', 'Oriental — orthodoxe, calendrier julien')}
          </option>
        </select>
      </label>
      <label>
        {l('تصحيح التواريخ الهجرية', 'Ajustement des dates hégiriennes')}
        <select
          value={settings.holidayOffsetDays ?? 0}
          onChange={(e) => onChange({ holidayOffsetDays: Number(e.target.value) })}
        >
          {[-2, -1, 0, 1, 2].map((n) => (
            <option key={n} value={n}>
              {n === 0
                ? l('حسب التقويم', 'Selon le calendrier')
                : `${n > 0 ? '+' : ''}${n} ${l('يوم', 'jour(s)')}`}
            </option>
          ))}
        </select>
      </label>
      <p>
        {l(
          'التواريخ الهجرية تقديرية بتقويم أم القرى، ويمكن تصحيحها حسب إعلان الهلال. الميلاد الشرقي هنا ٧ يناير؛ بعض الكنائس الشرقية تحتفل في ٢٥ ديسمبر، ويمكن تعديل الموعد أدناه.',
          'Dates hégiriennes prévisionnelles (Umm al-Qura), ajustables après l’annonce lunaire. Noël oriental est fixé ici au 7 janvier ; certaines Églises orientales célèbrent le 25 décembre. Ajustez les dates ci-dessous.',
        )}
      </p>
      <p>
        {l(
          'زينة العيد تظهر تلقائياً بوقته بدل تأثير الموسم، وبعد العيد بيرجع تأثير الموسم. اختيار عيد يدوياً يبقي زينته ظاهرة حتى تعيد الوضع للتلقائي.',
          'Les fêtes remplacent temporairement l’ambiance saisonnière. Le mode manuel reste actif jusqu’au retour au mode automatique.',
        )}
      </p>
      <div className="holiday-date-list">
        {upcoming.map((e) => {
          const date =
            settings.holidayOverrides?.[e.key] ||
            addDays(e.date, e.tradition === 'islamic' ? (settings.holidayOffsetDays ?? 0) : 0);
          return (
            <div key={e.key}>
              <label>
                {holidayCatalog[e.id][lang === 'ar' ? 0 : 1]}
                <small>
                  {e.tradition === 'western'
                    ? l('غربي', 'Occidental')
                    : e.tradition === 'eastern'
                      ? l('شرقي', 'Oriental')
                      : e.tradition === 'islamic'
                        ? l('هجري — تقديري', 'Hégirien — prévisionnel')
                        : ''}
                </small>
                <input
                  type="date"
                  aria-label={`${holidayCatalog[e.id][lang === 'ar' ? 0 : 1]} ${e.tradition}`}
                  value={date}
                  onChange={(event) => {
                    if (event.target.value)
                      onChange({
                        holidayOverrides: {
                          ...settings.holidayOverrides,
                          [e.key]: event.target.value,
                        },
                      });
                  }}
                />
              </label>
              <button
                type="button"
                className="icon-button"
                title={l('معاينة', 'Aperçu')}
                aria-label={`${l('معاينة', 'Aperçu')} ${holidayCatalog[e.id][lang === 'ar' ? 0 : 1]}`}
                onClick={() => setPreview(e.id)}
              >
                <Eye size={17} />
              </button>
              {settings.holidayOverrides?.[e.key] && (
                <button
                  className="icon-button"
                  aria-label={l('إعادة التاريخ التلقائي', 'Rétablir la date automatique')}
                  onClick={() => {
                    const next = { ...settings.holidayOverrides };
                    delete next[e.key];
                    onChange({ holidayOverrides: next });
                  }}
                >
                  <X size={15} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p>
        {l(
          'التواريخ الجديدة تبقى مسودة حتى تضغط نشر التعديلات.',
          'Les changements restent en brouillon jusqu’à leur publication.',
        )}
      </p>
      {preview && (
        <div className="holiday-preview-backdrop" onClick={() => setPreview(null)}>
          <div
            className="holiday-preview-frame"
            role="dialog"
            aria-modal="true"
            aria-label={l('معاينة زينة العيد', 'Aperçu de la fête')}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus
              className="icon-button holiday-preview-close"
              aria-label={l('إغلاق', 'Fermer')}
              onClick={() => setPreview(null)}
            >
              <X />
            </button>
            <div className="holiday-preview-brand">
              Blanco<small>{holidayCatalog[preview][lang === 'ar' ? 0 : 1]}</small>
            </div>
            <HolidayDecor settings={{ holidayMode: preview }} />
          </div>
        </div>
      )}
    </article>
  );
}
