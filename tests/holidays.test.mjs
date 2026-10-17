import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeHolidays,
  holidaySchedule,
  easterDate,
  parisDate,
  validHolidaySettings,
} from '../src/holidays.ts';
const noon = (date) => new Date(`${date}T12:00:00Z`);
test('Western and Julian Orthodox Easter use their own dates and converge in shared years', () => {
  assert.equal(easterDate(2026), '2026-04-05');
  assert.equal(easterDate(2026, true), '2026-04-12');
  assert.equal(easterDate(2027), '2027-03-28');
  assert.equal(easterDate(2027, true), '2027-05-02');
  assert.equal(easterDate(2025), easterDate(2025, true));
  const events = activeHolidays({ holidayCalendar: 'both' }, noon('2025-04-20'));
  assert.equal(events.filter((e) => e.id === 'easter').length, 1);
});
test('Both calendars include December and January Christmas without changing Western-only schedules', () => {
  const settings = { holidayMode: 'auto', holidayCalendar: 'both' };
  assert.ok(activeHolidays(settings, noon('2026-01-07')).some((e) => e.id === 'christmas'));
  assert.ok(activeHolidays(settings, noon('2026-12-25')).some((e) => e.id === 'christmas'));
  assert.ok(
    !activeHolidays({ holidayCalendar: 'western' }, noon('2026-01-07')).some(
      (e) => e.id === 'christmas',
    ),
  );
});
test('Hijri dates follow Umm al-Qura, honor overrides, and Eid supersedes Ramadan', () => {
  const events = holidaySchedule(2026, 'both');
  const fitr = events.find((e) => e.id === 'fitr');
  assert.equal(fitr.date, '2026-03-20');
  assert.equal(events.find((e) => e.id === 'adha').date, '2026-05-27');
  assert.equal(activeHolidays({}, noon('2026-03-20'))[0].id, 'fitr');
  assert.ok(activeHolidays({}, noon('2026-03-01')).some((e) => e.id === 'ramadan'));
  assert.ok(
    !activeHolidays({ holidayOffsetDays: 1 }, noon('2026-03-20')).some((e) => e.id === 'fitr'),
  );
  assert.ok(
    activeHolidays({ holidayOffsetDays: 1 }, noon('2026-03-21')).some((e) => e.id === 'fitr'),
  );
  assert.ok(
    activeHolidays({ holidayOverrides: { [fitr.key]: '2026-03-22' } }, noon('2026-03-22')).some(
      (e) => e.id === 'fitr',
    ),
  );
  assert.ok(
    !activeHolidays({ holidayOverrides: { [fitr.key]: '2026-03-22' } }, noon('2026-03-20')).some(
      (e) => e.id === 'fitr',
    ),
  );
});
test('Paris midnight and year-crossing New Year windows work; manual/off settings are respected', () => {
  assert.equal(parisDate(new Date('2025-12-31T23:30:00Z')), '2026-01-01');
  assert.ok(activeHolidays({}, noon('2026-12-31')).some((e) => e.id === 'newyear'));
  assert.deepEqual(activeHolidays({ holidayMode: 'off' }, noon('2026-12-25')), []);
  assert.equal(activeHolidays({ holidayMode: 'adha' }, noon('2026-10-17'))[0].id, 'adha');
  assert.equal(activeHolidays({}, noon('2026-10-17')).length, 0);
});
test('Holiday settings reject invalid dates and unsupported options while accepting existing menus', () => {
  assert.equal(validHolidaySettings({}), true);
  for (const invalid of [
    { holidayMode: 'unknown' },
    { holidayCalendar: 'wrong' },
    { holidayOffsetDays: 3 },
    { holidayOverrides: { x: '2026-02-30' } },
    { holidayOverrides: [] },
  ])
    assert.equal(validHolidaySettings(invalid), false);
});
