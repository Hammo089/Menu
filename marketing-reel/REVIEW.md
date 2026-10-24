# Motion reel review

## Creative decision
A French product ad for France, preserving Blanco's actual identity. Five phases: coffee, matcha, Arabic sweets, all three together, then the original logo with Grenoble and the public menu QR. The user explicitly requested sweets in this campaign; none of the old app-demo or sandwich footage is used.

## What was measured
- Hyperframes lint/runtime/layout/contrast/motion/craft gate: zero findings, browser audits enabled, 14 text checks passed.
- Motion sidecar verifies headline entrances and the end-card CTA by their intended times, and the end-card title stays in frame.
- Root target: 25 seconds, 1080×1920, 60fps, 1500frames, beat grid120BPM (50beats).
- Original PCM soundtrack is25seconds, stereo44.1kHz. Final encoded audio will be measured, not subjectively auditioned.

## What was inspected visually
- All five hero-frame snapshots and the phone-width review sheet.
- Original logo crop preserves the actual logo, instead of substituting a new wordmark.
- Cup imagery and pastry are appetizing illustrative cutouts; text is readable and the QR is in the social-safe region.
- The third product zoom inside the trio shot breaks up a static read while the headline holds still.

## Intentional audit annotations
- Masked title wrappers allow overflow only for the intended incoming reveal.
- The logo image allows overflow because the source is a square image cropped to its existing central lockup.
- Trio headline is marked data-hold for its deliberate reading hold. CSS-background product motion is verified in snapshots independently; the classifier otherwise treats this phase as stationary.
- Decorative halo, image crops and crumbs have narrowly scoped layout annotations. No actual text is exempted from contrast auditing.

## Limits
Food and takeaway packaging are generated advertising illustrations, not photographs of actual store stock. Pastry names, prices and availability are not asserted. The weakest production constraint is that this is a 2D cutout animation, not physically simulated liquid footage; the cup paths, masks and transitions provide the movement. The lower part of the trio's platter is decorative outside the principal social-safe copy area. Original score is measured rather than listened to by a human.

## Final export spot-check
Encoded MP4 has H.264 video,1080×1920,60/1fps,1500frames, exact25.000s, and AAC audio. Decoded frames at12.5s and22.5s match the expected pastry shot and original-brand end card. The QR was decoded from the actual22.5s video frame and resolves to the correct public menu. Sound is present: mean -27.4dBFS, peak -9.7dBFS, no clipping; measured, not human-auditioned. Poster selected from the trio shot at17.5s and baked only into frame0; remaining timing and audio preserved.
