import { useEffect, useRef, useState } from 'react';
import { personnel } from './api';
import {
  calculate,
  emptyHours,
  holidays,
  hm,
  kinds,
  type Day,
  type Hours,
  type Kind,
} from './core';
function Clock({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  disabled: boolean;
}) {
  const [h, m] = value ? value.split(':') : ['', ''];
  return (
    <fieldset className="hr-clock" disabled={disabled}>
      <legend>{label}</legend>
      <div>
        <select
          aria-label={label + ' — heure'}
          value={h}
          onChange={(e) => onChange(e.target.value ? e.target.value + ':' + (m || '00') : '')}
        >
          <option value="">Heure</option>
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i}>{String(i).padStart(2, '0')}</option>
          ))}
        </select>
        <span>:</span>
        <select
          aria-label={label + ' — minute'}
          value={m}
          onChange={(e) => onChange((h || '00') + ':' + e.target.value)}
        >
          <option value="" disabled>
            Min.
          </option>
          {Array.from({ length: 60 }, (_, i) => (
            <option key={i}>{String(i).padStart(2, '0')}</option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}
export default function DayEditor({
  date,
  day,
  employeeId,
  session,
  onSaved,
  onDirty,
  onReload,
  carried = 0,
}: {
  date: string;
  day: Day | undefined;
  employeeId: string;
  session?: string;
  onSaved: (day: Day) => void;
  onDirty: (dirty: boolean) => void;
  onReload: () => void;
  carried?: number;
}) {
  const [hours, setHours] = useState<Hours>(() => day?.proposed || day?.approved || emptyHours()),
    [withPause, setWithPause] = useState(!!(day?.proposed || day?.approved)?.breakStart),
    [note, setNote] = useState(''),
    [error, setError] = useState(''),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  const version = useRef(day?.version || 0),
    generation = useRef(0),
    dirty = useRef(false),
    latest = useRef(hours),
    saved = useRef(''),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    writing = useRef(false),
    mounted = useRef(true);
  const admin = !session;
  let preview = '';
  try {
    preview = hm(calculate(date, hours).minutes);
  } catch (e) {
    preview = (e as Error).message;
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      generation.current++;
    };
  }, []);
  async function save(mode: 'draft' | 'submit' | 'approve') {
    if (writing.current) return;
    writing.current = true;
    onDirty(true);
    setBusy(true);
    setError('');
    if (timer.current) clearTimeout(timer.current);
    const ticket = ++generation.current,
      submitted = latest.current;
    let success = false;
    try {
      if (
        mode !== 'draft' &&
        withPause &&
        submitted.kind === 'work' &&
        (!submitted.breakStart || !submitted.breakEnd)
      )
        throw new Error('Renseignez le début et la fin de pause.');
      const data = await personnel(session ? 'employee_save' : 'day_save', {
        employeeId,
        session,
        date,
        version: version.current,
        hours: submitted,
        mode,
        reviewNote: note,
      });
      success = true;
      version.current = data.day.version;
      saved.current = JSON.stringify(submitted);
      dirty.current = JSON.stringify(latest.current) !== saved.current;
      if (mounted.current && ticket === generation.current) {
        onSaved(data.day);
        setStatus(
          mode === 'draft'
            ? 'Brouillon enregistré automatiquement.'
            : mode === 'submit'
              ? 'Envoyé à la direction.'
              : 'Horaires validés.',
        );
        if (mode !== 'draft') {
          setHours(data.day.proposed || data.day.approved || emptyHours());
          dirty.current = false;
        }
        onDirty(dirty.current);
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      writing.current = false;
      if (mounted.current) {
        setBusy(false);
        onDirty(dirty.current);
      }
      if (success && dirty.current && mounted.current && mode === 'draft') schedule();
    }
  }
  function schedule() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!writing.current && dirty.current) void save('draft');
    }, 1200);
  }
  function change(patch: Partial<Hours>) {
    setHours((old) => {
      const value = { ...old, ...patch };
      latest.current = value;
      dirty.current = true;
      return value;
    });
    onDirty(true);
    setStatus('Modification en cours…');
    schedule();
  }
  async function decision(value: 'approve' | 'return' | 'discard') {
    if (timer.current) clearTimeout(timer.current);
    onDirty(true);
    setBusy(true);
    setError('');
    try {
      const data = await personnel(value === 'discard' ? 'day_discard' : 'day_review', {
        employeeId,
        date,
        version: version.current,
        decision: value,
        reviewNote: note,
      });
      if (!mounted.current) return;
      version.current = data.day.version;
      dirty.current = false;
      onDirty(false);
      latest.current = data.day.proposed || data.day.approved || emptyHours();
      setHours(latest.current);
      onSaved(data.day);
      setStatus(
        value === 'return'
          ? 'Demande renvoyée avec commentaire.'
          : value === 'discard'
            ? 'Demande retirée.'
            : 'Demande validée.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (mounted.current) {
        setBusy(false);
        onDirty(dirty.current);
      }
    }
  }
  const holiday = holidays(+date.slice(0, 4))[date];
  return (
    <section className="hr-day-editor">
      <div className="hr-editor-heading">
        <span>JOURNÉE</span>
        <h2>
          {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeZone: 'UTC' }).format(
            new Date(date + 'T12:00Z'),
          )}
        </h2>
        {holiday && <p className="hr-holiday">✦ {holiday} — les heures restent à déclarer.</p>}
      </div>
      {carried > 0 && (
        <p className="hr-notice">
          Report validé du poste de la veille : {hm(carried)}. Saisissez ici uniquement un nouveau
          début de poste ; le report se corrige sur sa journée d’origine.
        </p>
      )}
      {day?.review_note && <p className="hr-notice">Direction : {day.review_note}</p>}
      {day?.approved && day.proposal_state !== 'none' && (
        <p className="hr-notice">
          Les heures déjà validées restent inchangées tant que cette correction n’est pas approuvée.
        </p>
      )}
      <label>
        Type de journée
        <select
          disabled={busy}
          value={hours.kind}
          onChange={(e) => change({ kind: e.target.value as Kind })}
        >
          {Object.entries(kinds).map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </select>
      </label>
      {hours.kind === 'work' && (
        <>
          <div className="hr-clocks">
            <Clock
              label="Arrivée"
              value={hours.arrival}
              onChange={(arrival) => change({ arrival })}
              disabled={busy}
            />
            <Clock
              label="Départ"
              value={hours.departure}
              onChange={(departure) => change({ departure })}
              disabled={busy}
            />
          </div>
          <label className="hr-check">
            <input
              type="checkbox"
              checked={hours.overnight}
              disabled={busy}
              onChange={(e) => change({ overnight: e.target.checked })}
            />
            Le départ est le lendemain
          </label>
          <label className="hr-check">
            <input
              type="checkbox"
              checked={withPause}
              disabled={busy}
              onChange={(e) => {
                setWithPause(e.target.checked);
                if (!e.target.checked) change({ breakStart: '', breakEnd: '' });
              }}
            />
            Avec une pause
          </label>
          {withPause && (
            <div className="hr-clocks">
              <Clock
                label="Début pause"
                value={hours.breakStart}
                onChange={(breakStart) => change({ breakStart })}
                disabled={busy}
              />
              <Clock
                label="Fin pause"
                value={hours.breakEnd}
                onChange={(breakEnd) => change({ breakEnd })}
                disabled={busy}
              />
            </div>
          )}
          <div className="hr-duration">
            <span>Temps de travail calculé</span>
            <strong>{preview}</strong>
          </div>
        </>
      )}
      <label>
        Remarque
        <textarea
          maxLength={1000}
          value={hours.note}
          disabled={busy}
          onChange={(e) => change({ note: e.target.value })}
        />
      </label>
      {admin && (
        <label>
          Commentaire de validation / motif de correction
          <textarea
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Obligatoire pour corriger des heures validées ou renvoyer une demande"
          />
        </label>
      )}
      {error && (
        <p role="alert" className="hr-error">
          {error}
        </p>
      )}
      <p role="status" className="hr-save-status">
        {busy
          ? 'Enregistrement…'
          : status || 'Les modifications sont sauvegardées comme brouillon.'}
      </p>
      <div className="hr-actions">
        <button
          type="button"
          disabled={busy}
          className="hr-primary"
          onClick={() => void save(admin ? 'approve' : 'submit')}
        >
          {admin ? 'Valider ces horaires' : 'Envoyer pour validation'}
        </button>
        <button type="button" disabled={busy} onClick={() => void save('draft')}>
          Enregistrer le brouillon
        </button>
      </div>
      {admin && day?.proposal_state === 'pending' && (
        <div className="hr-review">
          <strong>Demande en attente</strong>
          <button
            type="button"
            disabled={busy || dirty.current}
            onClick={() => void decision('approve')}
          >
            Approuver la demande reçue
          </button>
          <button
            type="button"
            disabled={busy || dirty.current}
            onClick={() => void decision('return')}
          >
            Renvoyer pour correction
          </button>
        </div>
      )}
      {day && day.proposal_state !== 'none' && (
        <button
          type="button"
          className="hr-text-button"
          disabled={busy}
          onClick={() => {
            if (confirm('Retirer cette proposition ? Les heures déjà validées seront conservées.'))
              void decision('discard');
          }}
        >
          Retirer la proposition
        </button>
      )}
      <button
        type="button"
        className="hr-text-button"
        disabled={busy}
        onClick={() => {
          if (
            !dirty.current ||
            confirm('Abandonner les modifications locales et recharger la journée ?')
          )
            onReload();
        }}
      >
        Recharger cette journée
      </button>
    </section>
  );
}
