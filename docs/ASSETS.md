# Assets

- `public/brand/original-menu.pdf`: original menu supplied by the owner.
- `src/data/original-menu.svg`: vector conversion of that PDF. The 104 product name/price text nodes are tagged for live replacement. Original logo, graphics, glyph positions and colors are retained.
- `public/fonts/*`: subset font programs embedded in the supplied PDF. These retain the original artwork’s glyph metrics; characters outside the original subset use browser fallbacks.
- `public/brand/blanco-logo.jpg`: owner-supplied logo.
- `public/brand/original-menu-preview.png`: preview rendered from the original PDF.
- Temporary product photography from Unsplash (downloaded 2026-10-17):
  - Hero: https://unsplash.com/photos/photo-1442512595331-e89e73853f31
  - Coffee: https://images.unsplash.com/photo-1510707577719-ae7c14805e3a
  - Iced coffee: https://images.unsplash.com/photo-1461023058943-07fcbe16d735
  - Matcha: https://images.unsplash.com/photo-1515823064-d6e0c04616a7
  - Sandwich: https://images.unsplash.com/photo-1528735602780-2552fd46c7af
  - Tea: https://images.unsplash.com/photo-1544787219-7f47ccb76574
  - Water: https://images.unsplash.com/photo-1548839140-29a749e1cf4d

Illustrations are not exact product representations. Replace them with Blanco photography in the administration.

Seasonal overlays: `public/effects/autumn-leaf.png` is a generated photorealistic transparent leaf for Blanco. `petal.svg` and `parasol.svg` are original shaded illustrations; winter snow and summer sunlight are rendered with CSS gradients. No emoji are used in the TV seasonal overlays.

`public/effects/natural-seasons.png` is an original generated transparent photographic sprite sheet: spring blossoms (top left), a snow crystal (top right), ice cubes (bottom left), and a fabric parasol (bottom right). CSS displays individual quadrants without duplicating or modifying the source file. The winter coffee vignette uses the existing temporary coffee photograph.

Weather data: Norwegian Meteorological Institute / MET Norway, [Locationforecast](https://api.met.no/weatherapi/locationforecast/2.0/documentation), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution is accessible in appearance settings and TV device settings. Data is used to select a visual mood, not to claim snow is falling outside.

`public/effects/festive-scenes.png` is an original generated transparent photographic sprite sheet for the café’s holiday scenes: Santa figurine (top left), decorated Christmas tree (top right), illuminated pumpkin (bottom left), and decorative bat (bottom right). CSS selects quadrants without modifying the source image.
