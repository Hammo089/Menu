import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

test('PIN migration revokes weak access, hashes secrets, protects recovery and requires a one-use gift approval', async (t) => {
  const db = new PGlite({ extensions: { pgcrypto } });
  t.after(() => db.close());
  const owner = randomUUID(),
    other = randomUUID();
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema extensions;create extension pgcrypto with schema extensions;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
    create table public.menu_admins(user_id uuid primary key references auth.users);alter table public.menu_admins enable row level security;
    grant select on public.menu_admins to authenticated;create policy own on public.menu_admins for select to authenticated using(user_id=auth.uid());`);
  await db.query('insert into auth.users values($1,$2,now()),($3,$4,now())', [
    owner,
    'owner@example.com',
    other,
    'other@example.com',
  ]);
  await db.query('insert into public.menu_admins values($1)', [owner]);
  for (const name of ['loyalty.sql', 'loyalty-hardening.sql', 'loyalty-login.sql'])
    await db.exec(readFileSync(new URL('../supabase/' + name, import.meta.url), 'utf8'));
  async function role(id) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || '']);
    await db.exec(`set role ${id ? 'authenticated' : 'anon'}`);
  }
  const rpc = async (action, payload = {}) =>
    (
      await db.query('select public.loyalty_api($1,$2::jsonb) result', [
        action,
        JSON.stringify(payload),
      ])
    ).rows[0].result;
  const login = async (payload) =>
    (await db.query('select public.loyalty_login($1::jsonb) result', [JSON.stringify(payload)]))
      .rows[0].result;
  const oldKey = 'a'.repeat(64),
    oldDevice = 'b'.repeat(64),
    key = 'c'.repeat(64),
    newDevice = 'd'.repeat(64),
    reset = 'e'.repeat(64),
    activated = 'f'.repeat(64);
  await role();
  const legacy = await rpc('register', {
    name: 'Ancienne Carte',
    phone: '0611223344',
    key: oldKey,
    consent: true,
  });
  await login({ name: 'Ancienne Carte', phone: '0611223344', key: oldDevice });
  await db.exec('reset role');
  await db.exec(readFileSync(new URL('../supabase/loyalty-pin.sql', import.meta.url), 'utf8'));
  await role();
  assert.ok((await rpc('card', { key: oldKey })).error);
  assert.ok((await rpc('card', { key: oldDevice })).error);
  assert.ok((await login({ name: 'Ancienne Carte', phone: '0611223344', key: oldDevice })).error);
  assert.ok(
    (
      await rpc('register', {
        name: 'Client Test',
        phone: '0622334455',
        key,
        pin: '123456',
        consent: true,
      })
    ).error,
  );
  let result = await rpc('register', {
    name: 'Client Test',
    phone: '0622334455',
    key,
    pin: '482951',
    consent: true,
  });
  const code = result.member.code;
  assert.equal(result.member.phone, undefined);
  assert.equal(result.member.pin_hash, undefined);
  assert.equal((await rpc('card', { key })).member.code, code);
  assert.ok((await login({ phone: '0622334455', pin: '999998', key: newDevice })).error);
  assert.equal(
    (await login({ phone: '0033 6 22 33 44 55', pin: '482951', key: newDevice })).member.code,
    code,
  );
  assert.equal(
    (await rpc('card', { key })).member.code,
    code,
    'login preserves other authorized devices',
  );
  await db.exec('reset role');
  const hash = (
    await db.query(
      'select pin_hash from blanco_private.loyalty_auth where member_id=(select id from blanco_private.loyalty_members where code=$1)',
      [code],
    )
  ).rows[0].pin_hash;
  assert.match(hash, /^\$2[ab]\$12\$/);
  assert.notEqual(hash, '482951');
  await role();
  await assert.rejects(db.query('select * from blanco_private.loyalty_auth'), /permission denied/);
  for (let i = 0; i < 11; i++) await login({ phone: '0622334499', pin: '999998', key: newDevice });
  assert.match(
    (await login({ phone: '0622334499', pin: '999998', key: newDevice })).error,
    /tentatives/,
  );
  await role(owner);
  let program = (await rpc('program')).program;
  program.goal = 2;
  program.next_day = false;
  await rpc('save_program', { program });
  result = await rpc('stamp', { code, amount: 3, paid: true, requestId: randomUUID() });
  const rewardId = result.member.rewards[0].id;
  assert.equal(result.member.stamps, 1);
  assert.equal(result.member.totalStamps, 3);
  assert.ok(
    (await rpc('redeem', { code, rewardId, requestId: randomUUID() })).error,
    'QR or public code alone cannot spend a gift',
  );
  await role();
  assert.ok((await rpc('reward_authorize', { key, pin: '999998', rewardId })).error);
  result = await rpc('reward_authorize', { key, pin: '482951', rewardId });
  assert.match(result.approvalCode, /^[0-9]{6}$/);
  const approvalCode = result.approvalCode;
  assert.ok(
    (await rpc('reward_authorize', { key, pin: '482951', rewardId: randomUUID() })).error,
    'a session cannot authorize another member’s reward',
  );
  await assert.rejects(
    rpc('redeem', { code, rewardId, approvalCode, requestId: randomUUID() }),
    /réservé/,
  );
  await role(owner);
  const requestId = randomUUID();
  result = await rpc('redeem', { code, rewardId, approvalCode, requestId });
  assert.equal(result.member.rewards[0].status, 'used');
  assert.equal((await rpc('redeem', { code, rewardId, approvalCode, requestId })).replayed, true);
  assert.ok((await rpc('redeem', { code, rewardId, approvalCode, requestId: randomUUID() })).error);
  result = await rpc('undo', {
    code,
    eventId: result.member.lastEvent.id,
    requestId: randomUUID(),
  });
  assert.equal(result.member.rewards[0].status, 'ready');
  assert.ok(
    (await rpc('redeem', { code, rewardId, approvalCode, requestId: randomUUID() })).error,
    'undo does not revive a spent approval code',
  );
  await role();
  const expiring = await rpc('reward_authorize', { key, pin: '482951', rewardId });
  await db.exec('reset role');
  await db.query(
    "update blanco_private.loyalty_reward_approvals set expires_at=now()-interval '1 second' where reward_id=$1",
    [rewardId],
  );
  await role(owner);
  assert.ok(
    (
      await rpc('redeem', {
        code,
        rewardId,
        approvalCode: expiring.approvalCode,
        requestId: randomUUID(),
      })
    ).error,
    'expired approvals cannot be spent',
  );
  await role(other);
  await assert.rejects(
    rpc('recover', { code, key: reset, last4: '4455', verified: true }),
    /réservé/,
  );
  await role(owner);
  const replacedReset = '1'.repeat(64);
  result = await rpc('recover', { code, key: replacedReset, last4: '4455', verified: true });
  assert.equal(result.recoveryExpiresAt, null, 'recovery links have no deadline');
  await rpc('recover', { code, key: reset, last4: '4455', verified: true });
  await role();
  assert.ok(
    (await rpc('card', { key: replacedReset })).error,
    'issuing a link revokes the previous one',
  );
  await db.exec('reset role');
  // Upgrade a previously issued link whose old thirty-minute deadline has passed.
  await db.query(
    "update blanco_private.loyalty_auth set recovery_expires_at=now()-interval '30 days' where member_id=(select id from blanco_private.loyalty_members where code=$1)",
    [code],
  );
  await db.exec(
    readFileSync(new URL('../supabase/loyalty-recovery-once.sql', import.meta.url), 'utf8'),
  );
  assert.equal(
    (
      await db.query(
        'select recovery_expires_at from blanco_private.loyalty_auth where recovery_hash is not null',
      )
    ).rows[0].recovery_expires_at,
    null,
  );
  await role();
  assert.ok((await rpc('card', { key })).error);
  assert.ok((await rpc('card', { key: newDevice })).error);
  const setup = await rpc('card', { key: reset });
  assert.equal(setup.setupRequired, true);
  assert.equal(setup.member, undefined, 'reset links reveal no balance before setting the PIN');
  assert.ok((await login({ phone: '0622334455', pin: '482951', key: newDevice })).error);
  result = await rpc('activate', { key: reset, deviceKey: activated, pin: '736194' });
  assert.equal(result.member.totalStamps, 3);
  assert.equal(result.member.stamps, 1);
  assert.equal(result.member.rewards.length, 1);
  assert.ok((await rpc('card', { key: reset })).error, 'recovery link is single-use');
  assert.ok(
    (
      await rpc('register', {
        name: 'Client Test',
        phone: '0622334455',
        key: reset,
        pin: '736194',
        consent: true,
      })
    ).error,
    'a consumed reset link cannot be reused through registration',
  );
  assert.ok((await rpc('activate', { key: reset, deviceKey: newDevice, pin: '592847' })).error);
  assert.equal(
    (await login({ phone: '0622334455', pin: '736194', key: newDevice })).member.code,
    code,
  );
  assert.ok((await login({ phone: '0622334455', pin: '482951', key: newDevice })).error);
  await role(owner);
  await rpc('erase', { code, confirm: code });
  await role();
  assert.ok((await rpc('card', { key: activated })).error);
  // Existing accounts also require a staff-issued reset, preserving their identity.
  await role(owner);
  await rpc('recover', { code: legacy.member.code, key: reset, last4: '3344', verified: true });
  await role();
  assert.equal(
    (await rpc('activate', { key: reset, deviceKey: activated, pin: '482951' })).member.code,
    legacy.member.code,
  );
});
