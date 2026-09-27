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
Interface art (wordmark, icons, upgrade symbols, crumbs) is painted in code in `src/ui/uiTextures.ts` and is part of the UI design, not a placeholder. Icons are white so they can be tinted. Replacing them with drawn art later means adding manifest entries under the same keys and skipping the painter when the texture exists.

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
- **P8:** final pass on everything, animation sets, VFX, full audio.
