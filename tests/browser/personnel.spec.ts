import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
const owner = '11111111-1111-4111-8111-111111111119';
async function setup() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create schema extensions;create extension pgcrypto with schema extensions;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,bucket_id text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table public.menu_admins(user_id uuid primary key);grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;insert into public.menu_admins values('${owner}');`,
  );
  await db.exec(
    readFileSync(
      new URL('../../supabase/migrations/20261122202414_personnel.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        '../../supabase/migrations/20261122204701_personnel_absence_ranges.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  let queue = Promise.resolve();
  const files = new Map<string, Buffer>();
  const rpc = (action: string, payload: any, admin = false) => {
    const work = queue.then(async () => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [admin ? owner : '']);
      await db.exec('set role ' + (admin ? 'authenticated' : 'anon'));
      return (
        await db.query('select public.personnel_api($1,$2::jsonb) result', [
          action,
          JSON.stringify(payload),
        ])
      ).rows[0].result;
    });
    queue = work.then(
      () => undefined,
      () => undefined,
    );
    return work;
  };
  async function routes(context: BrowserContext, admin = false) {
    if (admin)
      await context.addInitScript(
        ({ owner }) =>
          localStorage.setItem(
            'sb-blanco-test-auth-token',
            JSON.stringify({
              access_token: 'fake-owner-token',
              refresh_token: 'fake-refresh',
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              token_type: 'bearer',
              user: {
                id: owner,
                email: 'owner@blanco.test',
                aud: 'authenticated',
                role: 'authenticated',
              },
            }),
          ),
        { owner },
      );
    await context.route('https://blanco-test.supabase.co/**', async (route) => {
      const request = route.request(),
        url = request.url();
      if (url.includes('/rest/v1/rpc/personnel_api')) {
        const body = request.postDataJSON();
        try {
          const result = await rpc(
            body.action,
            body.payload,
            request.headers().authorization === 'Bearer fake-owner-token',
          );
          await route.fulfill({ json: result });
        } catch (e) {
          await route.fulfill({
            status: 400,
            json: { code: 'P0001', message: (e as Error).message },
          });
        }
        return;
      }
      if (url.includes('/storage/v1/object/')) {
        const key = decodeURIComponent(url.split('/personnel-documents/')[1] || '');
        if (request.method() === 'POST') {
          files.set(key, request.postDataBuffer()!);
          await route.fulfill({ json: { Key: 'personnel-documents/' + key } });
        } else if (files.has(key))
          await route.fulfill({ contentType: 'application/pdf', body: files.get(key) });
        else
          await route.fulfill({ status: 404, json: { message: 'Not found', statusCode: '404' } });
        return;
      }
      await route.fulfill({ json: { user: { id: owner } } });
    });
  }
  return { db, rpc, routes, files };
}
async function month(page: Page) {
  await page.getByLabel('Mois', { exact: true }).selectOption('01');
  await expect(page.locator('.hr-day-editor')).toBeVisible();
  await expect(page.getByText('Chargement du dossier…', { exact: true })).toHaveCount(0);
}
test('real employee proposal -> owner approval -> archived PDF/Excel, with private profiles and touch-friendly clocks', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const h = await setup();
  const admin = await browser.newContext();
  const staff = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await h.routes(admin, true);
  await h.routes(staff);
  const p = await admin.newPage();
  const q = await staff.newPage();
  try {
    await p.goto('http://127.0.0.1:5180/admin/personnel');
    await expect(p.getByRole('button', { name: /Joudy/ })).toBeVisible();
    await month(p);
    await p.getByRole('button', { name: 'Informations', exact: true }).click();
    await p.getByLabel('Téléphone alternatif').fill('0611223344');
    await p.getByLabel('Adresse complète').fill('10 rue de Grenoble');
    await p.getByLabel('Heures contractuelles / semaine').fill('35');
    await p.getByRole('button', { name: 'Enregistrer la fiche' }).click();
    await expect(p.getByText('Fiche enregistrée.')).toBeVisible();
    await p.getByRole('button', { name: 'Accès salarié', exact: true }).click();
    await p.getByLabel('Nouveau PIN de six chiffres').fill('482951');
    p.once('dialog', (dialog) => dialog.accept());
    await p.getByRole('button', { name: 'Créer / remplacer le lien personnel' }).click();
    const field = p.getByLabel('Lien à transmettre');
    await expect(field).toBeVisible();
    const link = await field.inputValue();
    await q.goto(link.replace('http://127.0.0.1:5180', 'http://127.0.0.1:5180'));
    await q.getByLabel('Votre PIN personnel').fill('482951');
    await q.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await expect(q.getByRole('heading', { name: 'Bonjour Joudy.' })).toBeVisible();
    await month(q);
    await q.getByRole('button', { name: 'vendredi 2 janvier 2026', exact: true }).click();
    await q.getByLabel('Arrivée — heure', { exact: true }).selectOption('11');
    await q.getByLabel('Arrivée — minute', { exact: true }).selectOption('15');
    await q.getByLabel('Départ — heure', { exact: true }).selectOption('19');
    await q.getByLabel('Départ — minute', { exact: true }).selectOption('15');
    await q.getByLabel('Avec une pause', { exact: true }).check();
    await q.getByLabel('Début pause — heure', { exact: true }).selectOption('14');
    await q.getByLabel('Fin pause — heure', { exact: true }).selectOption('15');
    await expect(q.locator('.hr-duration strong')).toHaveText('7 h 00');
    await q.getByRole('button', { name: 'Envoyer pour validation' }).click();
    await expect(q.getByText('Envoyé à la direction.', { exact: true })).toBeVisible();
    expect(await q.locator('.hr-app').evaluate((el) => el.scrollWidth <= innerWidth)).toBe(true);
    await q.screenshot({ path: 'test-results/personnel-salarie-mobile.png', fullPage: true });
    await p.getByRole('button', { name: 'Horaires', exact: true }).click();
    await p.getByRole('button', { name: 'Actualiser les horaires' }).click();
    await p.getByRole('button', { name: 'vendredi 2 janvier 2026', exact: true }).click();
    await expect(p.getByText('Demande en attente', { exact: true })).toBeVisible();
    await p.getByRole('button', { name: 'Approuver la demande reçue' }).click();
    await expect(p.getByText('Demande validée.', { exact: true })).toBeVisible();
    await q.getByRole('button', { name: 'Actualiser les horaires' }).click();
    await expect(q.locator('.hr-stats strong').first()).toHaveText('7 h 00');
    expect(await q.getByText('10 rue de Grenoble').count()).toBe(0);
    await p.getByRole('button', { name: 'Relevés & historique', exact: true }).click();
    const [download] = await Promise.all([
      p.waitForEvent('download'),
      p.getByRole('button', { name: 'Générer le relevé PDF' }).click(),
    ]);
    await download.saveAs('/tmp/blanco-personnel-preview.pdf');
    const path = await download.path();
    const pdf = await PDFDocument.load(readFileSync(path!));
    expect(pdf.getPageCount()).toBeGreaterThan(0);
    expect(h.files.size).toBe(1);
    await expect(p.getByText(/Version 1 ·/)).toBeVisible();
    const [excel] = await Promise.all([
      p.waitForEvent('download'),
      p.getByRole('button', { name: 'Générer Excel', exact: true }).click(),
    ]);
    expect(
      readFileSync((await excel.path())!)
        .slice(0, 2)
        .toString(),
    ).toBe('PK');
    await expect(p.getByText(/Version 2 ·/)).toBeVisible();
    await p.getByRole('button', { name: 'Ajouter un employé' }).click();
    await p.getByLabel('Prénom', { exact: true }).fill('Test Employé');
    await p.getByRole('button', { name: 'Enregistrer la fiche' }).click();
    await expect(p.getByRole('button', { name: /Test Employé/ })).toBeVisible();
  } finally {
    await admin.close();
    await staff.close();
    await h.db.close();
  }
});

test('switching a personal link in the same tab requires the new PIN and removes the previous employee', async ({
  browser,
}) => {
  const h = await setup(),
    context = await browser.newContext();
  await h.routes(context);
  const p = await context.newPage();
  try {
    const d: any = await h.rpc('dashboard', { month: '2026-01' }, true);
    const a: any = await h.rpc(
        'access_reset',
        { employeeId: d.employees[0].id, pin: '482951' },
        true,
      ),
      b: any = await h.rpc('access_reset', { employeeId: d.employees[1].id, pin: '739284' }, true);
    await p.goto('http://127.0.0.1:5180/equipe#invitation=' + a.link);
    await p.getByLabel('Votre PIN personnel').fill('482951');
    await p.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await expect(p.getByRole('heading', { name: 'Bonjour Joudy.' })).toBeVisible();
    await p.goto('http://127.0.0.1:5180/equipe#invitation=' + b.link);
    await expect(p.getByLabel('Votre PIN personnel')).toBeVisible();
    await expect(p.getByRole('heading', { name: 'Bonjour Joudy.' })).toHaveCount(0);
    await p.getByLabel('Votre PIN personnel').fill('739284');
    await p.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await expect(p.getByRole('heading', { name: 'Bonjour Ophélie.' })).toBeVisible();
  } finally {
    await context.close();
    await h.db.close();
  }
});
test('a slow private month response cannot repopulate the page after owner logout', async ({
  browser,
}) => {
  const h = await setup(),
    context = await browser.newContext();
  await h.routes(context, true);
  const p = await context.newPage();
  let release: () => void = () => {},
    held = false;
  try {
    await p.goto('http://127.0.0.1:5180/admin/personnel');
    await expect(p.locator('.hr-day-editor')).toBeVisible();
    let hold = false;
    await p.route('**/rest/v1/rpc/personnel_api', async (route) => {
      const { action, payload } = route.request().postDataJSON();
      if (hold && action === 'month') {
        const result = await h.rpc(action, payload, true);
        held = true;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        await route.fulfill({ json: result });
      } else await route.fallback();
    });
    hold = true;
    await p.getByRole('button', { name: 'Actualiser les horaires' }).click();
    await expect.poll(() => held).toBe(true);
    await p.getByRole('button', { name: 'Déconnexion', exact: true }).click();
    await expect(p.getByLabel('E-mail administrateur')).toBeVisible();
    release();
    await p.waitForTimeout(200);
    await expect(p.locator('.hr-employees')).toHaveCount(0);
    await expect(p.locator('.hr-day-editor')).toHaveCount(0);
  } finally {
    release();
    await context.close();
    await h.db.close();
  }
});
