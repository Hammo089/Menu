export const holidayCatalog = {
  ramadan: ['رمضان', 'Ramadan', 'gold'],
  fitr: ['عيد الفطر', 'Aïd el-Fitr', 'gold'],
  adha: ['عيد الأضحى', 'Aïd el-Adha', 'gold'],
  hijri: ['رأس السنة الهجرية', 'Nouvel An hégirien', 'gold'],
  mawlid: ['المولد النبوي', 'Mawlid', 'gold'],
  isra: ['الإسراء والمعراج', 'Al-Isra wal-Miraj', 'gold'],
  ashura: ['عاشوراء', 'Achoura', 'gold'],
  christmas: ['عيد الميلاد', 'Joyeux Noël', 'evergreen'],
  easter: ['عيد الفصح', 'Joyeuses Pâques', 'blossom'],
  palm: ['أحد الشعانين', 'Dimanche des Rameaux', 'blossom'],
  ascension: ['عيد الصعود', 'Ascension', 'blossom'],
  pentecost: ['العنصرة', 'Pentecôte', 'blossom'],
  epiphany: ['عيد الغطاس', 'Épiphanie', 'lights'],
  assumption: ['عيد انتقال العذراء', 'Assomption / Dormition', 'blossom'],
  allsaints: ['عيد جميع القديسين', 'Toussaint', 'lights'],
  newyear: ['رأس السنة الميلادية', 'Bonne année', 'lights'],
} as const;
export type HolidayId = keyof typeof holidayCatalog;
export type HolidayCalendar = 'western' | 'eastern' | 'both';
export type HolidaySettings = {
  holidayMode?: 'off' | 'auto' | HolidayId;
  holidayCalendar?: HolidayCalendar;
  holidayOffsetDays?: number;
  holidayOverrides?: Record<string, string>;
};
export type HolidayEvent = {
  id: HolidayId;
  key: string;
  date: string;
  tradition: 'western' | 'eastern' | 'islamic' | 'shared';
  before: number;
  after: number;
  priority: number;
};
const DAY = 86400000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
export const addDays = (date: string, days: number) =>
  iso(new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY));
export const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
  iso(new Date(`${value}T12:00:00Z`)) === value;
