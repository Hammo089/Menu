import { useEffect, useState, type CSSProperties } from 'react';
import { activeHolidays, holidayCatalog, type HolidaySettings } from './holidays';
import { SeasonEffect } from './components';
import type { Season } from './types';
function Ornament({ theme, index }: { theme: string; index: number }) {
  if (theme === 'gold')
    return index === 0 ? (
      <svg viewBox="0 0 100 120">
        <defs>
          <linearGradient id="moon-gold" x2="1" y2="1">
            <stop stopColor="#f7e4ae" />
            <stop offset=".5" stopColor="#c29b52" />
            <stop offset="1" stopColor="#98752f" />
          </linearGradient>
        </defs>
        <path
          d="M68 10C8 8 3 88 61 100 77 103 89 97 95 89 40 100 25 30 68 10Z"
          fill="url(#moon-gold)"
        />
        <path d="m80 26 3 9 10 1-8 6 2 10-8-6-8 5 3-10-7-6 10-1Z" fill="#d2b274" />
      </svg>
    ) : (
      <svg viewBox="0 0 80 150">
        <defs>
          <linearGradient id="lantern-glow">
            <stop stopColor="#ac813f" />
            <stop offset=".5" stopColor="#f5d793" />
            <stop offset="1" stopColor="#a67b38" />
          </linearGradient>
        </defs>
        <path
          d="M40 0v27M23 50 40 31 57 50M25 112l15 16 15-16"
          fill="none"
          stroke="#b79558"
          strokeWidth="2"
        />
        <path d="M20 52h40l7 57H13Z" fill="url(#lantern-glow)" />
        <path d="M28 56h24l4 48H24Z" fill="#fff0bf" fillOpacity=".7" />
        <path d="M40 54v52M18 109h44M21 51h38" stroke="#9f783d" strokeWidth="2" />
      </svg>
    );
  if (theme === 'evergreen')
    return (
      <svg viewBox="0 0 160 180">
        <path
          d="M40 0q2 80 100 145M40 34l-25-8m29 16 22-24M57 65l-38-9m46 19 28-30M84 96l-42-8m52 19 29-34M116 128l-39-7m48 15 21-27"
          stroke="#5d7b56"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        <g fill="#af6957">
          <circle cx="49" cy="61" r="7" />
          <circle cx="57" cy="68" r="6" />
          <circle cx="100" cy="113" r="7" />
        </g>
        <path d="M94 32v25" stroke="#bd9b60" />
        <circle cx="94" cy="74" r="18" fill="#cab07c" />
        <ellipse cx="88" cy="67" rx="5" ry="8" fill="#fff8df" opacity=".55" />
      </svg>
    );
  if (theme === 'blossom')
    return (
      <svg viewBox="0 0 130 150">
        <defs>
          <radialGradient id="egg-shade" cx=".3" cy=".25" r=".9">
            <stop stopColor="#f9ecd0" />
            <stop offset=".6" stopColor="#d5dfbc" />
            <stop offset="1" stopColor="#95ae8d" />
          </radialGradient>
        </defs>
        <path
          d="M65 16C33 15 15 72 24 103 32 135 98 136 107 102 114 72 92 16 65 16Z"
          fill="url(#egg-shade)"
        />
        <path
          d="M29 92q35-20 74 0M33 107q30-17 66 0"
          stroke="#fbf7e7"
          strokeWidth="5"
          fill="none"
          opacity=".7"
        />
        <path
          d="M94 128q15-37 29-45M104 109l-12-7m18-2 15 2"
          stroke="#8ba385"
          fill="none"
          strokeWidth="3"
        />
      </svg>
    );
  return (
    <svg viewBox="0 0 100 130">
      <path d="M50 0v42" stroke="#c4ab79" />
      <path
        d="m50 37 8 24 26 1-21 16 7 25-20-15-21 15 8-25-21-16 26-1Z"
        fill="#dbc18a"
        stroke="#b69a62"
      />
      <circle cx="48" cy="70" r="17" fill="#fff8de" opacity=".25" />
    </svg>
  );
}
export function HolidayDecor({ settings }: { settings: HolidaySettings }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const active = activeHolidays(settings, now);
  if (!active.length) return null;
  const [event] = active,
    theme = holidayCatalog[event.id][2];
  return (
    <div className={`holiday-effect holiday-${theme}`} data-holiday={event.id} aria-hidden="true">
      <div className="holiday-ornament left">
        <Ornament theme={theme} index={0} />
      </div>
      <div className="holiday-ornament right">
        <Ornament theme={theme} index={1} />
      </div>
      <div className="holiday-greeting">
        {active
          .slice(0, 2)
          .map((e) => holidayCatalog[e.id][1])
          .join(' · ')}
        <span>BLANCO · COFFEE & MORE</span>
      </div>
      <div className="holiday-lights">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} style={{ left: `${7 + i * 9}%`, '--delay': `${i * 0.7}s` } as CSSProperties} />
        ))}
      </div>
    </div>
  );
}
export default function TVAtmosphere({
  settings,
}: {
  settings: HolidaySettings & { season: Season };
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  return activeHolidays(settings, now).length ? (
    <HolidayDecor settings={settings} />
  ) : (
    <SeasonEffect season={settings.season} />
  );
}
