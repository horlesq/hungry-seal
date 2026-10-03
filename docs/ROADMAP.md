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

## Phase 4 — PLAYABLE DEMO (vertical slice) — [~] in progress
Goal: a shareable build that shows the whole game concept in ~5-10 minutes.
- [x] Resolution: native-resolution canvas, no letterbox bars on any aspect ratio, 2x placeholder art, crisp text (user-reported issue)
- [x] Depth zones with distinct spawn tables; zone banner ("OPEN OCEAN — Sardines, squid, turtles... and sharks") on entering each zone. Distinct zone *visuals* beyond the gradient → art pass.
- [x] 8 creatures: minnow, shrimp, sardine, squid (jets), penguin (near surface), turtle (slow, big), seabird (flies, leap to catch) + shark. Crab deferred to Phase 5 (needs a reef floor).
- [x] Boost (stamina) + Frenzy meter and mode (fast, invulnerable, eats anything incl. sharks, x2 score, coin magnet, smashes hazards)
- [x] Shop scene with 4 upgrades (Flippers speed, Big Belly max hunger, Blubber hunger drain, Turbo Tail boost), 5 levels each, costs 60/150/300/550/900; save v2 with migration
- [x] Menu with Play / Shop / Sound toggle; results screen with Swim again / Shop / Menu buttons
- [x] Audio: synthesized SFX (chomp, coin, splash, hurt, zap, explosion, boost, grow, frenzy, shark alert, UI) + procedural music loop; mute persists
- [x] First-run onboarding hints (move, eat, boost, danger, grow, shark)
- [ ] Free/generated art pass v1 on seal + main creatures + UI (or clean placeholders) — waiting on assets (see ASSETS.md)
- [x] Deployed to a public URL for testers: https://hungry-seal.horly.dev/ (Vercel, deploys `main`). GitHub Actions (`.github/workflows/ci.yml`) typechecks, lints, unit-tests and builds every push/PR
**Exit:** a stranger can open the link, understand it, play several runs, buy upgrades, and want another run.

## Phase 5 — Content expansion — [~] in progress
Goal: enough variety for a full game.
- [x] Deep + Abyss zones: darkness that deepens with depth (light circle around the seal), glowing creatures/hazards/pickups visible through it; zone banners updated
- [x] Creature roster: + pufferfish (puffs up, stings if eaten puffed), crab (walks the abyss seabed), lanternfish (glowing deep food); predators + orca (tier 6: always a threat, only edible in a frenzy, from 3 min) and anglerfish (deep/abyss ambusher with a glowing lure). Penguin/turtle done in Phase 4.
- [~] Growth stages 1-5: scale, speed, bite tier, and camera zoom-out per stage done; distinct seal visuals per stage → art pass
- [x] All 7 upgrades (+ Big Jaws growth, Coin Whiskers magnet, Feeding Frenzy charge); two-row shop
- [x] Treasure chests on the seabed (coin burst + 150) and floating magnet orbs (12 s long-range coin magnet); frenzy remains the power-up
- [x] Predator variety via per-predator spawn rules (schedule or home zones) and AI params (shark chaser, orca late hunter, anglerfish ambusher)
- [x] Balance pass: pufferfish puff for 2 s then need 2.5 s to recover (a window to eat one safely); spawner guarantees food near the view (SPAWN.minFood); hunger 2.1/s ramping +100% over 360 s. The balance bot's aim was broken by the Phase 5 camera zoom (it aimed off target from size 2, which made Phase 5 look far harder than it is); fixed. Human bot after the fix: 2:26, 2:53, 4:10, 4:40 (Phase 4 code with the same bot: 1:01-4:45, median ~3:30). Take more samples when tuning next.
**Exit:** a run has real progression and variety from start to abyss.

Notes carried forward:
- Reef floor (crabs in the shallows, reef decoration) still missing: the only seabed is at the abyss.
- `spawnAt` things far from the camera are recycled by the despawn check on the next frame (by design); scripted events must spawn near the view.

