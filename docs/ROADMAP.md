# Roadmap

Status legend: [ ] todo, [~] in progress, [x] done. Update as work completes.

Milestones: **Phase 0-2 = Tech prototype**, **Phase 3-4 = Playable demo (vertical slice)**, **Phase 5-7 = Feature-complete beta**, **Phase 8-9 = Polished release**.

---

## Phase 0 — Scaffold and tooling ✅ (2026-09-26)
Goal: an empty Phaser 4 game runs in the browser with a clean toolchain.
- [x] Vite 8 + TypeScript 6 (strict) + Phaser 4.2.1 project, folder layout per ARCHITECTURE.md
- [x] Scale config (FIT, 1280x720), Boot/Preload/Menu/Game(+Hud) scenes wired
- [x] ESLint, Prettier, Vitest, npm scripts (`npm run check` runs everything)
- [x] Asset manifest and loader with progress bar
- [x] Placeholder graphics generator (Canvas 2D cartoon seal, bubbles, backgrounds) so no art is needed to start
- [x] `vite --host` works for testing on a phone (`npm run dev:host`)
- [x] Automated browser playtest (`npm run playtest`, headless Chrome, screenshots in `.playtest/`)
**Exit:** `npm run dev` shows a scene with a placeholder seal sprite; build and typecheck pass.

