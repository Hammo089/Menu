# Blanco — Coffee & More

منيو رقمية لكوفي شوب **Blanco في غرونوبل، فرنسا**، بهويته الحالية ومنيو فرنسية.

Digital menu for Blanco in Grenoble, with a customer menu, a faithful TV version of the supplied artwork, and Arabic/French administration.

| Route             | Usage                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `/` or `/menu`    | Responsive French customer menu with 52 original products, category filters, search and temporary photography                       |
| `/tv`             | Original vector menu, portrait/landscape selection, local rotation controls, optional center advertisements and seasonal effects    |
| `/admin`          | Arabic/French product and price editing, image uploads, categories, appearance, TV settings, ad scheduling, backups and publication |
| `/fidelite`       | French Blanco Club signup, private loyalty card, stamps, rewards and home screen installation                                       |
| `/admin/fidelite` | Protected loyalty cashier, QR scanning, customer search, account recovery, program settings and staff access                        |

See [the French loyalty guide](docs/FIDELITE.md) for the cashier workflow, recovery, rules, privacy and installation.

**React + TypeScript + Vite · Supabase Auth / Postgres / Realtime / Storage · Vercel**

## Run

Node.js 24 recommended.

```sh
npm ci
npm run dev
```

Without environment variables, the original menu works and administration is a clearly marked **draft preview**. Saving to other screens and authenticated administration require Supabase configuration. Nothing is silently published or saved in preview mode.

Follow [the Arabic/French setup guide](docs/SETUP.md) to configure Supabase, create the sole administrator and deploy to Vercel. No secret backend key is required in this app.

## TV behavior

Default: **portrait**, rotation **0°**, original artwork, no seasonal animation and no advertisements until enabled. Settings on the TV page can override orientation and rotation for that device alone. Horizontal mode contains the original menu with side margins. Artwork is never stretched.

Advertisements display an available selected product in the center, with a default duration of **5 seconds every 60 seconds**. Both values and the product selection are editable. Multiple products rotate through the schedule.

Eight TV category regions follow the supplied PDF. Product changes reflow within their original region; a different TV template or extra regions are future design work. Browser fullscreen, wake lock and physical screen rotation must be verified on the actual Google TV.

## Data and access

- All 52 initial names and prices are transcribed from the supplied PDF, including asterisks.
- Product photos are temporary illustrations shared by category; replace them from the administration.
- Anonymous visitors can read the published menu. Only a user explicitly added to `menu_admins` can publish or upload photos.
- Realtime updates have a 30-second polling fallback. Optimistic revision checking prevents stale browser sessions from overwriting newer changes.
- Export/import JSON backups include menu data and image URLs, not binary image files.
- Last received data is cached on the device. An already-open page can survive a temporary outage; full offline reload is not guaranteed.

## Checks

```sh
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

The database tests run the schema and seed in embedded PostgreSQL (PGlite), checking anonymous access, owner permissions, unauthorized writes, image policy isolation and concurrent publication. Browser tests cover mobile filtering, editing drafts, advertisement previews and timing, TV artwork, orientation persistence and product reflow. No live Supabase project or Vercel deployment is provisioned by these tests.

On a local machine with a system Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; CI uses Playwright’s installed browser. See [asset sources](docs/ASSETS.md).

## Launch video and /brag

Project-scoped [brag](https://github.com/latent-spaces/brag) is installed in
[.agents/skills/brag/SKILL.md](.agents/skills/brag/SKILL.md), with the four local
Hyperframes supporting skills. In a skill-aware coding agent opened on this
repository, invoke `/brag` for a new video. Upstream version and rights are
recorded in `.agents/skills/brag/INSTALLATION.md`.

The first French customer-facing vertical launch film is in `brag-output/`:
`brag.mp4`, `brag.jpg`, storyboard, share caption, asset credits, and editable
Hyperframes composition. It uses public menu/signup screens, no real customer
accounts. Generated cup artwork and the existing sandwich illustration are
advertising visuals; see `brag-output/ASSETS.md`.

```sh
cd brag-output/composition
npm run check
npm run dev
npm run render -- --quality delivery --output ../brag.mp4
```

Node 22+, Chromium and FFmpeg are required. The video CLI is pinned to 0.8.192.
The MP4 includes a music credit; preserve the credit when sharing or changing it.

A second project-scoped skill, [hyperframes-motion-reel](https://github.com/Sunwood-ai-labs/hyperframes-motion-reel-skill), is installed in `.agents/skills/hyperframes-motion-reel/`. The25-second French customer marketing film is in `marketing-reel/`, with original code-generated music,60fps editable composition, pastry illustration and source credits. It preserves the first film.
