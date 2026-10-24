# Blanco — customer launch film

French • 22 seconds • vertical 1080 × 1920 • 30 fps • music, no voice.

- `brag.mp4`: final export, with the best poster baked into its first frame.
- `brag.jpg`: matching thumbnail.
- `share-copy.txt`: ready-to-use French caption with music credit.
- `brag-plan.md`, `composition-brief.md`: creative decisions and verified product claims.
- `ASSETS.md`: provenance, illustrative imagery, and attribution.
- `composition/`: editable Hyperframes scenes, fonts, imagery and audio.

From `composition/`, run `npm run dev` for preview or `npm run check` for validation.
Render: `npm run render -- --quality delivery --output ../brag.mp4`.
On Linux, if browser auto-install is unavailable, prefix the command with
`HYPERFRAMES_BROWSER_PATH=/usr/bin/chromium` (use your installed browser path).

The generated cup asset is shared by two intentionally separate, cropped layers,
so Hyperframes reports a duplicate-image lint warning. This is intentional; the
coffee and matcha animate independently. No customer account or private QR is used.

The published menu had no dessert category at capture time. This film includes
only the confirmed Syrian coffee/tea and Halloumi/Labneh/Hoummous names, alongside
coffee and matcha. Add named desserts once they are present in the menu.

Do not remove the on-screen or caption music attribution when sharing.