## Phase 1 — Seal movement and world feel ✅ (2026-09-26)
Goal: swimming feels good before anything else exists.
- [x] InputController (mouse follow, touch hold/drag + boost button, WASD/arrows, Space/Shift/click boost)
- [x] Seal: acceleration, drag, turn limit, rotation to velocity, belly-roll flip, swim wiggle, speed stretch
- [x] Water line: ride the surface when slow, breach/leap when fast, gravity only in air, splash
- [x] Camera follow with look-ahead and bounds (sky down to abyss floor)
- [x] Parallax background (clouds, light rays, 2 seabed layers + ground, marine snow), depth color gradient, bubbles
- [x] Debug overlay (fps, pos, depth/zone, speed, stamina, input, particles) toggled by ` or `?debug`
- [x] Boost stamina (drain/regen) implemented early; shown on the touch boost button ring (HUD bar in Phase 4)
**Exit:** swimming and leaping feels smooth on desktop and touch. (Verified by playtest: 21/21 checks, ~165 FPS on GTX 1060.)

Notes carried forward:
- ~~Seal physics body squashes during the roll flip~~ → resolved in Phase 2: Arcade Physics removed; eating uses a dedicated mouth circle.
- Wide phones get side bars under Scale.FIT; revisit in Phase 9 (or earlier if it bothers testers).
- Only one flat seabed at the abyss floor; shallower reef floors (for crabs) come with zone work in Phase 4/5.

## Phase 2 — Eating loop (core prototype) ✅ (2026-09-26)
Goal: the fundamental "eat to survive" loop works.
- [x] Creature sprite driven by config (`config/creatures.ts`); pure behaviors in `creatureAI.ts`: wander, drift, flee, school (+ depth-band keeping)
- [x] Spawner: camera-relative, pooled (Group, max 120), spawns off-screen biased ahead of the seal; minnow + shrimp (tier 1, reef/ocean), sardine schools (tier 2, ocean/deep)
- [x] Eat on mouth-circle contact (tier rule), nutrition, score; too-big prey bumps the seal ("Too big!")
- [x] HungerSystem (drain ramps with time and depth, eat, starve), GrowthSystem (5 stages: size, speed, bite tier)
- [x] HUD: hunger bar (flashes when low), growth meter + size, rolling score
- [x] Game over overlay (score, time, fish eaten, size) -> retry or menu
- [x] Chomp sparks, floating "+score" text, growth burst (pulled forward from Phase 3 juice)
- [x] Balance bot (`npm run balance`) to sanity-check tuning
**Exit:** you can play a run from full hunger to starvation, eating fish and growing. (Tech prototype) — verified: playtest 39/39; human-like bot starves at ~2:00 reaching size 3; perfect bot sustains at size 4.

Notes carried forward:
- ~~Balance is tuned without predators/hazards~~ → retuned in Phase 3.
- Seal grows 0.72 → 1.12 scale over 5 stages with no camera zoom-out. If bigger stages feel cramped, add zoom in Phase 5 (background layers are sized for zoom 1 and must be widened first).
- Deep/abyss have almost no edible food for a small seal (sardines are tier 2, abyss is empty) — intentional pressure for now; Phase 5 fills them.

## Phase 3 — Danger, feedback, and run flow ✅ (2026-09-26)
Goal: the run has stakes and readable feedback.
- [x] Hazards: jellyfish (sting + stun), sea mine (explodes); knockback, invulnerability frames; ramp in from 25 s
- [x] First predator (shark): patrol / notice (0.8 s telegraph: red flash + "!") / chase / bite / recover; flees and is edible once the seal reaches size 5; off-screen warning arrows
- [x] Combo system (x2..x5) with HUD readout and timer bar; hurt breaks it
- [x] Coins: floating clusters + prey drops, magnet pickup, HUD counter
- [x] Juice v1: shake, chomp/zap/explosion particles, floating text, hit-stop, low-hunger + hurt vignette, seal hit flash/blink
- [x] GameOver with results: cause-specific title, score, NEW BEST, coins (+total), distance, deepest, time, fish, size
- [x] SaveService: versioned localStorage save (coins, best score/distance, runs), corrupt/missing storage safe; menu shows best + coins
- [x] `?calm` flag, danger playtest flow (60 checks total), balance bot dodges threats and reports hits/cause
**Exit:** runs feel dangerous and rewarding; death and retry loop is smooth. — Verified by playtest 60/60. Balance (human-like bot, 4 samples): 1:06 / 2:02 / 2:44 / 4:49, median ≈ 2:20, deaths from stings, mines and starving.

Notes carried forward:
- Balance has high variance run to run; always sample the bot several times.
- Sharks live in ocean/deep, so the shallow reef is relatively safe but only has tier-1 food; growth pushes you deeper (intended risk/reward).
- No audio yet (Phase 4). Hit feedback currently relies on visuals only.

## Phase 4 — PLAYABLE DEMO (vertical slice)
Goal: a shareable build that shows the whole game concept in ~5-10 minutes.
- [ ] Two depth zones (Surface+Reef, Open Ocean) with distinct spawn tables and visuals
- [ ] 8-10 creatures total incl. seabird (leap-to-catch), crab, squid
- [ ] Boost (stamina) + Frenzy meter and mode
- [ ] Shop scene with 4 upgrades (speed, max health, hunger resistance, boost) and coin costs
- [ ] Menu with Play/Shop/Settings(mute)
- [ ] Basic audio (bite, splash, coin, music loop) with mute toggle
- [ ] First-30-seconds onboarding hints (controls tooltip)
- [ ] Free/generated art pass v1 on seal + main creatures + UI (or clean placeholders)
- [ ] Deployed to a public URL (itch.io/Netlify) for testers
**Exit:** a stranger can open the link, understand it, play several runs, buy upgrades, and want another run.

## Phase 5 — Content expansion
Goal: enough variety for a full game.
- [ ] Deep + Abyss zones; zone transitions and lighting (darkness, glow creatures)
- [ ] Full creature roster (see GAME_DESIGN), orca, anglerfish, penguin, turtle, pufferfish
- [ ] Growth stages 1-5 with distinct seal visuals/scales and bite tiers
- [ ] All 7 upgrades with cost curves; upgrade level cap and balance
- [ ] Treasure chests, magnet pickups, power-ups
- [ ] Predator AI variety and per-zone difficulty scaling over time
**Exit:** a run has real progression and variety from start to abyss.

## Phase 6 — Meta progression and retention
- [ ] Skins (cosmetic) with shop tab and equip
- [ ] Missions (3 rotating goals) with coin rewards
- [ ] Gems (rare currency) for premium skins
- [ ] Stats page (total eaten, best distance, etc.), achievements (light)
- [ ] Local top-5 leaderboard
- [ ] Save versioning/migration tested

## Phase 7 — Balance and systems hardening
- [ ] Tune hunger drain, spawn rates, prey values, predator damage, upgrade costs with playtest data
- [ ] Difficulty curve pass (first run 2-3 min; upgraded 5+ min)
- [ ] Unit tests for core math; regression checklist
- [ ] Object pooling audit, memory/GC check on long runs
**Exit (Feature-complete beta):** everything in v1 scope present and balanced.

## Phase 8 — Art, audio, and polish
- [ ] Final consistent art style pass (Hungry Shark-like chunky cartoon): seal, creatures, backgrounds, UI, icons
- [ ] Animations: swim cycle, bite, hurt, death, creature idles
- [ ] Lighting/effects: light rays, caustics, depth fog, splash, bubble trails
- [ ] Full SFX set and 2-3 music tracks per zone/menu, volume settings
- [ ] Menu/shop/game-over UI polish, transitions, tutorial refinement
- [ ] Accessibility: reduced motion/shake toggle, colorblind-safe warnings

## Phase 9 — Performance, mobile, and release
- [ ] Mobile perf profiling (target 60 FPS mid-range); texture atlases, resolution scaling
- [ ] Touch UX refinement, orientation handling, fullscreen, safe areas
- [ ] Browser matrix test (Chrome, Safari iOS, Firefox, Edge)
- [ ] Bundle size + load time optimization, loading screen
- [ ] PWA/offline (optional), analytics (optional, privacy-respecting)
- [ ] Release build, versioning, changelog, store page assets (itch.io)
**Exit:** 1.0 released.

---

## Backlog / post-1.0 ideas
Pets/companions, daily challenges, more zones (arctic, sunken city), boss encounters, cloud saves, leaderboards, localization.
