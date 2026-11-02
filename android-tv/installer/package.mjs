import { mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = resolve(import.meta.dirname, '../..'),
  source = join(root, 'android-tv/installer');
const archive = process.argv[2];
if (!archive) throw new Error('Pass the official Google Windows platform-tools ZIP path.');
const out = join(root, 'android-tv/build/Blanco-TV-Windows');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
execFileSync('unzip', ['-q', resolve(archive), '-d', out]);
for (const f of ['Start-Blanco.cmd', 'Blanco-Setup.ps1', 'Blanco.Core.ps1', 'LISEZ-MOI.txt'])
  copyFileSync(join(source, f), join(out, f));
copyFileSync(join(root, 'android-tv/dist/blanco-tv-pilot.apk'), join(out, 'blanco-tv-pilot.apk'));
const hashes = {};
for (const f of [
  'blanco-tv-pilot.apk',
  'platform-tools/adb.exe',
  'platform-tools/AdbWinApi.dll',
  'platform-tools/AdbWinUsbApi.dll',
])
  hashes[f] = createHash('sha256')
    .update(readFileSync(join(out, f)))
    .digest('hex');
writeFileSync(join(out, 'checksums.json'), JSON.stringify(hashes, null, 2) + '\n');
const zip = join(root, 'android-tv/dist/Blanco-TV-Windows.zip');
rmSync(zip, { force: true });
execFileSync('zip', ['-qr', zip, 'Blanco-TV-Windows'], { cwd: resolve(out, '..') });
writeFileSync(
  zip + '.sha256',
  createHash('sha256').update(readFileSync(zip)).digest('hex') + '  Blanco-TV-Windows.zip\n',
);
console.log(zip);
