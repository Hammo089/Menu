export type WeatherReading = {
  temperature: number;
  symbol: string;
  forecastAt: string;
  fetchedAt: string;
  source: 'MET Norway';
};
export function validWeather(value: unknown): value is WeatherReading {
  if (!value || typeof value !== 'object') return false;
  const w = value as WeatherReading;
  return (
    Number.isFinite(w.temperature) &&
    w.temperature >= -60 &&
    w.temperature <= 60 &&
    typeof w.symbol === 'string' &&
    w.symbol.length < 100 &&
    Number.isFinite(Date.parse(w.forecastAt)) &&
    Number.isFinite(Date.parse(w.fetchedAt)) &&
    w.source === 'MET Norway'
  );
}
export function calendarSeason(now = new Date()): 'winter' | 'spring' | 'summer' | 'autumn' {
  const month = Number(
    new Intl.DateTimeFormat('en', { month: 'numeric', timeZone: 'Europe/Paris' }).format(now),
  );
  return month >= 9 && month <= 11
    ? 'autumn'
    : month === 12 || month <= 2
      ? 'winter'
      : month >= 6 && month <= 8
        ? 'summer'
        : 'spring';
}
export function weatherSeason(
  weather: WeatherReading | null,
  now = new Date(),
): 'winter' | 'spring' | 'summer' | 'autumn' {
  if (
    !weather ||
    !validWeather(weather) ||
    Math.abs(now.getTime() - Date.parse(weather.forecastAt)) > 3 * 3600000 ||
    now.getTime() - Date.parse(weather.fetchedAt) > 90 * 60000 ||
    Date.parse(weather.fetchedAt) > now.getTime() + 60000
  )
    return calendarSeason(now);
  const { temperature: t, symbol } = weather;
  if (/snow|sleet/.test(symbol) || t <= 12 || (/rain/.test(symbol) && t < 20)) return 'winter';
  if (t >= 24 || (/clearsky|fair/.test(symbol) && t >= 20)) return 'summer';
  const season = calendarSeason(now);
  if (season === 'winter' && t < 18) return 'winter';
  if (season === 'summer' && t >= 18 && !/rain/.test(symbol)) return 'summer';
  return season === 'autumn' ? 'autumn' : 'spring';
}
