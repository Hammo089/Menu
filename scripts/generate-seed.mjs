import { readFileSync, writeFileSync } from 'node:fs';
const content = JSON.stringify(
  JSON.parse(readFileSync(new URL('../src/data/menu.json', import.meta.url), 'utf8')),
).replaceAll("'", "''");
writeFileSync(
  new URL('../supabase/seed.sql', import.meta.url),
  `-- Original 52 products and settings. Run after schema.sql.\n-- Existing published data is never overwritten.\ninsert into public.menu_state(id,content) values ('blanco','${content}'::jsonb) on conflict (id) do nothing;\n`,
);
