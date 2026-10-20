import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'blanco-loyalty-offline-shell',
      generateBundle(_options, bundle) {
        const resources = Object.keys(bundle)
          .filter((name) => /\.(js|css)$/.test(name))
          .map((name) => `/${name}`);
        const version = createHash('sha256')
          .update(JSON.stringify(resources))
          .digest('hex')
          .slice(0, 12);
        this.emitFile({
          type: 'asset',
          fileName: 'loyalty-precache.json',
          source: JSON.stringify(resources),
        });
        this.emitFile({
          type: 'asset',
          fileName: 'loyalty-sw.js',
          source: readFileSync(new URL('./public/loyalty-sw.js', import.meta.url), 'utf8').replace(
            '__BUILD__',
            version,
          ),
        });
      },
    },
  ],
  build: { target: 'es2020' },
});
