import { supabase } from '../lib';
export type TVItem = { type: 'image' | 'video' | 'url'; url: string; duration: number };
export type TVDay = { day: number; enabled: boolean; start: string; end: string };
export type TVConfig = {
  mode: 'menu' | 'url' | 'playlist';
  url: string;
  items: TVItem[];
  orientation: 'portrait' | 'landscape';
  rotation: 0 | 90 | 180 | 270;
  override: 'auto' | 'open' | 'closed';
  schedule: { enabled: boolean; timezone: 'Europe/Paris'; days: TVDay[] };
};
export type TVDevice = {
  id: string;
  name: string;
  revoked: boolean;
  config: TVConfig;
  revision: number;
  status: Record<string, unknown>;
  lastSeenAt: string | null;
  pairedAt: string;
  hasPin: boolean;
};
export type TVCommand = {
  id: string;
  kind: string;
  createdAt: string;
  expiresAt: string;
  acknowledgedAt: string | null;
  result: string | null;
  message: string | null;
};
export const defaultConfig = (): TVConfig => ({
  mode: 'menu',
  url: '',
  items: [],
  orientation: 'portrait',
  rotation: 0,
  override: 'auto',
  schedule: {
    enabled: false,
    timezone: 'Europe/Paris',
    days: Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      enabled: i < 6,
      start: '08:00',
      end: '20:00',
    })),
  },
});
export async function tvRpc(action: string, payload: Record<string, unknown> = {}) {
  if (!supabase) throw new Error('Supabase non configuré / غير مربوط');
  const { data, error } = await supabase.rpc('tv_api', { action, payload });
  if (error || data?.error) throw new Error(error?.message || data.error);
  return data as {
    devices?: TVDevice[];
    commands?: TVCommand[];
    id?: string;
    saved?: boolean;
    commandId?: string;
  };
}
export function validExitPin(pin: string) {
  return (
    /^\d{6,12}$/.test(pin) &&
    !/^(\d)\1+$/.test(pin) &&
    !['123456', '654321', '123456789', '0123456789'].includes(pin)
  );
}
export async function exitPinHash(pin: string) {
  if (!validExitPin(pin))
    throw new Error(
      'Choisissez 6 à 12 chiffres personnels / اختر من ٦ إلى ١٢ رقمًا بدون تسلسل واضح',
    );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' },
    key,
    256,
  );
  const hex = (bytes: Uint8Array) =>
    Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return { pinSalt: hex(salt), pinHash: hex(new Uint8Array(hash)) };
}
export function scheduleOpen(config: TVConfig, now = new Date()) {
  if (config.override !== 'auto') return config.override === 'open';
  if (!config.schedule.enabled) return true;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')) + 1;
  const minute = Number(get('hour')) * 60 + Number(get('minute'));
  const at = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  return config.schedule.days.some((d) => {
    if (!d.enabled) return false;
    const start = at(d.start),
      end = at(d.end);
    if (start < end) return d.day === day && minute >= start && minute < end;
    return (d.day === day && minute >= start) || ((d.day % 7) + 1 === day && minute < end);
  });
}
