import { test, expect } from '@playwright/test';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pbkdf2Sync } from 'node:crypto';
const menu = JSON.parse(readFileSync(new URL('../../src/data/menu.json', import.meta.url), 'utf8'));
const id = '11111111-1111-4111-8111-111111111112';
test('screen owner pairs with an offline exit PIN, publishes content and midnight schedules, and sees command confirmation', async ({
  page,
}) => {
  const config = {
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
        enabled: true,
        start: '08:00',
        end: '20:00',
      })),
    },
  };
  let devices: any[] = [],
    lastSave: any = null,
    pinSet: any = null;
  const calls: any[] = [];
  await page.addInitScript(() =>
    localStorage.setItem(
      'sb-blanco-test-auth-token',
      JSON.stringify({
        access_token: 'fake-access-token',
        refresh_token: 'fake-refresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'owner@example.com',
          aud: 'authenticated',
          role: 'authenticated',
        },
      }),
    ),
  );
  await page.route('**/rest/v1/rpc/tv_api', async (r) => {
    const { action, payload } = r.request().postDataJSON();
    calls.push({ action, payload });
    let result: any = {};
    if (action === 'list') result.devices = devices;
    if (action === 'claim') {
      pinSet = payload;
      devices = [
        {
          id,
          name: payload.name,
          revoked: false,
          config,
          revision: 1,
          status: {
            model: 'Xiaomi test',
            osVersion: '11',
            deviceOwner: false,
            canSleep: false,
            screenOn: true,
          },
          lastSeenAt: new Date().toISOString(),
          pairedAt: new Date().toISOString(),
          hasPin: true,
        },
      ];
      result.id = id;
    }
    if (action === 'save') {
      lastSave = payload;
      devices = devices.map((d) => ({
        ...d,
        name: payload.name,
        config: payload.config,
        revision: d.revision + 1,
      }));
      result.saved = true;
    }
    if (action === 'command') result.commandId = '22222222-2222-4222-8222-222222222222';
    if (action === 'history')
      result.commands = [
        {
          id: '22222222-2222-4222-8222-222222222222',
          kind: 'reload',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 120000).toISOString(),
          acknowledgedAt: null,
          result: null,
          message: null,
        },
      ];
    if (action === 'pin') result.saved = true;
    await r.fulfill({ json: result });
  });
  await page.goto('http://127.0.0.1:5180/admin/screens?pair=A1B2C3D4E5');
  await expect(page.getByLabel('رمز الاقتران', { exact: true })).toHaveValue('A1B2C3D4E5');
  await page.getByLabel('اسم الشاشة', { exact: true }).fill('Écran comptoir');
  await page.getByLabel('كود الخروج — من ٦ إلى ١٢ رقمًا', { exact: true }).fill('482951');
  await page.getByLabel('تأكيد كود الخروج', { exact: true }).fill('482951');
  await page.getByRole('button', { name: 'ربط الشاشة', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Écran comptoir', exact: true })).toBeVisible();
  expect(pinSet.pinHash).toBe(
    pbkdf2Sync('482951', Buffer.from(pinSet.pinSalt, 'hex'), 210000, 32, 'sha256').toString('hex'),
  );
  expect(pinSet.pin).toBeUndefined();
  await page.getByLabel('تفعيل الجدول الأسبوعي').check();
  await page.getByLabel('بداية الاثنين', { exact: true }).fill('20:00');
  await page.getByLabel('نهاية الاثنين', { exact: true }).fill('02:00');
  await page.getByRole('combobox', { name: 'المحتوى', exact: true }).selectOption('playlist');
  await page.getByRole('button', { name: 'إضافة عنصر', exact: true }).click();
  await page.getByLabel('رابط العنصر 1', { exact: true }).fill('https://example.com/coffee.jpg');
  await page.getByRole('button', { name: 'نشر إعدادات الشاشة', exact: true }).click();
  await expect(page.locator('.screen-editor').getByRole('status')).toContainText('تم النشر');
  expect(lastSave.config.schedule.days[0]).toMatchObject({ start: '20:00', end: '02:00' });
  expect(lastSave.config.items[0].url).toBe('https://example.com/coffee.jpg');
  await expect(page.getByRole('button', { name: 'سكون الجهاز', exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'إعادة تشغيل Android', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'تحديث المحتوى', exact: true }).click();
  await expect(page.locator('.screen-editor').getByRole('status')).toContainText(
    'بانتظار تأكيد التلفزيون',
  );
  expect(calls.find((c) => c.action === 'command').payload.requestId).toMatch(/^[a-f0-9-]{36}$/);
  await page.getByRole('button', { name: 'FR', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Vos écrans, au même endroit.', exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/blanco-screens-admin.png', fullPage: true });
});
test('managed TV hides browser controls and uses per-device orientation', async ({ page }) => {
  await page.goto('/tv?managed=1&orientation=landscape&rotation=90');
  await expect(page.locator('.tv-stage')).toHaveAttribute('data-orientation', 'landscape');
  await expect(page.locator('.tv-stage')).toHaveAttribute('data-rotation', '90');
  await expect(page.locator('.tv-controls')).toBeHidden();
});
test('APK offline menu renders current product/price changes without network and respects loyalty hiding', async ({
  page,
}) => {
  const output = mkdtempSync(join(tmpdir(), 'blanco-offline-test-'));
  execFileSync(process.execPath, ['android-tv/scripts/prepare-assets.mjs', output]);
  const html = readFileSync(join(output, 'offline-menu.html'), 'utf8');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://**', (r) => r.abort());
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.setContent(html);
  const next = structuredClone(menu);
  next.products[0].priceCents = 999;
  next.settings.tvLoyalty = { enabled: false };
  await page.evaluate((state) => {
    (window as any).setMenu(JSON.stringify(state), 'portrait', 0);
  }, next);
  await expect(page.locator('svg [data-product="hot-1"][data-field="price"]')).toContainText(
    '9.99€',
  );
  await expect(page.locator('#club')).toBeHidden();
  expect(errors).toEqual([]);
});
