import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('loyalty capabilities, permissions, accounting, snapshots, recovery and erasure', async () => {
  const db = new PGlite();
  const owner = randomUUID(),
    outsider = randomUUID(),
    employee = randomUUID();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create table public.menu_admins(user_id uuid primary key references auth.users);
    alter table public.menu_admins enable row level security;
    grant select on public.menu_admins to authenticated;
    create policy own on public.menu_admins for select to authenticated using(user_id=auth.uid());`);
  await db.query('insert into auth.users values ($1,$2,now()),($3,$4,now()),($5,$6,now())', [
    owner,
    'owner@example.com',
    outsider,
    'other@example.com',
    employee,
    'employee@example.com',
  ]);
  await db.query('insert into public.menu_admins values($1)', [owner]);
  await db.exec(readFileSync(new URL('../supabase/loyalty.sql', import.meta.url), 'utf8'));
  await db.exec(
    readFileSync(new URL('../supabase/loyalty-hardening.sql', import.meta.url), 'utf8'),
  );
  await db.exec(readFileSync(new URL('../supabase/loyalty-login.sql', import.meta.url), 'utf8'));
  async function role(id) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || '']);
    await db.exec(`set role ${id ? 'authenticated' : 'anon'}`);
  }
  async function rpc(action, payload = {}) {
    return (
      await db.query('select public.loyalty_api($1,$2::jsonb) as result', [
        action,
        JSON.stringify(payload),
      ])
    ).rows[0].result;
  }
  await role();
  // Even accidental future table grants must not expose member data through RLS.
  await db.exec('reset role');
  await db.exec('grant select on blanco_private.loyalty_members to anon');
  await role();
  assert.equal((await db.query('select * from blanco_private.loyalty_members')).rows.length, 0);
  await db.exec('reset role');
  await db.exec('revoke select on blanco_private.loyalty_members from anon');
  await role();
  await assert.rejects(
    db.query('select * from blanco_private.loyalty_members'),
    /permission denied/,
  );
  await assert.rejects(rpc('search'), /réservé/);
  const key = 'a'.repeat(64),
    secondKey = 'b'.repeat(64);
  let result = await rpc('register', {
    name: 'Camille Martin',
    phone: '06 11 22 33 44',
    key,
    consent: true,
  });
  const code = result.member.code;
  const deviceKey = 'c'.repeat(64);
  const login = async (payload) =>
    (await db.query('select public.loyalty_login($1::jsonb) as result', [JSON.stringify(payload)]))
      .rows[0].result;
  assert.match(
    (await login({ name: 'Wrong name', phone: '0611223344', key: deviceKey })).error,
    /incorrect/,
  );
  const signedIn = await login({
    name: '  CAMILLE   MARTIN ',
    phone: '0033 6 11 22 33 44',
    key: deviceKey,
  });
  assert.equal(signedIn.member.code, code);
  assert.equal(signedIn.member.phone, undefined);
  assert.equal((await rpc('card', { key: deviceKey })).member.code, code);
  assert.equal(
    (await rpc('card', { key })).member.code,
    code,
    'login must not disconnect other devices',
  );
  await assert.rejects(
    db.query("select blanco_private.loyalty_api_base('program','{}')"),
    /permission denied/,
  );
  for (let i = 0; i < 11; i++)
    await login({ name: 'Unknown person', phone: '0600000099', key: deviceKey });
  assert.match(
    (await login({ name: 'Unknown person', phone: '0600000099', key: deviceKey })).error,
    /tentatives/,
  );
  assert.equal(result.member.phone, undefined);
  assert.equal(result.member.id, undefined);
  assert.equal(result.member.goal, 8);
  assert.equal(
    (await rpc('register', { name: 'Camille', phone: '0611223344', key, consent: true })).member
      .code,
    code,
  );
  await assert.rejects(
    rpc('register', { name: 'Other', phone: '0611223344', key: secondKey, consent: true }),
    /retrouver/,
  );
  await assert.rejects(rpc('card', { key: secondKey }), /introuvable/);
  await role(outsider);
  await assert.rejects(rpc('member', { code }), /réservé/);
  await role(owner);
  assert.equal((await rpc('search', { query: 'camille' })).members[0].phone, '+33611223344');
  await assert.rejects(rpc('recover', { code, key: secondKey, verified: true }), /chiffres/);
  await assert.rejects(rpc('erase', { code }), /Confirmation/);
  await assert.rejects(rpc('save_program', { program: {} }), /règles/);
  let program = (await rpc('program')).program;
  program.next_day = false;
  program = (await rpc('save_program', { program })).program;
  const requestId = randomUUID();
  result = await rpc('stamp', { code, amount: 5, paid: true, requestId });
  assert.equal(result.member.stamps, 5);
  assert.equal(
    (await rpc('stamp', { code, amount: 5, paid: true, requestId })).member.totalStamps,
    5,
  );
  await assert.rejects(rpc('stamp', { code, amount: 6, paid: true, requestId }), /déjà utilisé/);
  program.goal = 4;
  program = (await rpc('save_program', { program })).program;
  assert.equal(
    (await rpc('member', { code })).member.goal,
    8,
    'running cycle freezes original rules',
  );
  result = await rpc('stamp', { code, amount: 5, paid: true, requestId: randomUUID() });
  assert.equal(result.member.stamps, 2);
  assert.equal(result.member.goal, 4);
  assert.equal(result.member.rewards.length, 1);
  assert.equal(result.member.rewards[0].status, 'ready');
  const rewardId = result.member.rewards[0].id;
  result = await rpc('redeem', { code, rewardId, requestId: randomUUID() });
  assert.equal(result.member.rewards[0].status, 'used');
  await assert.rejects(rpc('redeem', { code, rewardId, requestId: randomUUID() }), /déjà utilisé/);
  await assert.rejects(rpc('undo', { code, requestId: randomUUID() }), /annulée/);
  result = await rpc('undo', {
    code,
    eventId: result.member.lastEvent.id,
    requestId: randomUUID(),
  });
  assert.equal(result.member.rewards[0].status, 'ready');
  result = await rpc('stamp', { code, amount: 2, paid: true, requestId: randomUUID() });
  assert.equal(result.member.rewards.length, 2);
  result = await rpc('undo', {
    code,
    eventId: result.member.lastEvent.id,
    requestId: randomUUID(),
  });
  assert.equal(result.member.stamps, 2);
  assert.equal(result.member.rewards.length, 1);
  await rpc('staff', { email: 'employee@example.com', active: true });
  await role(employee);
  assert.equal((await rpc('access')).owner, false);
  await assert.rejects(rpc('save_program', { program }), /responsable/);
  await assert.rejects(
    rpc('recover', { code, key: secondKey, last4: '3344', verified: true }),
    /responsable/,
  );
  await rpc('stamp', { code, amount: 1, paid: true, requestId: randomUUID() });
  await role(owner);
  await rpc('staff', { email: 'employee@example.com', active: false });
  await rpc('recover', { code, key: secondKey, last4: '3344', verified: true });
  await role();
  await assert.rejects(rpc('card', { key }), /introuvable/);
  await assert.rejects(rpc('card', { key: deviceKey }), /introuvable/);
  assert.equal((await rpc('card', { key: secondKey })).member.stamps, 3);
  await role(employee);
  await assert.rejects(rpc('access'), /réservé/);
  await role(owner);
  await db.exec('reset role');
  await db.query(
    "update blanco_private.loyalty_members set cycle_expires_at=now()-interval '1 second' where code=$1",
    [code],
  );
  await role(owner);
  assert.equal((await rpc('member', { code })).member.stamps, 0);
  result = await rpc('stamp', { code, amount: 1, paid: true, requestId: randomUUID() });
  assert.equal(result.member.stamps, 1);
  await rpc('erase', { code, confirm: code });
  await role();
  await assert.rejects(rpc('card', { key: secondKey }), /introuvable/);
  await db.close();
});
