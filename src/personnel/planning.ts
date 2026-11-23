import {
  addDays,
  calculate,
  emptyHours,
  fullName,
  hm,
  kinds,
  monday,
  type Employee,
  type Hours,
} from './core';
export type PlanDay = { date: string; hours: Hours | null };
export type WeeklyPlan = {
  employee_id: string;
  week_start: string;
  days: PlanDay[];
  note: string;
  version: number;
  updated_at: string;
};
export const emptyWeek = (week: string): PlanDay[] =>
  Array.from({ length: 7 }, (_, i) => ({ date: addDays(week, i), hours: null }));
export const weekOf = monday;
export const plannedMinutes = (days: PlanDay[]) =>
  days.reduce((sum, d) => sum + (d.hours ? calculate(d.date, d.hours).minutes : 0), 0);
export function planRows(plan: WeeklyPlan): unknown[][] {
  return plan.days.map((d) => {
    const h = d.hours;
    return [
      d.date,
      new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' }).format(
        new Date(d.date + 'T12:00Z'),
      ),
      h ? kinds[h.kind] : 'Non planifié',
      h?.kind === 'work' ? h.arrival : '',
      h?.kind === 'work' ? h.breakStart : '',
      h?.kind === 'work' ? h.breakEnd : '',
      h?.kind === 'work' ? h.departure + (h.overnight ? ' (+1j)' : '') : '',
      h?.kind === 'work' ? hm(calculate(d.date, h).minutes) : '',
      h?.kind === 'work' ? calculate(d.date, h).minutes / 60 : '',
      h?.note || '',
    ];
  });
}
export function whatsappUrl(employee: Employee, plan: WeeklyPlan) {
  let phone = (employee.profile.phone || '').replace(/\D/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  else if (phone.startsWith('0')) phone = '33' + phone.slice(1);
  if (!/^[1-9][0-9]{7,14}$/.test(phone)) phone = '';
  const text = [
    `Bonjour ${fullName(employee)}, voici votre planning Blanco du ${plan.week_start} au ${addDays(plan.week_start, 6)}.`,
    ...planRows(plan).map(
      (r) =>
        `${r[1]} ${r[0]} : ${r[2]}${r[3] ? ' ' + r[3] + '–' + r[6] : ''}${r[4] ? ' (pause ' + r[4] + '–' + r[5] + ')' : ''}`,
    ),
    plan.note,
    'Planning prévisionnel. Le fichier PDF ou Excel est à joindre à ce message.',
  ]
    .filter(Boolean)
    .join('\n');
  return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(text);
}
export const workHours = (): Hours => ({ ...emptyHours(), arrival: '09:00', departure: '17:00' });
