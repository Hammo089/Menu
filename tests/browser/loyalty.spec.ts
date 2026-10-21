import { test, expect, type Page } from '@playwright/test';
import QRCode from 'qrcode';
test.use({ baseURL: 'http://127.0.0.1:5180' });
const owner = '11111111-1111-4111-8111-111111111111';
const code = 'BL-ABCDE-12345';
const program = {
  revision: 1,
  enabled: true,
  title: 'Les petites habitudes récompensées.',
  goal: 8,
  window_days: 30,
  reward_kind: 'drink',
  reward_value: 0,
  reward_label: 'Une boisson offerte',
  max_price_cents: 0,
  reward_days: 14,
  next_day: true,
  daily_limit: 50,
  eligible_text: 'Un tampon par boisson payée.',
};
const originalMember = {
  code,
  name: 'Camille Martin',
  phone: '+33611223344',
  stamps: 3,
  goal: 8,
  cycleExpiresAt: new Date(Date.now() + 86400000 * 20).toISOString(),
  cycleExpired: false,
  totalStamps: 3,
  rules: program,
  rewards: [],
  history: [],
  createdAt: new Date().toISOString(),
  lastEvent: { id: '11111111-1111-4111-8111-111111111111', kind: 'stamp', canUndo: true },
};
async function setup(page: Page, authenticated = false, withReward = false) {
  let member = structuredClone({
      ...originalMember,
      rewards: withReward
        ? [
            {
              id: '12345678-1234-4234-8234-123456789012',
              label: 'Une boisson offerte',
              kind: 'drink',
              value: 0,
              maxPriceCents: 0,
              status: 'ready',
              earnedAt: new Date().toISOString(),
              availableAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 86400000 * 14).toISOString(),
            },
          ]
        : [],
    }),
    key = '',
    resetKey = '',
    pin = '482951';
  const calls: { action: string; payload: Record<string, unknown> }[] = [];
  if (authenticated)
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
  await page.route('**/api/loyalty-session', (r) => r.fulfill({ json: { ok: true } }));
  await page.route('**/rest/v1/rpc/loyalty_login', async (route) => {
    const { payload } = route.request().postDataJSON();
    calls.push({ action: 'login', payload });
    if (payload.pin !== pin || payload.phone !== '0611223344')
      return route.fulfill({
        json: {
          error:
            'Téléphone ou PIN incorrect. Si vous avez oublié votre PIN, contactez la direction de Blanco.',
        },
      });
    key = payload.key;
    const { phone, ...publicMember } = member;
    await route.fulfill({ json: { member: publicMember, program } });
  });
  await page.route('**/rest/v1/rpc/loyalty_api', async (route) => {
    const body = route.request().postDataJSON();
    calls.push(body);
    const { action, payload } = body;
    const result: Record<string, unknown> = { program, owner: true };
    if (action === 'register') {
      key = payload.key;
      result.member = member;
    }
    if (action === 'card') {
      if (payload.key === resetKey)
        return route.fulfill({ json: { setupRequired: true, setupName: member.name, program } });
      if (key && key !== payload.key)
        return route.fulfill({
          status: 400,
          json: { code: 'P0001', message: 'Cette carte est introuvable.' },
        });
      const { phone, ...publicMember } = member;
      result.member = publicMember;
    }
    if (action === 'member') result.member = member;
    if (action === 'search') {
      result.members = [{ ...member, rewards: 0 }];
      result.stats = { members: 1, stamps: member.totalStamps, ready: 0, redeemed: 0 };
    }
    if (action === 'stamp') {
      member = {
        ...member,
        stamps: member.stamps + payload.amount,
        totalStamps: member.totalStamps + payload.amount,
      };
      result.member = member;
    }
    if (action === 'recover') {
      resetKey = payload.key;
      result.member = member;
    }
    if (action === 'activate') {
      if (payload.key !== resetKey) return route.fulfill({ json: { error: 'Lien expiré.' } });
      key = payload.deviceKey;
      pin = payload.pin;
      resetKey = '';
      result.member = member;
    }
    if (action === 'reward_authorize') {
      if (payload.pin !== pin)
        return route.fulfill({ json: { error: 'Téléphone ou PIN incorrect.' } });
      result.approvalCode = '754209';
      result.approvalExpiresAt = new Date(Date.now() + 300000).toISOString();
    }
    if (action === 'redeem') {
      if (payload.approvalCode !== '754209')
        return route.fulfill({
          json: {
            error:
              'Demandez au client son code cadeau temporaire. Le QR seul ne permet pas d’utiliser un cadeau.',
          },
        });
      member = { ...member, rewards: member.rewards.map((r) => ({ ...r, status: 'used' })) };
      result.member = member;
    }
    if (action === 'save_program') result.program = { ...payload.program, revision: 2 };
    if (action === 'staff') result.staff = [];
    if (action === 'erase') result.erased = true;
    await route.fulfill({ json: result });
  });
  return calls;
}
test('French registration, private card persistence, safe QR and home screen guidance fit a phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const calls = await setup(page);
  await page.goto('/fidelite');
  await page.getByLabel('Votre nom et prénom').fill('Camille Martin');
  await page.getByLabel('Votre téléphone', { exact: true }).fill('0611223344');
  await page.getByLabel('Votre PIN (6 chiffres)', { exact: true }).fill('482951');
  if (await page.getByLabel('Confirmez votre PIN', { exact: true }).count())
    await page.getByLabel('Confirmez votre PIN', { exact: true }).fill('482951');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Créer ma carte gratuite' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Sur iPhone', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'C’est fait !' }).click();
  await expect(page.getByLabel('3 tampons sur 8')).toBeVisible();
  expect(page.url()).toMatch(/\/fidelite#cle=[a-f0-9]{64}$/);
  await page.getByRole('button', { name: 'Présenter ma carte' }).click();
  await expect(
    page.getByRole('img', { name: 'QR de ma carte à présenter en caisse' }),
  ).toBeVisible();
  const register = calls.find((c) => c.action === 'register')!;
  const image = await page
    .getByRole('img', { name: 'QR de ma carte à présenter en caisse' })
    .getAttribute('src');
  const decoded = await page.evaluate(async () => {
    const path = '/node_modules/.vite/deps/@zxing_browser.js';
    const { BrowserQRCodeReader } = await import(path);
    return (
      await new BrowserQRCodeReader().decodeFromImageElement(
        document.querySelector('.loy-modal .loy-qr img'),
      )
    ).getText();
  });
  expect(decoded).toBe(`http://127.0.0.1:5180/admin/fidelite?carte=${code}`);
  expect(decoded).not.toContain(String(register.payload.key));
  expect(JSON.stringify(calls.filter((c) => c.action === 'card'))).not.toContain('phone');
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('3 tampons sur 8')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('blanco-loyalty-key-v2'))).toBe(
    register.payload.key,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/blanco-loyalty-mobile.png', fullPage: true });
});
test('staff scans a photo QR, stamps, searches, restores access and configures the program', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const calls = await setup(page, true);
  await page.goto('/admin/fidelite');
  await expect(page.getByRole('heading', { name: 'Chaque visite compte.' })).toBeVisible();
  const image = await QRCode.toBuffer(`http://127.0.0.1:5180/admin/fidelite?carte=${code}`);
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'card.png', mimeType: 'image/png', buffer: image });
  await expect(page.getByRole('heading', { name: 'Camille Martin', exact: true })).toBeVisible();
  await page.getByLabel('Nombre de boissons payées').fill('2');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Ajouter 2 tampons' }).click();
  await expect(page.getByLabel('5 tampons sur 8')).toBeVisible();
  expect(calls.find((c) => c.action === 'stamp')?.payload.requestId).toMatch(/^[a-f0-9-]{36}$/);
  await page.getByText('Assistance & données du client', { exact: true }).click();
  await page.getByRole('button', { name: 'Retrouver son accès' }).click();
  await page.getByLabel('Les 4 derniers chiffres de son téléphone').fill('3344');
  await page.getByRole('checkbox', { name: 'Le client est présent' }).check();
  await page.getByRole('button', { name: 'Créer son nouveau lien' }).click();
  await expect(page.getByRole('heading', { name: 'Sa carte est retrouvée.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ouvrir son nouveau lien' })).toHaveAttribute(
    'href',
    /\/fidelite#cle=[a-f0-9]{64}$/,
  );
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.getByRole('button', { name: 'Programme', exact: true }).click();
  await page.getByLabel('Boissons pour obtenir un cadeau').fill('10');
  await page.getByRole('button', { name: 'Enregistrer le programme' }).click();
  await expect(page.getByText('Les règles ont été enregistrées.')).toBeVisible();
  expect(calls.find((c) => c.action === 'save_program')?.payload.program).toMatchObject({
    goal: 10,
  });
  await page.getByRole('button', { name: 'Clients & caisse' }).click();
  await page.getByRole('button', { name: 'Tous les clients' }).click();
  await page.getByRole('textbox', { name: 'Rechercher un client' }).fill('Camille');
  await expect
    .poll(() => calls.filter((c) => c.action === 'search').at(-1)?.payload.query)
    .toBe('Camille');
  await page.screenshot({ path: '/tmp/blanco-loyalty-admin.png', fullPage: true });
});
test('public customer code opens the staff login, never a customer private card', async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/admin/fidelite?carte=${code}`);
  await expect(page.getByRole('heading', { name: 'Bonjour, l’équipe.' })).toBeVisible();
  await expect(page.getByText('Camille Martin', { exact: true })).toHaveCount(0);
});

test('customers reopen an existing card by phone and PIN after signing out', async ({ page }) => {
  const calls = await setup(page);
  await page.goto('/fidelite?connexion=1');

  await page.getByLabel('Votre téléphone', { exact: true }).fill('0611223344');
  await page.getByLabel('Votre PIN (6 chiffres)', { exact: true }).fill('482951');
  if (await page.getByLabel('Confirmez votre PIN', { exact: true }).count())
    await page.getByLabel('Confirmez votre PIN', { exact: true }).fill('482951');
  await page.getByLabel('Votre PIN (6 chiffres)', { exact: true }).fill('999998');
  await page.getByRole('button', { name: 'Retrouver ma carte', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Téléphone ou PIN incorrect');
  await page.getByLabel('Votre PIN (6 chiffres)', { exact: true }).fill('482951');

  await page.getByRole('button', { name: 'Retrouver ma carte', exact: true }).click();
  await expect(page.getByLabel('3 tampons sur 8')).toBeVisible();
  await page.getByRole('button', { name: 'Me déconnecter de cet appareil', exact: true }).click();
  await page.getByRole('button', { name: 'Me déconnecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Heureux de vous revoir.' })).toBeVisible();

  await page.getByLabel('Votre téléphone', { exact: true }).fill('0611223344');
  await page.getByLabel('Votre PIN (6 chiffres)', { exact: true }).fill('482951');
  if (await page.getByLabel('Confirmez votre PIN', { exact: true }).count())
    await page.getByLabel('Confirmez votre PIN', { exact: true }).fill('482951');
  await page.getByRole('button', { name: 'Retrouver ma carte', exact: true }).click();
  await expect(page.getByLabel('3 tampons sur 8')).toBeVisible();
  expect(calls.filter((c) => c.action === 'register')).toHaveLength(0);
});

test('loyalty administration switches completely to Arabic with RTL and remembers the selection', async ({
  page,
}) => {
  await setup(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/fidelite');
  await page.getByRole('button', { name: 'عربي', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'كل زيارة إلها قيمة.' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('button', { name: 'إعدادات البرنامج', exact: true }).click();
  await page.getByLabel('عدد المشروبات للحصول على هدية').fill('10');
  await page.getByRole('button', { name: 'حفظ إعدادات البرنامج' }).click();
  await expect(page.getByText('تم حفظ شروط البرنامج.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'كل زيارة إلها قيمة.' })).toBeVisible();
  await page.getByLabel('أو أدخل كود البطاقة').fill(code);
  await page.getByRole('button', { name: 'فتح البطاقة', exact: true }).click();
  await page.getByLabel('عدد المشروبات المدفوعة').fill('1');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'إضافة 1 أختام' }).click();
  await expect(page.getByLabel('4 أختام من 8')).toBeVisible();
  await expect(page.getByText('تمت إضافة الأختام. تتحدث بطاقة الزبون تلقائيًا.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/blanco-loyalty-admin-ar.png', fullPage: true });
  await page.getByRole('button', { name: 'FR', exact: true }).click();
  await expect(page.getByLabel('Nombre de boissons payées')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('a slow card refresh cannot restore the device session after signing out', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/rest/v1/rpc/loyalty_api', async (route) => {
    if (route.request().postDataJSON().action === 'card')
      await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fallback();
  });
  await page.route('**/api/loyalty-session', async (route) => {
    if (route.request().method() === 'DELETE')
      await new Promise((resolve) => setTimeout(resolve, 900));
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto('/fidelite?connexion=1');

  await page.getByLabel('Votre téléphone', { exact: true }).fill('0611223344');
  await page.getByLabel('Votre PIN (6 chiffres)', { exact: true }).fill('482951');
  if (await page.getByLabel('Confirmez votre PIN', { exact: true }).count())
    await page.getByLabel('Confirmez votre PIN', { exact: true }).fill('482951');
  await page.getByRole('button', { name: 'Retrouver ma carte', exact: true }).click();
  await page.getByRole('button', { name: 'Me déconnecter de cet appareil', exact: true }).click();
  await page.getByRole('button', { name: 'Me déconnecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Heureux de vous revoir.' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('blanco-loyalty-key-v2'))).toBeNull();
  await expect(page.locator('.loy-stamp-card')).toHaveCount(0);
});

test('recovery provides a visible follow-up link, one-time PIN setup and a separate gift approval code', async ({
  page,
}) => {
  const calls = await setup(page, true, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/admin/fidelite?carte=${code}`);
  await page.getByText('Assistance & données du client', { exact: true }).click();
  await page.getByRole('button', { name: 'Retrouver son accès' }).click();
  await page.getByLabel('Les 4 derniers chiffres de son téléphone').fill('3344');
  await page.getByRole('checkbox', { name: 'Le client est présent' }).check();
  await page.getByRole('button', { name: 'Créer son nouveau lien' }).click();
  const input = page.getByLabel('Lien personnel de suivi du client');
  await expect(input).toBeVisible();
  const link = await input.inputValue();
  expect(link).toMatch(/\/fidelite#cle=[a-f0-9]{64}$/);
  await expect(page.getByRole('dialog')).toContainText('3 boissons au total');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copier son lien privé' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Lien copié');
  await page.screenshot({ path: '/tmp/blanco-pin-recovery-link.png', fullPage: true });
  await page.goto(link);
  await expect(page.getByText('VOTRE CARTE EST RETROUVÉE', { exact: true })).toBeVisible();
  await page.getByLabel('Votre PIN (6 chiffres)', { exact: true }).fill('736194');
  await page.getByLabel('Confirmez votre PIN', { exact: true }).fill('736194');
  await page.getByRole('button', { name: 'Enregistrer mon PIN et ouvrir ma carte' }).click();
  await expect(page.getByLabel('3 tampons sur 8')).toBeVisible();
  await expect(page).not.toHaveURL(link);
  await page.getByRole('button', { name: 'Préparer mon cadeau' }).click();
  await page.getByLabel('Votre PIN (6 chiffres)', { exact: true }).fill('736194');
  await page.getByRole('button', { name: 'Obtenir mon code cadeau' }).click();
  await expect(page.getByLabel('Code cadeau temporaire')).toHaveText('754209');
  await page.goto(`/admin/fidelite?carte=${code}`);
  await page.getByRole('button', { name: 'Utiliser ce cadeau' }).click();
  await expect(page.getByRole('button', { name: 'Confirmer l’utilisation' })).toBeDisabled();
  await page.getByLabel('Code cadeau du client (6 chiffres)').fill('754209');
  await page.getByRole('button', { name: 'Confirmer l’utilisation' }).click();
  await expect(page.getByText('Déjà utilisé', { exact: true })).toBeVisible();
  expect(calls.find((c) => c.action === 'redeem')?.payload.approvalCode).toBe('754209');
  await expect(page.getByLabel('3 tampons sur 8')).toBeVisible();
});

