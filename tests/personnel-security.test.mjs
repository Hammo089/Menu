import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
test('personnel: scoped PIN sessions, private profiles, approval revisions, calendar arithmetic and immutable reports', async (t) => {
  const db = new PGlite({ extensions: { pgcrypto } });
  t.after(() => db.close());
  const owner = randomUUID();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema extensions;create extension pgcrypto with schema extensions;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,bucket_id text);alter table storage.objects enable row level security;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table public.menu_admins(user_id uuid primary key);grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
  );
  await db.query('insert into public.menu_admins values($1)', [owner]);
  await db.exec(
    readFileSync(
      new URL('../supabase/migrations/20261122202414_personnel.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        '../supabase/migrations/20261122204701_personnel_absence_ranges.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        '../supabase/migrations/20261123145935_personnel_weekly_planning.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const planRpc = async (action, payload = {}) =>
    (
      await db.query('select public.personnel_planning($1,$2::jsonb) result', [
        action,
        JSON.stringify(payload),
      ])
    ).rows[0].result;
  const role = async (id) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || '']);
    await db.exec('set role ' + (id ? 'authenticated' : 'anon'));
  };
  const rpc = async (action, payload = {}) =>
    (
      await db.query('select public.personnel_api($1,$2::jsonb) result', [
        action,
        JSON.stringify(payload),
      ])
    ).rows[0].result;
  await role();
  await assert.rejects(rpc('dashboard', { month: '2026-01' }), /réservé/);
  await role(randomUUID());
  await assert.rejects(rpc('dashboard', { month: '2026-01' }), /réservé/);
  await role(owner);
  let dash = await rpc('dashboard', { month: '2026-01' });
  assert.equal(dash.employees.length, 2);
  const a = dash.employees[0].id,
    b = dash.employees[1].id;
  const employee = {
    ...dash.employees[0],
    profile: {
      phone: '0612345678',
      alternatePhone: '0611111111',
      emergencyPhone: '0622222222',
      address: 'Private address',
      notes: 'Management only',
    },
    weekly_hours: 35,
  };
  await rpc('profile_save', { employeeId: a, employee });
  await assert.rejects(rpc('profile_save', { employeeId: a, employee }), /modifiée/);
  const access = await rpc('access_reset', { employeeId: a, pin: '482951' });
  const accessB = await rpc('access_reset', { employeeId: b, pin: '739284' });
  assert.match(access.link, /^[a-f0-9]{64}$/);
  await role();
  const sa = 'a'.repeat(64),
    sb = 'b'.repeat(64);
  assert.ok((await rpc('employee_login', { link: access.link, pin: '999999', session: sa })).error);
  await rpc('employee_login', { link: access.link, pin: '482951', session: sa });
  await rpc('employee_login', { link: accessB.link, pin: '739284', session: sb });
  const m = await rpc('employee_month', { session: sa, employeeId: b, month: '2026-01' });
  assert.equal(m.employee.id, a);
  assert.equal(m.employee.profile, undefined);
  assert.equal(m.audit, undefined);
  await assert.rejects(db.query('select * from blanco_private.hr_employees'), /permission denied/);
  const hours = {
    kind: 'work',
    arrival: '11:15',
    breakStart: '14:00',
    breakEnd: '15:00',
    departure: '19:15',
    overnight: false,
    note: '',
  };
  await assert.rejects(
    rpc('employee_save', { session: sa, date: '2026-01-02', version: 0, hours, mode: 'approve' }),
    /réservée/,
  );
  let day = (
    await rpc('employee_save', {
      session: sa,
      employeeId: b,
      date: '2026-01-02',
      version: 0,
      hours,
      mode: 'submit',
    })
  ).day;
  assert.equal(day.employee_id, a);
  assert.equal(day.approved, null);
  assert.equal(day.proposal_state, 'pending');
  await role(owner);
  await assert.rejects(
    rpc('report_create', { employeeId: a, month: '2026-01', requestId: randomUUID() }),
    /demandes/,
  );
  day = (
    await rpc('day_review', {
      employeeId: a,
      date: '2026-01-02',
      version: day.version,
      decision: 'approve',
    })
  ).day;
  assert.equal(day.approved.minutes, 420);
  const requestId = randomUUID();
  let report = (await rpc('report_create', { employeeId: a, month: '2026-01', requestId })).report;
  assert.equal(report.snapshot.days[0].approved.minutes, 420);
  assert.equal(
    (await rpc('report_create', { employeeId: a, month: '2026-01', requestId })).report.id,
    report.id,
  );
  await role();
  day = (
    await rpc('employee_save', {
      session: sa,
      date: '2026-01-02',
      version: day.version,
      hours: { ...hours, departure: '20:15' },
      mode: 'submit',
    })
  ).day;
  assert.equal(day.approved.minutes, 420, 'pending correction must not replace approved hours');
  const other = await rpc('employee_month', { session: sb, month: '2026-01' });
  assert.equal(other.days.length, 0);
  await role(owner);
  await assert.rejects(
    rpc('day_review', { employeeId: a, date: '2026-01-02', version: 1, decision: 'approve' }),
    /ailleurs/,
  );
  day = (
    await rpc('day_review', {
      employeeId: a,
      date: '2026-01-02',
      version: day.version,
      decision: 'return',
      reviewNote: 'Vérifier le départ',
    })
  ).day;
  assert.equal(day.approved.minutes, 420);
  assert.equal(day.proposal_state, 'returned');
  await rpc('day_discard', { employeeId: a, date: '2026-01-02', version: day.version });
  assert.equal(
    (await rpc('report_get', { reportId: report.id })).report.snapshot.days[0].approved.minutes,
    420,
  );
  const second = (
    await rpc('report_create', { employeeId: a, month: '2026-01', requestId: randomUUID() })
  ).report;
  assert.equal(second.version, 2);
  await assert.rejects(
    rpc('day_save', {
      employeeId: a,
      date: '2026-01-03',
      version: 0,
      mode: 'approve',
      hours: { ...hours, breakEnd: '10:00' },
    }),
    /pause/,
  );
  const night = {
    ...hours,
    arrival: '22:00',
    departure: '06:00',
    breakStart: '01:00',
    breakEnd: '01:30',
    overnight: true,
  };
  const overnight = (
    await rpc('day_save', {
      employeeId: a,
      date: '2026-01-31',
      version: 0,
      mode: 'approve',
      hours: night,
    })
  ).day;
  assert.equal(overnight.approved.minutes, 450);
  await assert.rejects(
    rpc('day_save', {
      employeeId: a,
      date: '2026-02-01',
      version: 0,
      mode: 'approve',
      hours: { ...hours, arrival: '05:00', departure: '07:00', breakStart: '', breakEnd: '' },
    }),
    /chevauchent/,
  );
  const spring = (
    await rpc('day_save', {
      employeeId: a,
      date: '2026-03-29',
      version: 0,
      mode: 'approve',
      hours: { ...hours, arrival: '01:00', departure: '04:00', breakStart: '', breakEnd: '' },
    })
  ).day;
  assert.equal(spring.approved.minutes, 120, 'spring clock change uses elapsed hours');
  await assert.rejects(
    rpc('day_save', {
      employeeId: a,
      date: '2026-03-29',
      version: spring.version,
      mode: 'approve',
      reviewNote: 'Correction',
      hours: { ...hours, arrival: '02:30', departure: '04:00', breakStart: '', breakEnd: '' },
    }),
    /inexistante/,
  );
  await rpc('access_reset', { employeeId: a, pin: '517394' });
  await role();
  await assert.rejects(rpc('employee_month', { session: sa, month: '2026-01' }), /expiré/);
  assert.ok(
    (await rpc('employee_login', { link: access.link, pin: '482951', session: 'c'.repeat(64) }))
      .error,
  );
  await role(owner);
  await rpc('document_add', {
    employeeId: a,
    path: a + '/' + randomUUID() + '.pdf',
    name: 'Justificatif.pdf',
  });
  await assert.rejects(
    rpc('document_add', {
      employeeId: a,
      path: b + '/' + randomUUID() + '.pdf',
      name: 'Other.pdf',
    }),
    /invalide/,
  );
  await rpc('report_file', { reportId: report.id, path: a + '/' + report.id + '.pdf' });
  await assert.rejects(
    rpc('report_file', { reportId: report.id, path: b + '/' + report.id + '.pdf' }),
    /invalide/,
  );
  const newAccess = await rpc('access_reset', { employeeId: a, pin: '593817' });
  await role();
  await rpc('employee_login', { link: newAccess.link, pin: '593817', session: 'd'.repeat(64) });
  await role(owner);
  const latest = (await rpc('dashboard', { month: '2026-01' })).employees.find((e) => e.id === a);
  await rpc('profile_save', { employeeId: a, employee: { ...latest, active: false } });
  await role();
  await assert.rejects(
    rpc('employee_month', { session: 'd'.repeat(64), month: '2026-01' }),
    /expiré/,
  );
  await role(owner);
  const archived = (await rpc('dashboard', { month: '2026-01' })).employees.find((e) => e.id === a);
  await rpc('profile_save', { employeeId: a, employee: { ...archived, active: true } });
  await role();
  assert.ok(
    (await rpc('employee_login', { link: newAccess.link, pin: '593817', session: 'e'.repeat(64) }))
      .error,
  );
  await role(owner);
  const range = await rpc('absence_range', {
    employeeId: b,
    date: '2026-05-01',
    endDate: '2026-05-03',
    kind: 'rest',
    note: 'Repos prévu',
  });
  assert.equal(range.days, 3);
  await assert.rejects(
    rpc('absence_range', {
      employeeId: b,
      date: '2026-05-03',
      endDate: '2026-05-05',
      kind: 'sick',
    }),
    /déjà renseignée/,
  );
  const may = await rpc('month', { employeeId: b, month: '2026-05' });
  assert.equal(may.days.length, 3, 'Conflict must roll back the entire range');
  await role();
  const staffRange = await rpc('employee_absence_range', {
    session: sb,
    employeeId: a,
    date: '2026-06-01',
    endDate: '2026-06-02',
    kind: 'paid_leave',
  });
  assert.equal(staffRange.days, 2);
  const june = await rpc('employee_month', { session: sb, month: '2026-06' });
  assert.ok(
    june.days.every(
      (d) => d.employee_id === b && d.approved === null && d.proposal_state === 'pending',
    ),
  );
  await role(owner);
  await role();
  await assert.rejects(planRpc('get', { employeeId: a, week: '2026-11-23' }), /réservé/);
  await role(owner);
  const dayCount = (await rpc('export_backup')).days.length;
  const planDays = Array.from({ length: 7 }, (_, i) => ({
    date: 'forged-date',
    hours:
      i === 0
        ? { ...hours, breakStart: '', breakEnd: '', arrival: '09:00', departure: '17:00' }
        : null,
  }));
  const plan = (
    await planRpc('save', {
      employeeId: a,
      week: '2026-11-23',
      version: 0,
      days: planDays,
      note: 'Planning test',
    })
  ).plan;
  assert.equal(plan.version, 1);
  assert.equal(plan.days[0].date, '2026-11-23');
  assert.equal(plan.days[0].hours.minutes, 480);
  assert.equal(
    (await rpc('export_backup')).days.length,
    dayCount,
    'Planned shifts must never create actual work records',
  );
  await assert.rejects(
    planRpc('save', { employeeId: a, week: '2026-11-23', version: 0, days: planDays }),
    /ailleurs/,
  );
  await assert.rejects(
    planRpc('save', { employeeId: a, week: '2026-11-24', version: 0, days: planDays }),
    /lundi/,
  );
  assert.equal((await planRpc('backup')).weeklyPlans.length, 1);
  await role();
  await assert.rejects(
    planRpc('save', { employeeId: a, week: '2026-11-23', version: 1, days: planDays, session: sb }),
    /réservé/,
  );
  await role(owner);
  const backup = await rpc('export_backup');
  assert.equal(JSON.stringify(backup).includes('pin_hash'), false);
  assert.equal(JSON.stringify(backup).includes('link_hash'), false);
  assert.ok(backup.audit.length > 5);
});
