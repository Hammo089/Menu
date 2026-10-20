import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST, DELETE } from '../api/loyalty-session.ts';
import { GET } from '../api/loyalty-manifest.ts';

test('PWA install uses a verified private cookie and fragment, without shared caches or query secrets', async () => {
  const key = 'c'.repeat(64),
    origin = 'https://blanco.example';
  const oldFetch = globalThis.fetch;
  const oldURL = process.env.VITE_SUPABASE_URL,
    oldKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  process.env.VITE_SUPABASE_URL = 'https://backend.example';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'public-test';
  let backendBody;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://backend.example/rest/v1/rpc/loyalty_api');
    backendBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ member: { code: 'BL-ABCDE-12345' } }));
  };
  try {
    const request = (body, source = origin) =>
      new Request(`${origin}/api/loyalty-session`, {
        method: 'POST',
        headers: { origin: source },
        body: JSON.stringify(body),
      });
    assert.equal((await POST(request({ key }, 'https://foreign.example'))).status, 403);
    assert.equal((await POST(request({ key: 'wrong' }))).status, 400);
    const response = await POST(request({ key }));
    assert.equal(response.status, 200);
    assert.deepEqual(backendBody, { action: 'card', payload: { key } });
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
    assert.match(cookie, /Path=\/api\/loyalty-manifest/);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal((await response.text()).includes(key), false);
    const manifest = await GET(
      new Request(`${origin}/api/loyalty-manifest`, { headers: { cookie: cookie.split(';')[0] } }),
    );
    assert.equal((await manifest.json()).start_url, `/fidelite#cle=${key}`);
    assert.equal(manifest.headers.get('cache-control'), 'private, no-store');
    assert.equal(manifest.headers.get('vary'), 'Cookie');
    const blank = await GET(new Request(`${origin}/api/loyalty-manifest`));
    assert.equal((await blank.json()).start_url, '/fidelite');
    const removed = await DELETE(
      new Request(`${origin}/api/loyalty-session`, { method: 'DELETE', headers: { origin } }),
    );
    assert.match(removed.headers.get('set-cookie'), /Max-Age=0/);
    globalThis.fetch = async () => new Response('{}', { status: 400 });
    assert.equal((await POST(request({ key }))).headers.get('set-cookie'), null);
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ setupRequired: true, setupName: 'Camille' }));
    assert.equal(
      (await POST(request({ key }))).headers.get('set-cookie'),
      null,
      'single-use reset links must not become installed app credentials',
    );
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Invalid card' }));
    assert.equal((await POST(request({ key }))).status, 400);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldURL === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = oldURL;
    if (oldKey === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = oldKey;
  }
});
