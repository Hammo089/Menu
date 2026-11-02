import { copyFileSync, mkdirSync } from 'node:fs';
const target = new URL('../public/downloads/', import.meta.url);
mkdirSync(target, { recursive: true });
for (const name of ['Blanco-TV-Windows.zip', 'blanco-tv-pilot.apk']) {
  copyFileSync(new URL('../android-tv/dist/' + name, import.meta.url), new URL(name, target));
}
