import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/personnel/core.ts', import.meta.url), 'utf8'),
  compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
const c = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const h = {
  kind: 'work',
  arrival: '11:15',
  departure: '19:15',
  breakStart: '14:00',
  breakEnd: '15:00',
  overnight: false,
  note: '',
};
test('time calculation preserves minute accuracy, validates pauses and real Paris DST', () => {
  assert.equal(c.calculate('2026-01-02', h).minutes, 420);
  assert.equal(c.decimal(151 * 60 + 40), '151,67');
  assert.throws(() => c.calculate('2026-01-02', { ...h, breakEnd: '' }), /deux/);
  assert.throws(() => c.calculate('2026-01-02', { ...h, departure: '09:00' }), /lendemain/);
  assert.equal(
    c.calculate('2026-03-29', {
      ...h,
      arrival: '01:00',
      departure: '04:00',
      breakStart: '',
      breakEnd: '',
    }).minutes,
    120,
  );
  assert.equal(
    c.calculate('2026-10-25', {
      ...h,
      arrival: '01:00',
      departure: '04:00',
      breakStart: '',
      breakEnd: '',
    }).minutes,
    240,
  );
  assert.throws(() => c.calculate('2026-03-29', { ...h, arrival: '02:30' }), /inexistante/);
});
test('overnight work and pauses split across month and ISO week boundaries; pending corrections excluded', () => {
  const approved = {
    ...h,
    arrival: '22:00',
    departure: '06:00',
    breakStart: '01:00',
    breakEnd: '01:30',
    overnight: true,
  };
  const day = {
    work_date: '2026-01-31',
    employee_id: 'a',
    approved,
    proposed: { ...approved, departure: '08:00' },
    proposal_state: 'pending',
  };
  const january = c.totals([day], '2026-01'),
    february = c.totals([day], '2026-02');
  assert.equal(january.minutes, 120);
  assert.equal(january.pauses, 0);
  assert.equal(february.minutes, 330);
  assert.equal(february.pauses, 30);
  assert.equal(february.worked, 1);
  const sunday = { ...day, work_date: '2026-02-01' };
  const sum = c.totals([sunday], '2026-02');
  assert.equal(sum.weeks['2026-01-26'], 120);
  assert.equal(sum.weeks['2026-02-02'], 330);
  assert.equal(c.totals([{ ...day, approved: null }], '2026-01').minutes, 0);
});
test('French metropolitan holiday calendar, month lengths and leap years are generated', () => {
  assert.equal(c.dates('2024-02').length, 29);
  assert.equal(c.dates('2026-02').length, 28);
  assert.equal(c.dates('2026-04').length, 30);
  const holidays = c.holidays(2026);
  assert.equal(Object.keys(holidays).length, 11);
  assert.equal(holidays['2026-04-06'], 'Lundi de Pâques');
  assert.ok(holidays['2026-05-01'].includes('1er mai'));
  assert.equal(holidays['2026-04-03'], undefined);
});

test('accountant daily rows reconcile with real monthly totals across a midnight boundary', () => {
  const reportSource = readFileSync(
    new URL('../src/personnel/reports.ts', import.meta.url),
    'utf8',
  );
  const body = reportSource.slice(
    reportSource.indexOf('export function reportRows'),
    reportSource.indexOf('const clean ='),
  );
  const js = ts.transpileModule(body.replace('export function', 'function'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const rows = new Function(
    'dates',
    'holidays',
    'totals',
    'allocations',
    'kinds',
    'hm',
    js + '; return reportRows;',
  )(c.dates, c.holidays, c.totals, c.allocations, c.kinds, c.hm);
  const day = {
    work_date: '2026-01-31',
    approved: {
      ...h,
      arrival: '22:00',
      departure: '06:00',
      breakStart: '01:00',
      breakEnd: '01:30',
      overnight: true,
    },
  };
  const january = rows({ snapshot: { month: '2026-01', days: [day] } }),
    february = rows({ snapshot: { month: '2026-02', days: [day] } });
  assert.equal(january[30][8], '2 h 00');
  assert.equal(
    january.reduce((sum, r) => sum + (Number(r[9]) || 0), 0),
    2,
  );
  assert.equal(february[0][3], 'Report de veille');
  assert.equal(february[0][8], '5 h 30');
  assert.equal(
    february.reduce((sum, r) => sum + (Number(r[9]) || 0), 0),
    5.5,
  );
});