## UI/UX refresh (between Phase 5 and 6) — [x] done
Installed the `frontend-design` and `game-ui-ux` skills and rebuilt every screen on a small design system (`src/ui/`).
- [x] Design tokens (palette, Baloo 2 type scale, panels), chunky pressable buttons with variants, icons painted in code
- [x] Title: ice-floe wordmark that gets bitten, seal watching the pointer, coin balance, sound + fullscreen buttons, upgrade badge
- [x] Upgrades screen: two-column rows with icons, level segments, gold buy buttons showing price + next effect, "Need N more"
- [x] HUD: status panel (hunger, size segments, boost stamina bar on desktop too, frenzy), score/coins/magnet chip, pause button
- [x] Results: score count-up, new-best badge, six stats, Swim again / Upgrades / Menu
- [x] Pause menu (Esc / P / button / auto on tab or window blur): Resume, Restart run, Quit to menu, sound
- [x] Keyboard focus navigation on every screen, safe-area insets for notches, reduced-motion support
- [x] Playtest finds buttons by name; pause, focus and touch-pause checks (100 checks)

## Phase 6 — Meta progression and retention
- [x] Skins (cosmetic): 7 seal species from one parameterized painter (`systems/sealArt.ts`), Skins screen with preview, buy with coins, equip; save v3
- [x] Missions: 3 rotating goals from a pool of 22 (run and total scope), title-screen panel, mid-run toast, paid at run end (coins, some gems)
- [x] Gems (rare currency): chests (30%), harder missions, achievements; two premium gem skins (Pirate Seal, Golden Seal)
- [x] Stats page (top runs, lifetime totals, favorite snack...) and 12 achievements with gem rewards
- [x] Local top-5 leaderboard (on the Stats page; results show a new entry's rank)
- [x] Save v4 with migration from v1-v3 and corrupt-data cleanup, unit tested; playtest progress section
**Exit:** reasons to come back between runs: missions to finish, gems to save for, records to beat.

## Phase 7 — Balance and systems hardening
- [x] Tune with playtest data: measured fresh and upgraded runs with the balance bot (now takes an upgrade level); the Phase 5 tuning (hunger 2.1/s ramping over 360 s, food guarantee, pufferfish rhythm) meets the targets, no further changes needed
- [x] Difficulty curve pass: fresh median ~3:20 for a good player (1:49-10:00+), upgraded (level 3) 7:41-10:00+; numbers in GAME_DESIGN.md
- [x] Unit tests cover the core rules (movement, AI, hunger, growth, combo, frenzy, upgrades, progression, saves, joystick, viewport, spawning: 116 tests); release checklist in docs/REGRESSION.md
- [x] Pooling audit (creatures, hazards, predators, coins, float texts, rings, glows all pooled; only rare pickups are created/destroyed) and `npm run soak`: 4-minute run through every zone + 20 restarts with flat heap (~76 MB after GC), bounded objects, no listener growth, 165 fps
**Exit (Feature-complete beta):** everything in v1 scope present and balanced.

## Phase 8 — Art, audio, and polish
- [~] Final consistent art style pass (Hungry Shark-like chunky cartoon): seal, creatures, backgrounds, UI, icons
  - [x] Blender pipeline: `tools/blender/bridge.mjs` drives Blender over MCP; toon shader + inverted-hull outline
  - [x] Harbor seal modeled in Blender (`tools/blender/seal.py`), rendered as an animated sprite sheet (swim, bite, turn)
  - [ ] Other skins, creatures and predators in the same style
- [~] Animations: swim cycle, bite, hurt, death, creature idles (seal swim/bite/turn done)
- [ ] Lighting/effects: light rays, caustics, depth fog, splash, bubble trails
- [ ] Full SFX set and 2-3 music tracks per zone/menu, volume settings
- [~] Menu/shop/game-over UI polish, transitions (done in the UI/UX refresh); tutorial refinement
- [ ] Accessibility: reduced motion honoured by UI intros (done); in-game shake toggle, colorblind-safe warnings

## Phase 9 — Performance, mobile, and release
- [ ] Mobile perf profiling (target 60 FPS mid-range); texture atlases, resolution scaling
- [~] Touch UX refinement, orientation handling: floating joystick, portrait layouts for every screen, phone camera zoom, fullscreen button and safe areas done; remaining: real-device testing
- [ ] Browser matrix test (Chrome, Safari iOS, Firefox, Edge)
- [ ] Bundle size + load time optimization, loading screen
- [ ] PWA/offline (optional), analytics (optional, privacy-respecting)
- [ ] Release build, versioning, changelog, store page assets (itch.io)
**Exit:** 1.0 released.

---

## Backlog / post-1.0 ideas
Pets/companions, daily challenges, more zones (arctic, sunken city), boss encounters, cloud saves, leaderboards, localization.
