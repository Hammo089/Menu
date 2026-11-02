import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID, pbkdf2Sync } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

test('TV pairing, private device secrets, owner authorization, command isolation and revocation', async (t) => {
  const db = new PGlite({ extensions: { pgcrypto } });
  t.after(() => db.close());
  const owner = randomUUID(),
    other = randomUUID();
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema extensions; create extension pgcrypto with schema extensions;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.menu_admins(user_id uuid primary key); create table public.menu_state(id text primary key,content jsonb); insert into public.menu_state values('blanco','{"products":[],"categories":[]}');
 grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  await db.query('insert into public.menu_admins values($1)', [owner]);
  await db.exec(
    readFileSync(
      new URL('../supabase/migrations/20261102104231_blanco_tv.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        '../supabase/migrations/20261102173734_tv_android9_utc_timestamps.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  async function role(id) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || '']);
    await db.exec(`set role ${id ? 'authenticated' : 'anon'}`);
  }
  const rpc = async (action, payload = {}) =>
    (await db.query('select public.tv_api($1,$2::jsonb) result', [action, JSON.stringify(payload)]))
      .rows[0].result;
  const a = 'a'.repeat(64),
    b = 'b'.repeat(64),
    invalid = 'c'.repeat(64);
  const salt = '000102030405060708090a0b0c0d0e0f',
    hash = pbkdf2Sync('482951', Buffer.from(salt, 'hex'), 210000, 32, 'sha256').toString('hex');
  await role();
  assert.ok((await rpc('pair', { token: 'short' })).error);
  const pair = await rpc('pair', { token: a });
  assert.match(pair.pairCode, /^[A-F0-9]{10}$/);
  assert.match(pair.expiresAt, /Z$/, 'Pair expiry is compatible with Android 9 ISO_INSTANT');
  assert.equal(
    (await rpc('pair', { token: a })).pairCode,
    pair.pairCode,
    'polling reuses the pending one-use association code',
  );
  await assert.rejects(rpc('list'), /réservé/);
  await role(other);
  await assert.rejects(
    rpc('claim', { pairCode: pair.pairCode, name: 'Counter', pinSalt: salt, pinHash: hash }),
    /réservé/,
  );
  await role(owner);
  const { id } = await rpc('claim', {
    pairCode: pair.pairCode,
    name: 'Counter',
    pinSalt: salt,
    pinHash: hash,
  });
  await assert.rejects(
    rpc('claim', { pairCode: pair.pairCode, name: 'Other', pinSalt: salt, pinHash: hash }),
    /expiré/,
  );
  let device = (await rpc('list')).devices[0];
  assert.equal(device.hasPin, true);
  assert.equal(device.pin_hash, undefined);
  assert.equal(device.token_hash, undefined);
  assert.equal(device.pinAuth, undefined);
  await assert.rejects(db.query('select * from blanco_private.tv_devices'), /permission denied/);
  const config = {
    mode: 'menu',
    url: '',
    items: [],
    orientation: 'portrait',
    rotation: 90,
    override: 'auto',
    schedule: {
      enabled: true,
      timezone: 'Europe/Paris',
      days: Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        enabled: true,
        start: '20:00',
        end: '02:00',
      })),
    },
  };
  await rpc('save', { id, name: 'Counter', revision: device.revision, config });
  await assert.rejects(
    rpc('save', { id, name: 'Counter', revision: device.revision, config }),
    /modifiée/,
  );
  await assert.rejects(
    rpc('save', {
      id,
      name: 'Counter',
      revision: device.revision + 1,
      config: { ...config, mode: 'url', url: 'javascript:alert(1)' },
    }),
    /Vérifiez/,
  );
  await assert.rejects(
    rpc('save', {
      id,
      name: 'Counter',
      revision: device.revision + 1,
      config: { ...config, schedule: { ...config.schedule, days: [config.schedule.days[0]] } },
    }),
    /Vérifiez/,
  );
  await role();
  assert.ok((await rpc('sync', { token: invalid })).error);
  const sync = await rpc('sync', { token: a, status: { model: 'TestTV', deviceOwner: false } });
  assert.equal(sync.paired, true);
  assert.match(sync.serverNow, /Z$/, 'Server clock must parse on Android 9');
  assert.equal(sync.pinAuth.hash, hash);
  assert.equal(sync.config.rotation, 90);
  assert.ok(sync.menu);
  await assert.rejects(rpc('pin', { id, pinSalt: salt, pinHash: hash }), /réservé/);
  const pairB = await rpc('pair', { token: b });
  await role(owner);
  const second = await rpc('claim', {
    pairCode: pairB.pairCode,
    name: 'Window',
    pinSalt: salt,
    pinHash: hash,
  });
  const requestId = randomUUID();
  const cmd = await rpc('command', { id, kind: 'reload', requestId });
  assert.equal(
    (await rpc('command', { id, kind: 'reload', requestId })).commandId,
    cmd.commandId,
    'retry does not enqueue a second operation',
  );
  await role();
  const pending = await rpc('sync', { token: a });
  assert.match(pending.commands[0].expiresAt, /Z$/, 'Command expiry must parse on Android 9');
  assert.equal(pending.commands.length, 1);
  await rpc('sync', { token: b, acks: [{ id: cmd.commandId, result: 'ok' }] });
  await role(owner);
  assert.equal(
    (await rpc('history', { id })).commands[0].acknowledgedAt,
    null,
    'a device cannot acknowledge another screen’s operation',
  );
  await role();
  await rpc('sync', { token: a, acks: [{ id: cmd.commandId, result: 'ok', message: 'Rechargé' }] });
  assert.equal((await rpc('sync', { token: a })).commands.length, 0);
  await role(owner);
  assert.equal((await rpc('history', { id })).commands[0].result, 'ok');
  const expired = await rpc('command', { id, kind: 'reboot', requestId: randomUUID() });
  await db.exec('reset role');
  await db.query(
    "update blanco_private.tv_commands set expires_at=now()-interval '1 second' where id=$1",
    [expired.commandId],
  );
  await role();
  assert.equal(
    (await rpc('sync', { token: a })).commands.length,
    0,
    'expired commands must never execute on reconnect',
  );
  await role(owner);
  await rpc('pin', { id, pinSalt: salt, pinHash: 'f'.repeat(64) });
  await role();
  assert.equal(
    (await rpc('sync', { token: a })).pinAuth.hash,
    'f'.repeat(64),
    'owner PIN reset reaches the next authenticated device sync',
  );
  await role(owner);
  await rpc('revoke', { id });
  await role();
  assert.equal((await rpc('sync', { token: a })).revoked, true);
  assert.equal((await rpc('pair', { token: a })).revoked, true);
  assert.equal(
    (await rpc('sync', { token: b })).id,
    second.id,
    'revoking one device preserves other screens',
  );
});
