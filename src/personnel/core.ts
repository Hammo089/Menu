export type Kind = 'work' | 'paid_leave' | 'sick' | 'unpaid' | 'rest' | 'other';
export type Hours = {
  kind: Kind;
  arrival: string;
  breakStart: string;
  breakEnd: string;
  departure: string;
  overnight: boolean;
  note: string;
  minutes?: number;
  pauseMinutes?: number;
  startUtc?: string;
  endUtc?: string;
  breakStartUtc?: string | null;
  breakEndUtc?: string | null;
};
export type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  profile: Record<string, string>;
  weekly_hours: number;
  active: boolean;
  version: number;
};
export type Day = {
  employee_id: string;
  work_date: string;
  version: number;
  approved: Hours | null;
  proposed: Hours | null;
  proposal_state: 'none' | 'draft' | 'pending' | 'returned';
  review_note: string;
};
export type Report = {
  id: string;
  month: string;
  version: number;
  generated_at: string;
  snapshot: {
    employee: Employee;
    days: Day[];
    generatedAt: string;
    month: string;
    version: number;
  };
  file_path?: string;
};
export const kinds: Record<Kind, string> = {
  work: 'Travail',
  paid_leave: 'Congé payé',
  sick: 'Arrêt maladie',
  unpaid: 'Absence non rémunérée',
  rest: 'Repos',
  other: 'Autre absence',
};
export const emptyHours = (): Hours => ({
  kind: 'work',
  arrival: '',
  breakStart: '',
  breakEnd: '',
  departure: '',
  overnight: false,
  note: '',
});
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export function addDays(date: string, n: number) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
export function dates(month: string) {
  const a: string[] = [];
  for (let d = month + '-01'; d.startsWith(month); d = addDays(d, 1)) a.push(d);
  return a;
}
export function monday(date: string) {
  const d = new Date(date + 'T12:00Z').getUTCDay();
  return addDays(date, -((d + 6) % 7));
}
export const hm = (m: number) =>
  `${Math.floor(Math.abs(m) / 60)} h ${String(Math.round(Math.abs(m)) % 60).padStart(2, '0')}`;
export const decimal = (m: number) =>
  (m / 60).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function parisInstant(date: string, time: string, offset = 0) {
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error('Complétez les horaires.');
  const day = addDays(date, offset),
    nominal = Date.parse(day + 'T' + time + ':00Z');
  const format = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const candidates = [60, 120]
    .map((n) => nominal - n * 60000)
    .filter((t) => format.format(new Date(t)).replace(' ', 'T') === day + 'T' + time);
  if (!candidates.length)
    throw new Error('Heure inexistante lors du changement d’heure. Choisissez une autre heure.');
  return Math.max(...candidates);
}
export function calculate(date: string, h: Hours) {
  if (h.kind !== 'work')
    return {
      minutes: 0,
      pauseMinutes: 0,
      startUtc: null,
      endUtc: null,
      breakStartUtc: null,
      breakEndUtc: null,
    };
  const s = parisInstant(date, h.arrival),
    e = parisInstant(date, h.departure, h.overnight ? 1 : 0);
  if (e <= s || e - s > 25 * 3600000)
    throw new Error('Vérifiez le départ et l’option « lendemain ».');
  let b: number | null = null,
    c: number | null = null;
  if (!!h.breakStart !== !!h.breakEnd) throw new Error('Renseignez les deux horaires de pause.');
  if (h.breakStart) {
    b = parisInstant(date, h.breakStart, h.overnight && h.breakStart < h.arrival ? 1 : 0);
    c = parisInstant(date, h.breakEnd, h.overnight && h.breakEnd < h.arrival ? 1 : 0);
    if (b < s || c <= b || c > e)
      throw new Error('La pause doit être comprise entre l’arrivée et le départ.');
  }
  const pause = b !== null && c !== null ? (c - b) / 60000 : 0;
  return {
    minutes: (e - s) / 60000 - pause,
    pauseMinutes: pause,
    startUtc: new Date(s).toISOString(),
    endUtc: new Date(e).toISOString(),
    breakStartUtc: b === null ? null : new Date(b).toISOString(),
    breakEndUtc: c === null ? null : new Date(c).toISOString(),
  };
}
export function allocations(day: Day) {
  const h = day.approved;
  if (!h || h.kind !== 'work') return [];
  const c = calculate(day.work_date, h),
    s = Date.parse(c.startUtc!),
    e = Date.parse(c.endUtc!);
  const breaks =
    c.breakStartUtc && c.breakEndUtc
      ? [
          [s, Date.parse(c.breakStartUtc)],
          [Date.parse(c.breakEndUtc), e],
        ]
      : [[s, e]];
  const result: { date: string; minutes: number }[] = [];
  for (const [a, b] of breaks) {
    let t = a;
    while (t < b) {
      const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(
        new Date(t),
      );
      const midnight = parisInstant(addDays(date, 1), '00:00');
      const end = Math.min(midnight, b);
      result.push({ date, minutes: (end - t) / 60000 });
      t = end;
    }
  }
  return result;
}
export function totals(days: Day[], month: string) {
  const weeks: Record<string, number> = {},
    byDay: Record<string, number> = {},
    absences: Record<string, number> = {};
  const visibleWeeks = new Set(dates(month).map(monday));
  let minutes = 0,
    pauses = 0;
  for (const day of days) {
    for (const a of allocations(day)) {
      const week = monday(a.date);
      if (visibleWeeks.has(week)) weeks[week] = (weeks[week] || 0) + a.minutes;
      if (a.date.startsWith(month)) {
        minutes += a.minutes;
        byDay[a.date] = (byDay[a.date] || 0) + a.minutes;
      }
    }
    if (day.work_date.startsWith(month) && day.approved) {
      if (day.approved.kind === 'work') {
      } else absences[day.approved.kind] = (absences[day.approved.kind] || 0) + 1;
    }
  }
  for (const day of days) {
    if (day.approved?.kind !== 'work') continue;
    const h = calculate(day.work_date, day.approved);
    if (!h.breakStartUtc || !h.breakEndUtc) continue;
    let t = Date.parse(h.breakStartUtc),
      end = Date.parse(h.breakEndUtc);
    while (t < end) {
      const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(
        new Date(t),
      );
      const boundary = Math.min(end, parisInstant(addDays(date, 1), '00:00'));
      if (date.startsWith(month)) pauses += (boundary - t) / 60000;
      t = boundary;
    }
  }
  return { minutes, pauses, worked: Object.keys(byDay).length, weeks, byDay, absences };
}
export function holidays(year: number) {
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    mo = Math.floor((h + l - 7 * m + 114) / 31),
    da = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = `${year}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
  const map: Record<string, string> = {};
  for (const [date, name] of Object.entries({
    '01-01': 'Jour de l’An',
    '05-01': 'Fête du Travail · 1er mai',
    '05-08': 'Victoire 1945',
    '07-14': 'Fête nationale',
    '08-15': 'Assomption',
    '11-01': 'Toussaint',
    '11-11': 'Armistice',
    '12-25': 'Noël',
  }))
    map[`${year}-${date}`] = name;
  map[addDays(easter, 1)] = 'Lundi de Pâques';
  map[addDays(easter, 39)] = 'Ascension';
  map[addDays(easter, 50)] = 'Lundi de Pentecôte';
  return map;
}
export const fullName = (e: Employee) => [e.first_name, e.last_name].filter(Boolean).join(' ');
