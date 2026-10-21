import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const menu = JSON.parse(readFileSync(new URL('../../src/data/menu.json', import.meta.url), 'utf8'));
test.use({ baseURL: 'http://127.0.0.1:5180' });
test('owner publishes bilingual TV loyalty controls; TV loads edits and restores space when hidden', async ({
  page,
}) => {
  let content = structuredClone(menu),
    revision = 1;
  const owner = '11111111-1111-4111-8111-111111111111';
  await page.addInitScript(
    ({ owner }) =>
      localStorage.setItem(
        'sb-blanco-test-auth-token',
        JSON.stringify({
          access_token: 'fake-access-token',
          refresh_token: 'fake-refresh-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'bearer',
          user: {
            id: owner,
            email: 'owner@example.com',
            aud: 'authenticated',
            role: 'authenticated',
          },
        }),
      ),
    { owner },
  );
  await page.route('**/rest/v1/menu_admins*', (r) => r.fulfill({ json: { user_id: owner } }));
  await page.route('**/rest/v1/menu_state*', async (r) => {
    if (r.request().method() === 'PATCH') {
      const body = r.request().postDataJSON();
      content = body.content;
      revision = body.revision;
      return r.fulfill({ json: { revision } });
    }
    await r.fulfill({ json: { content, revision } });
  });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'شاشة التلفزيون', exact: true }).click();
  await page.getByLabel('العنوان', { exact: true }).fill('Rejoignez Blanco !');
  await page.getByLabel('رابط رمز QR', { exact: true }).fill('https://example.com/club');
  await page.getByLabel('مكان الشريط').selectOption('top');
  await page.getByLabel('جهة رمز QR').selectOption('right');
  await page.getByLabel('لون خلفية الشريط').fill('#cde0cb');
  await page.getByRole('button', { name: 'FR', exact: true }).click();
  await expect(page.getByLabel('Titre', { exact: true })).toHaveValue('Rejoignez Blanco !');
  await page.getByRole('button', { name: 'Publier les modifications', exact: true }).click();
  await expect(
    page.getByText('Modifications publiées sur la carte et la télévision.', { exact: true }),
  ).toBeVisible();
  await page.goto('/tv');
  await expect(page.locator('.tv-loyalty')).toHaveAttribute('href', 'https://example.com/club');
  await expect(page.locator('.tv-loyalty strong')).toHaveText('Rejoignez Blanco !');
  await expect(page.locator('.tv-stage')).toHaveAttribute('data-loyalty-position', 'top');
  await expect(page.locator('.tv-loyalty')).toHaveAttribute('data-qr-side', 'right');
  await page.goto('/admin');
  await page.getByRole('button', { name: 'شاشة التلفزيون', exact: true }).click();
  await page.getByLabel('إظهار رمز QR', { exact: true }).uncheck();
  await expect(page.locator('.tv-loyalty-preview img')).toHaveCount(0);
  await page.getByRole('button', { name: 'نشر التعديلات', exact: true }).click();
  await page.goto('/tv');
  await expect(page.locator('.tv-loyalty')).toBeVisible();
  await expect(page.locator('.tv-loyalty img')).toHaveCount(0);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'شاشة التلفزيون', exact: true }).click();
  await page.getByLabel('إظهار شريط الولاء', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'نشر التعديلات', exact: true }).click();
  await page.goto('/tv');
  await expect(page.locator('.tv-loyalty')).toHaveCount(0);
  expect(
    await page
      .locator('.tv-stage')
      .evaluate((el) => el.style.getPropertyValue('--tv-loyalty-space')),
  ).toBe('0%');
});
