import { useEffect, useRef, useState } from 'react';
import { Clock } from './DayEditor';
import { planning, download } from './api';
import { addDays, calculate, fullName, hm, kinds, type Employee, type Hours } from './core';
import {
  emptyWeek,
  weekOf,
  plannedMinutes,
  whatsappUrl,
  workHours,
  type PlanDay,
  type WeeklyPlan,
} from './planning';
export default function WeeklyPlanner({
  employee,
  initialDate,
  onDirty,
  onBusy,
}: {
  employee: Employee;
  initialDate: string;
  onDirty: (b: boolean) => void;
  onBusy: (b: boolean) => void;
}) {
  const [week, setWeek] = useState(() => weekOf(initialDate)),
    [days, setDays] = useState<PlanDay[]>(() => emptyWeek(weekOf(initialDate))),
    [note, setNote] = useState(''),
    [saved, setSaved] = useState<WeeklyPlan | null>(null),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [format, setFormat] = useState<'pdf' | 'xlsx'>('pdf'),
    [file, setFile] = useState<File | null>(null),
    [preparing, setPreparing] = useState(false);
  const generation = useRef(0),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      onBusy(false);
      onDirty(false);
    };
  }, []);
  useEffect(() => {
    const id = ++generation.current;
    setBusy(true);
    onBusy(true);
    setError('');
    setFile(null);
    setSaved(null);
    setDays(emptyWeek(week));
    setNote('');
    void planning('get', { employeeId: employee.id, week })
      .then((r) => {
        if (!mounted.current || id !== generation.current) return;
        setSaved(r.plan);
        setDays(r.plan?.days || emptyWeek(week));
        setNote(r.plan?.note || '');
        setDirty(false);
        onDirty(false);
        setNotice('');
      })
      .catch((e) => {
        if (mounted.current && id === generation.current) setError(e.message);
      })
      .finally(() => {
        if (mounted.current && id === generation.current) {
          setBusy(false);
          onBusy(false);
        }
      });
  }, [employee.id, week]);
  useEffect(() => {
    let active = true;
    setFile(null);
    if (!saved || dirty) {
      setPreparing(false);
      return;
    }
    setPreparing(true);
    void import('./planningFiles')
      .then(async (m) => {
        const blob =
          format === 'pdf'
            ? await m.planningPdf(employee, saved)
            : m.planningExcel(employee, saved);
        if (active)
          setFile(
            new File(
              [blob],
              `Blanco-Planning-${fullName(employee).replace(/[\\/]/g, '-')}-${saved.week_start}-v${saved.version}.${format}`,
              { type: blob.type },
            ),
          );
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setPreparing(false);
      });
    return () => {
      active = false;
    };
  }, [saved, dirty, format, employee.id]);
  function changed() {
    setDirty(true);
    onDirty(true);
    setFile(null);
    setNotice('');
  }
  function update(index: number, hours: Hours | null) {
    setDays((old) => old.map((d, i) => (i === index ? { ...d, hours } : d)));
    changed();
  }
  function move(next: string) {
    if (dirty && !confirm('Abandonner les modifications non enregistrées de cette semaine ?'))
      return;
    onDirty(false);
    setDirty(false);
    setWeek(next);
  }
  async function save() {
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      const r = await planning('save', {
        employeeId: employee.id,
        week,
        days,
        note,
        version: saved?.version || 0,
      });
      if (!mounted.current) return;
      setSaved(r.plan);
      setDays(r.plan.days);
      setNote(r.plan.note);
      setDirty(false);
      onDirty(false);
      setNotice(
        'Programme hebdomadaire enregistré. Il ne modifie pas les heures réellement travaillées.',
      );
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  }
  let duration = '';
  try {
    duration = hm(plannedMinutes(days));
  } catch {
    duration = 'Complétez les postes';
  }
  const whatsapp = saved ? whatsappUrl(employee, saved) : '';
  async function share() {
    if (!file || !saved) return;
    setError('');
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Planning Blanco · ${fullName(employee)}`,
          text: `Planning prévisionnel du ${week} au ${addDays(week, 6)}`,
        });
        setNotice('Partage ouvert. Choisissez WhatsApp et confirmez l’envoi.');
      } catch (e) {
        if ((e as DOMException).name !== 'AbortError')
          setError(
            'Le partage du fichier n’est pas disponible. Téléchargez-le puis ouvrez WhatsApp ci-dessous.',
          );
      }
      return;
    }
    download(file, file.name);
    window.open(whatsapp, '_blank', 'noopener,noreferrer');
    setNotice(
      'Fichier téléchargé. Dans WhatsApp, joignez le PDF ou Excel avant d’envoyer. Si la fenêtre ne s’ouvre pas, utilisez le lien ci-dessous.',
    );
  }
  return (
    <section className="hr-card hr-planner">
      <h2>Programme hebdomadaire · {fullName(employee)}</h2>
      <p className="hr-muted">
        La direction établit et partage le programme. Les horaires prévus restent séparés des heures
        réellement déclarées et validées.
      </p>
      <div className="hr-toolbar">
        <button type="button" disabled={busy} onClick={() => move(addDays(week, -7))}>
          ← Semaine précédente
        </button>
        <label>
          Semaine du lundi
          <input
            type="date"
            aria-label="Semaine du lundi"
            value={week}
            disabled={busy}
            onChange={(e) => {
              if (e.target.value) move(weekOf(e.target.value));
            }}
          />
        </label>
        <button type="button" disabled={busy} onClick={() => move(addDays(week, 7))}>
          Semaine suivante →
        </button>
      </div>
      <p>
        Du {week} au {addDays(week, 6)} · <strong>{duration} prévues</strong>
        {saved ? ` · Version ${saved.version}` : ''}
      </p>
      <div className="hr-plan-days">
        {days.map((day, index) => {
          const h = day.hours;
          let total = '';
          try {
            total = h?.kind === 'work' ? hm(calculate(day.date, h).minutes) : '';
          } catch {
            total = 'Horaires à compléter';
          }
          return (
            <section className="hr-plan-day" key={day.date}>
              <h3>
                {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeZone: 'UTC' }).format(
                  new Date(day.date + 'T12:00Z'),
                )}
              </h3>
              <label>
                Statut — {day.date}
                <select
                  disabled={busy}
                  value={h?.kind || 'unplanned'}
                  onChange={(e) =>
                    update(
                      index,
                      e.target.value === 'unplanned'
                        ? null
                        : { ...(h || workHours()), kind: e.target.value as Hours['kind'] },
                    )
                  }
                >
                  <option value="unplanned">Non planifié</option>
                  {Object.entries(kinds).map(([k, n]) => (
                    <option key={k} value={k}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              {h?.kind === 'work' && (
                <>
                  <div className="hr-clocks">
                    <Clock
                      label={`Arrivée ${day.date}`}
                      value={h.arrival}
                      disabled={busy}
                      onChange={(arrival) => update(index, { ...h, arrival })}
                    />
                    <Clock
                      label={`Départ ${day.date}`}
                      value={h.departure}
                      disabled={busy}
                      onChange={(departure) => update(index, { ...h, departure })}
                    />
                  </div>
                  <label className="hr-check">
                    <input
                      type="checkbox"
                      checked={h.overnight}
                      disabled={busy}
                      onChange={(e) => update(index, { ...h, overnight: e.target.checked })}
                    />
                    Départ le lendemain
                  </label>
                  <div className="hr-clocks">
                    <Clock
                      label={`Début pause ${day.date}`}
                      value={h.breakStart}
                      disabled={busy}
                      onChange={(breakStart) => update(index, { ...h, breakStart })}
                    />
                    <Clock
                      label={`Fin pause ${day.date}`}
                      value={h.breakEnd}
                      disabled={busy}
                      onChange={(breakEnd) => update(index, { ...h, breakEnd })}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => update(index, { ...h, breakStart: '', breakEnd: '' })}
                  >
                    Sans pause
                  </button>
                  <p>{total}</p>
                </>
              )}
              {h && (
                <label>
                  Remarque — {day.date}
                  <input
                    maxLength={1000}
                    disabled={busy}
                    value={h.note}
                    onChange={(e) => update(index, { ...h, note: e.target.value })}
                  />
                </label>
              )}
            </section>
          );
        })}
      </div>
      <label>
        Consigne pour la semaine
        <textarea
          maxLength={1500}
          disabled={busy}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            changed();
          }}
        />
      </label>
      <div className="hr-actions">
        <button
          type="button"
          className="hr-primary"
          disabled={busy || !dirty}
          onClick={() => void save()}
        >
          {busy ? 'Enregistrement…' : 'Enregistrer le programme'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (
              !dirty ||
              confirm('Recharger la semaine et abandonner les modifications locales ?')
            ) {
              onDirty(false);
              setDirty(false);
              setBusy(true);
              onBusy(true);
              void planning('get', { employeeId: employee.id, week })
                .then((r) => {
                  if (!mounted.current) return;
                  setSaved(r.plan);
                  setDays(r.plan?.days || emptyWeek(week));
                  setNote(r.plan?.note || '');
                  setError('');
                })
                .catch((e) => {
                  if (mounted.current) setError(e.message);
                })
                .finally(() => {
                  if (!mounted.current) return;
                  setBusy(false);
                  onBusy(false);
                });
            }
          }}
        >
          Recharger la semaine
        </button>
      </div>
      <div className="hr-plan-share">
        <h3>Exporter et envoyer à ce salarié</h3>
        <label>
          Format du programme
          <select
            value={format}
            onChange={(e) => {
              setFile(null);
              setFormat(e.target.value as 'pdf' | 'xlsx');
            }}
          >
            <option value="pdf">PDF</option>
            <option value="xlsx">Excel</option>
          </select>
        </label>
        <div className="hr-actions">
          <button
            type="button"
            disabled={!file || dirty || busy}
            onClick={() => {
              if (file) download(file, file.name);
            }}
          >
            Télécharger {format === 'pdf' ? 'PDF' : 'Excel'}
          </button>
          <button
            type="button"
            className="hr-primary"
            disabled={!file || dirty || busy}
            onClick={() => void share()}
          >
            Partager sur WhatsApp
          </button>
        </div>
        {dirty && <p>Enregistrez les modifications avant de partager.</p>}
        {preparing && !dirty && <p role="status">Préparation du fichier…</p>}
        {saved && !dirty && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
            Ouvrir directement la conversation WhatsApp
          </a>
        )}
        <p className="hr-muted">
          Sur mobile : choisissez WhatsApp dans le partage de fichier. Sinon : le fichier se
          télécharge et WhatsApp s’ouvre avec le texte du programme ; joignez le fichier
          manuellement. Vous confirmez toujours l’envoi.
        </p>
      </div>
      {error && (
        <p className="hr-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="hr-notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
