import { validWeather, type WeatherReading } from '../src/weather.ts';
// Grenoble city forecast; this endpoint never accepts arbitrary remote URLs or user locations.
export async function GET() {
  try {
    const response = await fetch(
      'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=45.1885&lon=5.7245',
      {
        headers: {
          'User-Agent': 'BlancoMenu/1.0 (+https://blanco-menu-one.vercel.app)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) throw new Error(`Weather provider returned ${response.status}`);
    const data = await response.json();
    const point = data.properties?.timeseries?.[0];
    const reading: WeatherReading = {
      temperature: point?.data?.instant?.details?.air_temperature,
      symbol:
        point?.data?.next_1_hours?.summary?.symbol_code ||
        point?.data?.next_6_hours?.summary?.symbol_code ||
        'cloudy',
      forecastAt: point?.time,
      fetchedAt: new Date().toISOString(),
      source: 'MET Norway',
    };
    if (!validWeather(reading)) throw new Error('Invalid weather response');
    return Response.json(reading, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=1200',
      },
    });
  } catch (error) {
    console.error(
      'Grenoble weather unavailable:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return Response.json(
      { error: 'Weather temporarily unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
