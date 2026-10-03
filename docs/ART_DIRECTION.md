# Art direction brief

Following the `create-game-assets` skill: the frame and visual system every asset is checked
against. Pipeline details (Blender scripts, manifest) are in [ASSETS.md](ASSETS.md).

## Game frame

- **Player fantasy:** a chubby, fearless seal eating its way up the food chain in a big cartoon ocean.
- **Core verbs:** swim, leap, bite, dodge, explore (caves, wrecks, pearls).
- **Engine/renderer:** Phaser 4 WebGL, 2D sprites + one GPU terrain shader.
- **Platforms:** desktop and phone browsers (60 FPS target on mid-range phones).
- **Camera:** side view, orthographic; everything faces right, mirrored for left.
- **Native viewport:** 1280x720 design units (720x1280 upright phones); the camera zooms out as the
  seal grows (1.0 -> 0.55).
- **Typical sizes on screen:** prey 40-90 px, seal 106-422 px, predators 130-320 px, terrain
  features 200-2,000 px.

## Visual system

- **Shape language:** chunky, rounded, soft-cornered. Friendly things are round (seal, prey,
  pearls); danger is spiky or toothy (urchins, mines, sharks, eels).
- **Silhouette:** characters keep a thick dark outline (2.1 design units, ink `#1f1a26` family) so
  they read against any water color. Terrain has a slightly thinner ink edge.
- **Value structure:** three bands. Water is the mid value (bright up top, dark deep), terrain is
  darker than the water around it and lit on top, characters are the brightest and most saturated.
- **Palette roles:**
  - water and zones: from the map palette (`config/maps/*`);
  - terrain: warm rock (sand-rim `#c9a87a`, body `#8a6d4f` -> deep `#2c2540`), per-map tints (ice
    blue-white, volcanic brown);
  - accents: buoy orange (main action), gold (coins/treasure), pink-white (pearls), coral red
    (danger), kelp green (calm).
- **Materials:** toon-shaded Blender renders (two soft tones, no cast shadows). Terrain materials
  are tileable top-lit textures (cobbled rock, rippled sand, porous coral stone, cracked ice/basalt)
  shaded in the shader with a bevel (lit top-left), ambient occlusion into the rock, a sand/snow/
  grass cap on upward faces, and depth fog toward the water color.
- **Edges:** characters: inverted-hull outline. Terrain: anti-aliased ink edge + bevel highlight;
  3D rock and coral props sit on the contour to break the smooth silhouette.
- **Light:** key light from the top-left-front, everywhere. Highlights on top faces, shade underneath.
- **Detail density:** high on characters' faces and the play-relevant edge of the terrain; low
  inside big rock masses (AO darkens them so they recede).
- **Motion:** squash-and-stretch lite; swim cycles and sways are smooth loops (4-8 frames).
- **Exclusions:** no photoreal textures, no hard cast shadows, no text baked into art, no outline
  color drift between assets.

## Technical contract

- **Sprites:** PNG with alpha, rendered at 3 px per design unit (`resolution: 3`; 2 for the very
  largest pieces), frames packed in sheets (`<key>-sheet.png`), pivot = frame centre (ground
  decor: bottom-centre; icicles: top-centre). Keep sheets <= 2048 px on a side.
- **Terrain materials:** one 1024x1024 atlas of four 512 px tileable tiles; repeat-tested 3x3.
- **Filtering:** linear, no mipmaps; color space sRGB.
- **Naming:** `public/assets/<texture key>-sheet.png`; keys in `config/assets.ts`.

## Visual target

- Hero target: the West Beach + Coral Gardens stretch of Seal Bay at size 1, judged in a 1280x720
  capture (`.playtest/art-target-*.png`) against the previous canvas-rock look.
- Decision record: the "Visual target" section of ASSETS.md (approved 2026-10-03).
