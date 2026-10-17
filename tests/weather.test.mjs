import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarSeason, weatherSeason, validWeather } from '../src/weather.ts';
import { GET } from '../api/weather.ts';
const now = new Date('2026-07-12T12:00:00Z');
const reading = (temperature, symbol = 'cloudy') => ({
  temperature,
  symbol,
  forecastAt: now.toISOString(),
  fetchedAt: now.toISOString(),
  source: 'MET Norway',
});
test('weather creates a refreshing summer scene in heat and a warming winter scene in cold or rain', () => {
  assert.equal(weatherSeason(reading(29, 'clearsky_day'), now), 'summer');
  assert.equal(weatherSeason(reading(7), now), 'winter');
  assert.equal(weatherSeason(reading(16, 'rain'), now), 'winter');
  assert.equal(weatherSeason(reading(16, 'snow'), now), 'winter');
  assert.equal(weatherSeason(reading(20, 'fair_day'), now), 'summer');
  assert.equal(weatherSeason(reading(16), new Date('2026-04-12T12:00:00Z')), 'spring');
});
test('stale, future, or malformed weather falls back to the calendar instead of blocking the menu', () => {
  assert.equal(calendarSeason(new Date('2026-10-17T12:00:00Z')), 'autumn');
  assert.equal(weatherSeason(null, now), 'summer');
  assert.equal(weatherSeason({ ...reading(2), forecastAt: '2026-07-11T00:00:00Z' }, now), 'summer');
  assert.equal(weatherSeason({ ...reading(2), fetchedAt: '2026-07-12T10:00:00Z' }, now), 'summer');
  assert.equal(weatherSeason({ ...reading(2), fetchedAt: '2026-07-12T13:00:00Z' }, now), 'summer');
  assert.equal(validWeather({ ...reading(2), temperature: 999 }), false);
});
test('weather endpoint limits its source to Grenoble, identifies itself, and provides CDN caching', async () => {
  const original = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return Response.json({
      properties: {
        timeseries: [
          {
            time: new Date().toISOString(),
            data: {
              instant: { details: { air_temperature: 9 } },
              next_1_hours: { summary: { symbol_code: 'rain' } },
            },
          },
        ],
      },
    });
  };
  try {
    const response = await GET();
    assert.equal(response.status, 200);
    assert.ok(validWeather(await response.json()));
    assert.match(response.headers.get('cache-control'), /s-maxage=600/);
    assert.match(request.url, /lat=45.1885&lon=5.7245/);
    assert.match(request.options.headers['User-Agent'], /blanco-menu-one.vercel.app/);
  } finally {
    globalThis.fetch = original;
  }
});
test('weather provider failures return a retryable response without leaking provider errors', async () => {
  const original = globalThis.fetch,
    log = console.error;
  globalThis.fetch = async () => new Response('provider error', { status: 502 });
  console.error = () => {};
  try {
    const response = await GET();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { error: 'Weather temporarily unavailable' });
  } finally {
    globalThis.fetch = original;
    console.error = log;
  }
});
