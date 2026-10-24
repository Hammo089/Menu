# Blanco —25-second French marketing reel

Vertical1080×1920,60fps,120BPM,25seconds. Coffee, matcha and Arabic sweets, with airborne cups and a dedicated pastry shot. No narration. Original synthesized music: no music attribution or recurring service is required for this score.

The original22-second launch film is preserved under brag-output/.

- blanco-marketing-25s.mp4: final customer-facing export.
- poster.jpg: selected settled frame.
- share-copy.txt: French caption.
- ASSETS.md: generated food/packaging illustrations and source rights.
- composition/: editable Hyperframes source, font/visual assets, original score, build scripts.
- TIMELINE.md: beat/second/frame map.

From composition/: `node scripts/generate-audio.mjs`, `node scripts/build.mjs`, `npm run check`, `npm run dev`.
Render on thisLinuxworkspace: `HYPERFRAMES_BROWSER_PATH=/usr/bin/chromium npm run render -- --fps 60 --quality delivery --workers 2 --output ../blanco-marketing-25s.mp4`.

The source skill uses historical split Hyperframes skill names. INSTALLATION.md maps these to the current installed Hyperframes core, motion, look, CLI and audio references.

Optional desktop editing: [HyperFrames desktop app](https://hyperframes.dev/studio/download?os=linux). The source remains editable in HTML/GSAP without the app.
