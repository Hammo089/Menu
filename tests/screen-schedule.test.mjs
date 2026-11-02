import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
// Test the same browser schedule helper without loading the network client.
const source = readFileSync(new URL('../src/screens/lib.ts', import.meta.url), 'utf8');
const body = source
  .slice(source.indexOf('export function scheduleOpen'))
  .replace('export function', 'function');
const js = ts.transpileModule(body, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const open = new Function(js + '; return scheduleOpen;')();
const cfg = {
  override: 'auto',
  schedule: {
    enabled: true,
    timezone: 'Europe/Paris',
    days: [{ day: 6, enabled: true, start: '20:00', end: '02:00' }],
  },
};
test('screen hours handle Paris timezone, midnight carry, DST and manual overrides', () => {
  assert.equal(open(cfg, new Date('2026-10-31T19:00:00Z')), true);
  assert.equal(open(cfg, new Date('2026-11-01T00:30:00Z')), true);
  assert.equal(open(cfg, new Date('2026-11-01T01:00:00Z')), false);
  assert.equal(open({ ...cfg, override: 'closed' }, new Date('2026-10-31T20:00:00Z')), false);
  assert.equal(open({ ...cfg, override: 'open' }, new Date('2026-11-02T04:00:00Z')), true);
  const sunday = {
    override: 'auto',
    schedule: { ...cfg.schedule, days: [{ day: 7, enabled: true, start: '02:00', end: '03:00' }] },
  };
  assert.equal(open(sunday, new Date('2026-10-25T00:30:00Z')), true);
  assert.equal(open(sunday, new Date('2026-10-25T01:30:00Z')), true);
  assert.equal(open(sunday, new Date('2026-10-25T02:00:00Z')), false);
});
