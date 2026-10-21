import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTVLoyalty, tvLoyaltySettings, validTVLoyalty } from '../src/tvLoyalty.ts';
test('TV loyalty settings preserve existing menus and reject unsafe links or unbounded layouts', () => {
  assert.equal(validTVLoyalty(undefined), true);
  assert.equal(validTVLoyalty(defaultTVLoyalty), true);
  assert.deepEqual(tvLoyaltySettings(), defaultTVLoyalty);
  for (const url of [
    'javascript:alert(1)',
    'https://',
    'http://example.com',
    'https://user:password@example.com',
    'https://exa mple.com',
  ])
    assert.equal(validTVLoyalty({ ...defaultTVLoyalty, url }), false);
  assert.equal(
    validTVLoyalty({
      ...defaultTVLoyalty,
      url: 'https://example.com/club?source=tv',
      qrVisible: false,
      enabled: false,
    }),
    true,
  );
  for (const patch of [
    { height: 90 },
    { textScale: 500 },
    { qrScale: -1 },
    { title: 'a'.repeat(161) },
    { qrColor: 'red' },
    { position: 'middle' },
  ])
    assert.equal(validTVLoyalty({ ...defaultTVLoyalty, ...patch }), false);
});
