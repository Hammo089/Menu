import { supabase } from '../lib';

export interface Program {
  revision: number;
  enabled: boolean;
  title: string;
  goal: number;
  window_days: number;
  reward_kind: 'drink' | 'percent' | 'fixed';
  reward_value: number;
  reward_label: string;
  max_price_cents: number;
  reward_days: number;
  next_day: boolean;
  daily_limit: number;
  eligible_text: string;
}
export interface Reward {
  id: string;
  label: string;
  kind: string;
  value: number;
  maxPriceCents: number;
  earnedAt: string;
  availableAt: string;
  expiresAt: string;
  status: 'used' | 'expired' | 'soon' | 'ready';
}
export interface Member {
  id?: string;
  code: string;
  name: string;
  phone?: string;
  stamps: number;
  goal: number;
  cycleExpiresAt: string | null;
  cycleExpired: boolean;
  totalStamps: number;
  rules: Program;
  rewards: Reward[];
  history: { id: string; kind: string; delta: number; at: string }[];
  createdAt: string;
  lastEvent?: { id: string; kind: string; canUndo: boolean };
}
export interface Result {
  member: Member;
  program: Program;
  owner: boolean;
  replayed?: boolean;
  members: (Member & { rewards: number })[];
  stats: { members: number; stamps: number; ready: number; redeemed: number };
  staff: { email: string; active: boolean }[];
}
export const CARD_KEY = 'blanco-loyalty-key-v1';
export const CACHE_KEY = 'blanco-loyalty-cache-v1';
export const validKey = (key: string | null): key is string => !!key && /^[a-f0-9]{64}$/.test(key);
export const makeKey = () =>
  [...crypto.getRandomValues(new Uint8Array(32))]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
export const cardLink = (key: string) => `${location.origin}/fidelite#cle=${key}`;
export const scanLink = (code: string) =>
  `${location.origin}/admin/fidelite?carte=${encodeURIComponent(code)}`;
export function storageGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function storageSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* Private browsing can forbid persistence. The private URL still works. */
  }
}
export async function rpc(action: string, payload: Record<string, unknown> = {}): Promise<Result> {
  if (!supabase)
    throw new Error('Le service fidélité est indisponible. Réessayez dans un instant.');
  if (!navigator.onLine) throw new Error('Connexion nécessaire. Aucun changement n’a été envoyé.');
  const { data, error } = await supabase
    .rpc('loyalty_api', { action, payload })
    .abortSignal(AbortSignal.timeout(15000));
  if (error) {
    if (error.code === 'P0001') throw Object.assign(new Error(error.message), { definitive: true });
    throw new Error(
      'La connexion n’a pas abouti. Réessayez : une opération ne sera comptée qu’une fois.',
    );
  }
  return data as Result;
}
export const date = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(new Date(value));
export const money = (cents: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export function rewardDescription(r: { kind: string; value: number; maxPriceCents: number }) {
  return r.kind === 'percent'
    ? `${r.value} % de réduction`
    : r.kind === 'fixed'
      ? `${money(r.value)} de réduction`
      : `Une boisson offerte${r.maxPriceCents > 0 ? ` jusqu’à ${money(r.maxPriceCents)}` : ''}`;
}
export function readScan(value: string) {
  const text = value.trim().toUpperCase();
  if (/^BL-[A-F0-9]{5}-[A-F0-9]{5}$/.test(text)) return text;
  try {
    const url = new URL(value);
    if (url.origin !== location.origin || url.pathname !== '/admin/fidelite') return null;
    return readScan(url.searchParams.get('carte') || '');
  } catch {
    return null;
  }
}