test('opening a replacement private link in an existing tab switches to the new card', async ({
  page,
}) => {
  const calls = await setup(page);
  await page.goto(`/fidelite#cle=${'a'.repeat(64)}`);
  await expect(page.getByLabel('3 tampons sur 8')).toBeVisible();
  await page.evaluate(() => {
    location.hash = `cle=${'b'.repeat(64)}`;
  });
  await expect
    .poll(() => calls.filter((c) => c.action === 'card').at(-1)?.payload.key)
    .toBe('b'.repeat(64));
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('blanco-loyalty-key-v2')))
    .toBe('b'.repeat(64));
});

test('an interrupted cashier operation survives reload and retries with the same transaction id', async ({
  page,
}) => {
  const calls = await setup(page, true);
  let failedId = '';
  await page.route('**/rest/v1/rpc/loyalty_api', async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === 'stamp' && !failedId) {
      failedId = body.payload.requestId;
      return route.abort('failed');
    }
    await route.fallback();
  });
  await page.goto(`/admin/fidelite?carte=${code}`);
  await expect(page.getByRole('heading', { name: 'Camille Martin', exact: true })).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Ajouter 1 tampon', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Vérifier et réessayer' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Vérifier et réessayer' }).click();
  await expect(page.getByLabel('4 tampons sur 8')).toBeVisible();
  expect(calls.find((c) => c.action === 'stamp')?.payload.requestId).toBe(failedId);
  expect(await page.evaluate(() => sessionStorage.getItem('blanco-loyalty-pending-v1'))).toBeNull();
});
