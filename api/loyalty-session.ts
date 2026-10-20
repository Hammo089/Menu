// Keep Vercel functions self-contained: runtime relative TS imports are not portable.
const headers = {
  'Cache-Control': 'private, no-store',
  'Content-Type': 'application/json',
  'Referrer-Policy': 'no-referrer',
};
const cookieName = 'blanco_loyalty';
function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return origin === new URL(request.url).origin;
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response('{}', { status: 403, headers });
  if (Number(request.headers.get('content-length') || 0) > 1024)
    return new Response('{}', { status: 413, headers });
  let key: string;
  try {
    const body = await request.text();
    if (body.length > 1024) throw Error();
    key = JSON.parse(body).key;
    if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) throw Error();
  } catch {
    return new Response('{}', { status: 400, headers });
  }
  const url = process.env.VITE_SUPABASE_URL,
    apiKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !apiKey) return new Response('{}', { status: 503, headers });
  try {
    const result = await fetch(`${url}/rest/v1/rpc/loyalty_api`, {
      method: 'POST',
      headers: { apikey: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'card', payload: { key } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) return new Response('{}', { status: 400, headers });
    const data = await result.json();
    if (data.error || data.setupRequired || !data.member?.code)
      return new Response('{}', { status: 400, headers });
    return new Response('{"ok":true}', {
      headers: {
        ...headers,
        'Set-Cookie': `${cookieName}=${key}; Path=/api/loyalty-manifest; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`,
      },
    });
  } catch {
    return new Response('{}', { status: 503, headers });
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return new Response('{}', { status: 403, headers });
  return new Response('{"ok":true}', {
    headers: {
      ...headers,
      'Set-Cookie': `${cookieName}=; Path=/api/loyalty-manifest; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
    },
  });
}
