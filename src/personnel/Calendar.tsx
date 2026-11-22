import { dates, holidays, hm, totals, type Day } from './core';
export function MonthPicker({ month, onChange }: { month: string; onChange: (s: string) => void }) {
  return (
    <div className="hr-month-picker">
      <label>
        Mois
        <select
          aria-label="Mois"
          value={month.slice(5)}
          onChange={(e) => onChange(month.slice(0, 5) + e.target.value)}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={String(i + 1).padStart(2, '0')}>
              {new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date(2024, i, 1))}
            </option>
          ))}
        </select>
      </label>
      <label>
        Année
        <select
          aria-label="Année"
          value={month.slice(0, 4)}
          onChange={(e) => onChange(e.target.value + month.slice(4))}
        >
          {Array.from({ length: new Date().getFullYear() - 2000 + 3 }, (_, i) => (
            <option key={i}>{2000 + i}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
export function Calendar({
  month,
  days,
  selected,
  onSelect,
}: {
  month: string;
  days: Day[];
  selected: string;
  onSelect: (d: string) => void;
}) {
  const all = dates(month),
    padding = (new Date(all[0] + 'T12:00Z').getUTCDay() + 6) % 7,
    holy = holidays(+month.slice(0, 4)),
    actual = totals(days, month).byDay;
  return (
    <section className="hr-calendar" aria-label="Calendrier mensuel">
      <div className="hr-weekdays">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <div className="hr-days">
        {Array.from({ length: padding }, (_, i) => (
          <span key={'pad' + i} />
        ))}
        {all.map((date) => {
          const d = days.find((x) => x.work_date === date),
            state =
              d?.proposal_state && d.proposal_state !== 'none'
                ? d.proposal_state
                : d?.approved || actual[date]
                  ? 'approved'
                  : 'empty';
          const duration = actual[date] ? hm(actual[date]) : '';
          return (
            <button
              type="button"
              key={date}
              className={`hr-day ${state} ${date === selected ? 'selected' : ''} ${[0, 6].includes(new Date(date + 'T12:00Z').getUTCDay()) ? 'weekend' : ''}`}
              aria-label={new Intl.DateTimeFormat('fr-FR', {
                dateStyle: 'full',
                timeZone: 'UTC',
              }).format(new Date(date + 'T12:00Z'))}
              aria-pressed={selected === date}
              onClick={() => onSelect(date)}
            >
              <b>{Number(date.slice(8))}</b>
              {holy[date] && (
                <span className="hr-holiday-dot" title={holy[date]}>
                  ✦
                </span>
              )}
              <small>
                {duration ||
                  {
                    draft: 'Brouillon',
                    pending: 'À valider',
                    returned: 'À corriger',
                    approved: 'Validé',
                    empty: '—',
                  }[state]}
              </small>
            </button>
          );
        })}
      </div>
      <div className="hr-legend">
        <span>● Validé</span>
        <span>● À valider</span>
        <span>● À corriger</span>
        <span>✦ Jour férié</span>
      </div>
    </section>
  );
}
