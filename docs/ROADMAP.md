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
- Seal physics body is a circle scaled with the sprite; the roll flip squashes it. Phase 2 should use a separate mouth hitbox rather than the sprite body.
- Wide phones get side bars under Scale.FIT; revisit in Phase 9 (or earlier if it bothers testers).
- Only one flat seabed at the abyss floor; shallower reef floors (for crabs) come with zone work in Phase 4/5.

## Phase 2 — Eating loop (core prototype)
Goal: the fundamental "eat to survive" loop works.
- [ ] Creature base class driven by config; behaviors: wander, flee, school
- [ ] Spawner: camera-relative, pooled, tier-1/2 prey in reef/ocean
- [ ] Eat on overlap (tier rule), nutrition, score
- [ ] HungerSystem (drain + eat + death), GrowthSystem (stages, size scale)
- [ ] Minimal HUD (hunger bar, score) in HudScene via EventBus
- [ ] Game over -> restart
**Exit:** you can play a run from full hunger to starvation, eating fish and growing. (Tech prototype)

## Phase 3 — Danger, feedback, and run flow
Goal: the run has stakes and readable feedback.
- [ ] Hazards: jellyfish, sea mine (damage, stun, invulnerability frames)
- [ ] First predator (shark): patrol/notice/chase/bite with telegraph
- [ ] Combo system and score multiplier
- [ ] Coins (pickup, from prey), coin counter in HUD
- [ ] Juice v1: screen shake, chomp particles, floating text, hit-stop, low-hunger vignette
- [ ] GameOver scene with results (score, coins, distance, best)
- [ ] SaveService: coins, best score persisted
**Exit:** runs feel dangerous and rewarding; death and retry loop is smooth.

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
