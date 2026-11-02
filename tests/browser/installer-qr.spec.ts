import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from '@zxing/library';
test('native pairing QR decodes to the owner login with the short pairing code', async ({
  page,
}) => {
  const assets = new URL('../../android-tv/app/src/main/assets/', import.meta.url);
  await page.route('**/native-pairing/**', async (route) => {
    const js = route.request().url().endsWith('qrcode.js');
    await route.fulfill({
      contentType: js ? 'text/javascript' : 'text/html',
      body: readFileSync(new URL(js ? 'qrcode.js' : 'pairing.html', assets)),
    });
  });
  await page.goto('/native-pairing/index.html#A1B2C3D4E5');
  await expect(page.locator('canvas')).toHaveAttribute('width', '512');
  const url = await page.locator('canvas').evaluate((c: HTMLCanvasElement) => c.toDataURL());
  const png = PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
  const gray = new Uint8ClampedArray(png.width * png.height);
  for (let i = 0; i < gray.length; i++) gray[i] = png.data[i * 4];
  const decoded = new QRCodeReader().decode(
    new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gray, png.width, png.height))),
  );
  expect(decoded.getText()).toBe(
    'https://blanco-menu-one.vercel.app/admin/screens?pair=A1B2C3D4E5',
  );
});
