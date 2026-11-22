import { useState } from 'react';
import { personnel } from './api';
import { kinds, type Kind } from './core';
export default function Absence({
  employeeId,
  session,
  date,
  onSaved,
  onBusy,
}: {
  employeeId: string;
  session?: string;
  date: string;
  onSaved: () => Promise<void>;
  onBusy: (b: boolean) => void;
}) {
  const [open, setOpen] = useState(false),
    [start, setStart] = useState(date),
    [end, setEnd] = useState(date),
    [kind, setKind] = useState<Kind>('paid_leave'),
    [note, setNote] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <section className="hr-card hr-absence">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
        Absence / repos sur une période
      </button>
      {open && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            onBusy(true);
            setError('');
            try {
              await personnel(session ? 'employee_absence_range' : 'absence_range', {
                employeeId,
                session,
                date: start,
                endDate: end,
                kind,
                note,
              });
              await onSaved();
              setOpen(false);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
              onBusy(false);
            }
          }}
        >
          <p>
            Les journées déjà renseignées ne seront pas écrasées. Toute la période est annulée en
            cas de conflit.
          </p>
          <div className="hr-profile-grid">
            <label>
              Premier jour
              <input
                type="date"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              Dernier jour inclus
              <input
                type="date"
                required
                min={start}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
          <label>
            Type d’absence
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              {Object.entries(kinds)
                .filter(([k]) => k !== 'work')
                .map(([k, n]) => (
                  <option key={k} value={k}>
                    {n}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Remarque
            <textarea maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {error && (
            <p role="alert" className="hr-error">
              {error}
            </p>
          )}
          <button className="hr-primary" disabled={busy}>
            {session ? 'Envoyer la période pour validation' : 'Valider la période'}
          </button>
        </form>
      )}
    </section>
  );
}
