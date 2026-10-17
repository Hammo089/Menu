import { useEffect, useState } from 'react';
import { validWeather, type WeatherReading } from './weather';
const CACHE = 'blanco-grenoble-weather-v1';
export function useGrenobleWeather(enabled: boolean) {
  const [weather, setWeather] = useState<WeatherReading | null>(() => {
    try {
      const data = JSON.parse(localStorage.getItem(CACHE) || 'null');
      return validWeather(data) ? data : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let current: AbortController | undefined;
    const refresh = async () => {
      current?.abort();
      current = new AbortController();
      try {
        const response = await fetch('/api/weather', { signal: current.signal });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (alive && validWeather(data)) {
          setWeather(data);
          try {
            localStorage.setItem(CACHE, JSON.stringify(data));
          } catch {
            /* Optional device cache. */
          }
        }
      } catch {
        /* Seasonal fallback when the weather service is unavailable. */
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 10 * 60000);
    const online = () => void refresh();
    window.addEventListener('online', online);
    return () => {
      alive = false;
      current?.abort();
      clearInterval(timer);
      window.removeEventListener('online', online);
    };
  }, [enabled]);
  return weather;
}
