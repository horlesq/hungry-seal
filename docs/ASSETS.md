# Assets

## Art direction
Close to Hungry Shark Evolution: bright saturated colors, chunky rounded shapes, thick soft outlines/shading, expressive faces, exaggerated size contrast between prey and predators. Cute-but-cheeky seal; lighthearted (no gore; chomp = stars, bubbles, bits and score pops).

- Palette by zone: Surface (turquoise, sunny), Reef (teal/coral/pink), Ocean (deep blue), Deep (indigo/purple, glowing accents), Abyss (near-black with bioluminescent cyan/magenta).
- Readability first: prey should look edible/friendly, hazards use warning colors (red/yellow, spikes), predators have sharp silhouettes.
- Consistent light direction (top), subtle rim lights, depth fog to separate layers.

## Sources
- **Free packs:** Kenney.nl (CC0: UI, fish pack, particles, audio), OpenGameArt (check each license), itch.io CC0 packs.
- **Generated:** AI-generated sprites for seal and signature creatures. Requires cleanup: transparent background, consistent scale/style, separated parts if animating.
- **Audio:** Kenney audio, freesound.org (CC0/CC-BY), generated music. Keep attribution list.
- Record every external asset in `public/assets/CREDITS.md` (source, author, license, URL).
- **Font:** Baloo 2 by Ek Type (SIL Open Font License 1.1), npm `@fontsource-variable/baloo-2`, bundled by Vite (no Google Fonts request).

## UI graphics
Interface art (wordmark, icons, upgrade symbols, gem, trophy/star/lock/check badges, crumbs) is painted in code in `src/ui/uiTextures.ts` and is part of the UI design, not a placeholder. Icons are white so they can be tinted, except the colored gem (`ui-gem`). Replacing them with drawn art later means adding manifest entries under the same keys and skipping the painter when the texture exists.

## Blender pipeline
Characters are modeled by Python scripts in `tools/blender/` and rendered side-on with an orthographic camera, toon shading (two soft tones, no cast shadows) and an inverted-hull outline, so they match the chunky outlined style.
- Open Blender (5.x) with the Blender Lab MCP add-on running (localhost:9876), and have `uv` installed.
- Scripts: `toonkit.py` (shared: toon materials, blob bodies, fins, eyes, vertex posing, sheet packing), `seal.py` (all 9 skins as style entries on one seal model), `creatures.py` (prey, predators, jellyfish; one builder each), `decor.py` (map decorations and pickups; plants sway in 4 frames, big pieces render at 2x to stay under 2048 px). One Blender unit = 28 design units for every sprite, so outlines come out equally thick in game.
- `node tools/blender/bridge.mjs exec tools/blender/seal.py` renders every skin to `public/assets/seal-sheet.png` / `seal-<skin>-sheet.png` (528x264 frames = 176x88 design units at `resolution: 3`, 3 columns); `creatures.py` writes `<texture key>-sheet.png` (the placeholder's design size x3 per frame, 2 columns, 4 frames for prey and the jellyfish, 6 for predators). Add `ONLY=walrus,shark` to render a subset (about 6 s per sprite). Headless alternative: `blender -b -P tools/blender/seal.py` from the repo root.
- Manifest entries use `sheet()` / `sealSheet()` in `src/config/assets.ts`; creatures loop their frames (`ANIM_FPS`, `entities/sheetAnim.ts`). Keep a creature's frame size equal to its placeholder so hit radii and glow offsets (e.g. the anglerfish lure at (58, -44)) still line up.
- Sheet layout (`SEAL_SHEET` in `src/config/assets.ts`, must match the script): frames 0-7 swim cycle, 8-10 bite (mouth opening), 11-13 turn (yaw 22.5/45/67.5 degrees toward the camera; the game mirrors them for the second half of a turn). `Seal.ts` picks frames from speed, bites and facing; single-image skins keep the squash/wiggle effects.
- Posing bends vertices from their rest positions in Python (tail wave, flipper paddle, jaw drop), no armature, so the script stays one file.
- Face details (eye, nose, whiskers) are placed by ray-casting onto the body, so body proportions can change without re-placing them.
- Outline and line widths are sized for the in-game display (~130 px wide); judge the sprite in a playtest screenshot, not at full render size.
- The add-on runs whatever code it gets without guards, so only run scripts from this repo.

## Technical rules
- Everything loaded via the manifest in `src/config/assets.ts` (key -> path -> type). Code uses keys only.
- Sprites: PNG, power-of-two atlases preferred, packed with a texture atlas tool (free-tex-packer or similar). Target atlas <= 2048x2048 for mobile.
- Base creature art authored at ~2x display size for crisp scaling, declared with `resolution: 2` in the manifest (the game renders at native resolution and zooms cameras, so 1x art looks soft on big/hi-DPI screens). Code keeps display sizes in design units via `textureScale()`. Seal at multiple growth stages can be one sprite scaled plus per-stage tweaks.
- Animation: frame-based swim/bite cycles (4-8 frames) or simple tween-based squash/stretch for prey.
- Audio: OGG + MP3 fallback, short SFX < 1s, music loops seamless; normalize levels.
- Placeholders: Phase 0 includes a generator producing colored shape textures under the same keys as final assets, so swapping is a manifest/file change only.

## Asset checklist by phase
- **P0-P3:** placeholders for seal, 4 prey, jellyfish, mine, shark, coin, bubbles, water/background gradient.
- **P4 (demo):** art v1 for seal, ~8 creatures, coins, HUD bars, buttons; SFX (bite, splash, coin, hurt, boost, click); one music loop.
- **P5:** full creature set, zone backgrounds/parallax layers, chests, power-ups.
- **P6:** skins, mission/achievement icons, gems.
- **P8 (done):** everything in game is Blender-rendered except the UI (painted in code), the background layers (clouds, light rays, far ridges, snow: code-painted) and the terrain (drawn at runtime from the map's distance field). Audio is synthesized in code (`audio/synth.ts`).

## Seal skins
Each skin is its own texture key (`seal` = harbor, `seal-arctic`, `seal-sealion`, `seal-tropical`, `seal-leopard`, `seal-walrus`, `seal-elephant`, and the gem skins `seal-pirate`, `seal-golden`), 176x88 design units facing right, all rendered from Blender as animated sheets (see Blender pipeline); `systems/sealArt.ts` only paints fallbacks if a sheet fails to load. Real art must keep the muzzle at the right end (x ~150-165) so the mouth hit circle lines up. Distinct looks per growth stage are still open (art pass).
