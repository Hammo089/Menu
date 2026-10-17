import { createClient } from '@supabase/supabase-js';
import rawMenu from './data/menu.json';
import type { MenuState } from './types';
import { validHolidaySettings } from './holidays';

export const initialMenu = rawMenu as MenuState;
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export const formatPrice = (cents: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const originalPrice = (cents: number) => `${(cents / 100).toFixed(2)}€`;
export function safeImage(value: string) {
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    return new URL(value).protocol === 'https:' ? value : '/images/coffee.jpg';
  } catch {
    return '/images/coffee.jpg';
  }
}
export function validateMenu(value: unknown): value is MenuState {
  try {
    if (!value || typeof value !== 'object') return false;
    const m = value as MenuState;
    return (
      Array.isArray(m.products) &&
      m.products.length <= 200 &&
      Array.isArray(m.categories) &&
      m.categories.length > 0 &&
      m.categories.length <= 12 &&
      m.categories.every(
        (c) =>
          typeof c.id === 'string' &&
          typeof c.name === 'string' &&
          c.name.length > 0 &&
          c.name.length < 100 &&
          Number.isFinite(c.order) &&
          [0, 1].includes(c.column),
      ) &&
      new Set(m.categories.map((c) => c.id)).size === m.categories.length &&
      m.products.every(
        (p) =>
          typeof p.id === 'string' &&
          typeof p.name === 'string' &&
          p.name.length > 0 &&
          p.name.length < 100 &&
          Number.isInteger(p.priceCents) &&
          p.priceCents >= 0 &&
          p.priceCents <= 100000 &&
          typeof p.image === 'string' &&
          typeof p.available === 'boolean' &&
          Number.isFinite(p.order) &&
          m.categories.some((c) => c.id === p.categoryId),
      ) &&
      new Set(m.products.map((p) => p.id)).size === m.products.length &&
      !!m.settings &&
      [
        'brandName',
        'tagline',
        'accent',
        'background',
        'textColor',
        'logo',
        'tvBackground',
        'promotionText',
        'promotionLabel',
      ].every((k) => typeof m.settings[k as keyof typeof m.settings] === 'string') &&
      /^#[0-9a-f]{6}$/i.test(m.settings.accent) &&
      /^#[0-9a-f]{6}$/i.test(m.settings.background) &&
      /^#[0-9a-f]{6}$/i.test(m.settings.textColor) &&
      /^#[0-9a-f]{6}$/i.test(m.settings.tvBackground) &&
      ['none', 'auto', 'weather', 'autumn', 'winter', 'spring', 'summer'].includes(
        m.settings.season,
      ) &&
      validHolidaySettings(m.settings) &&
      typeof m.settings.adsEnabled === 'boolean' &&
      Number.isFinite(m.settings.tvScale) &&
      m.settings.tvScale >= 0.5 &&
      m.settings.tvScale <= 1.2 &&
      ['portrait', 'landscape'].includes(m.settings.tvOrientation) &&
      [0, 90, 180, 270].includes(m.settings.tvRotation) &&
      Array.isArray(m.settings.promotionIds) &&
      m.settings.promotionIds.every((id) => typeof id === 'string') &&
      Number.isFinite(m.settings.adDurationSeconds) &&
      m.settings.adDurationSeconds >= 1 &&
      m.settings.adDurationSeconds <= 120 &&
      Number.isFinite(m.settings.adIntervalSeconds) &&
      m.settings.adIntervalSeconds >= 10 &&
      m.settings.adIntervalSeconds <= 3600 &&
      m.settings.adDurationSeconds < m.settings.adIntervalSeconds
    );
  } catch {
    return false;
  }
}