export function parisDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (key: string) => parts.find((p) => p.type === key)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function easterDate(year: number, eastern = false) {
  if (eastern) {
    const a = year % 4,
      b = year % 7,
      c = year % 19;
    const d = (19 * c + 15) % 30,
      e = (2 * a + 4 * b - d + 34) % 7;
    const month = Math.floor((d + e + 114) / 31),
      day = ((d + e + 114) % 31) + 1;
    const julianOffset = Math.floor(year / 100) - Math.floor(year / 400) - 2;
    return iso(new Date(Date.UTC(year, month - 1, day + julianOffset, 12)));
  }
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
    m = Math.floor((a + 11 * h + 22 * l) / 451);
  return iso(
    new Date(
      Date.UTC(
        year,
        Math.floor((h + l - 7 * m + 114) / 31) - 1,
        ((h + l - 7 * m + 114) % 31) + 1,
        12,
      ),
    ),
  );
}
const cache = new Map<string, HolidayEvent[]>();
export function holidaySchedule(year: number, calendar: HolidayCalendar = 'both'): HolidayEvent[] {
  const cacheKey = `${year}:${calendar}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;
  const events: HolidayEvent[] = [];
  const add = (
    id: HolidayId,
    date: string,
    tradition: HolidayEvent['tradition'],
    before = 0,
    after = 0,
    priority = 50,
  ) =>
    events.push({
      id,
      date,
      tradition,
      before,
      after,
      priority,
      key: `${id}:${tradition}:${date}`,
    });
  add('newyear', `${year}-01-01`, 'shared', 1, 1, 85);
  for (const tradition of ['western', 'eastern'] as const) {
    if (calendar !== 'both' && calendar !== tradition) continue;
    const east = tradition === 'eastern',
      easter = easterDate(year, east);
    add('christmas', `${year}-${east ? '01-07' : '12-25'}`, tradition, 5, 1, 90);
    add('epiphany', `${year}-${east ? '01-19' : '01-06'}`, tradition);
    add('easter', easter, tradition, 1, 1, 95);
    add('palm', addDays(easter, -7), tradition);
    add('ascension', addDays(easter, 39), tradition);
    add('pentecost', addDays(easter, 49), tradition, 0, 1);
    add('assumption', `${year}-${east ? '08-28' : '08-15'}`, tradition);
    add('allsaints', east ? addDays(easter, 56) : `${year}-11-01`, tradition);
  }
  const hijri = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'numeric',
  });
  // Umm al-Qura is a planning calendar; the administrator can correct moon-sighting dates.
  for (let time = Date.UTC(year, 0, 1, 12); time < Date.UTC(year + 1, 0, 1, 12); time += DAY) {
    const date = new Date(time),
      parts = hijri.formatToParts(date);
    const month = Number(parts.find((p) => p.type === 'month')?.value),
      day = Number(parts.find((p) => p.type === 'day')?.value),
      stamp = iso(date);
    if (month === 9 && day === 1) {
      let length = 29;
      const next = hijri.formatToParts(new Date(time + 29 * DAY));
      if (Number(next.find((p) => p.type === 'month')?.value) === 9) length = 30;
      add('ramadan', stamp, 'islamic', 0, length - 1, 20);
    }
    if (month === 10 && day === 1) add('fitr', stamp, 'islamic', 0, 2, 100);
    if (month === 12 && day === 10) add('adha', stamp, 'islamic', 0, 3, 100);
    if (month === 1 && day === 1) add('hijri', stamp, 'islamic');
    if (month === 1 && day === 10) add('ashura', stamp, 'islamic');
    if (month === 3 && day === 12) add('mawlid', stamp, 'islamic');
    if (month === 7 && day === 27) add('isra', stamp, 'islamic');
  }
  events.sort((a, b) => a.date.localeCompare(b.date));
  cache.set(cacheKey, events);
  return events;
}
export function activeHolidays(settings: HolidaySettings, now = new Date()): HolidayEvent[] {
  const mode = settings.holidayMode ?? 'auto';
  if (mode === 'off') return [];
  const today = parisDate(now),
    year = Number(today.slice(0, 4));
  if (mode !== 'auto')
    return [
      {
        id: mode,
        key: `manual:${mode}`,
        date: today,
        tradition: 'shared',
        before: 0,
        after: 0,
        priority: 100,
      },
    ];
  const result = [year - 1, year, year + 1]
    .flatMap((y) => holidaySchedule(y, settings.holidayCalendar ?? 'both'))
    .map((event) => {
      const override = settings.holidayOverrides?.[event.key];
      const date = isIsoDate(override)
        ? override
        : addDays(
            event.date,
            event.tradition === 'islamic' ? (settings.holidayOffsetDays ?? 0) : 0,
          );
      return { ...event, date };
    })
    .filter((e) => today >= addDays(e.date, -e.before) && today <= addDays(e.date, e.after))
    .sort((a, b) => b.priority - a.priority);
  // A shared Easter date should not produce duplicate greetings for the two calendars.
  return result.filter((e, i) => result.findIndex((x) => x.id === e.id) === i);
}
export function validHolidaySettings(settings: HolidaySettings) {
  return (
    (settings.holidayMode === undefined ||
      ['off', 'auto', ...Object.keys(holidayCatalog)].includes(settings.holidayMode)) &&
    (settings.holidayCalendar === undefined ||
      ['western', 'eastern', 'both'].includes(settings.holidayCalendar)) &&
    (settings.holidayOffsetDays === undefined ||
      (Number.isInteger(settings.holidayOffsetDays) &&
        Math.abs(settings.holidayOffsetDays) <= 2)) &&
    (settings.holidayOverrides === undefined ||
      (!!settings.holidayOverrides &&
        typeof settings.holidayOverrides === 'object' &&
        !Array.isArray(settings.holidayOverrides) &&
        Object.keys(settings.holidayOverrides).length <= 100 &&
        Object.entries(settings.holidayOverrides).every(
          ([key, value]) => key.length < 100 && isIsoDate(value),
        )))
  );
}
