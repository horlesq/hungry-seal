# Architecture

## Stack
- **Phaser 4.2.1** (no physics plugin, see Physics below), **TypeScript 6** (strict), **Vite 8**.
- No React/other UI framework. HUD/menus are Phaser scenes/containers.
- Package manager: npm. Lint/format: ESLint 10 (flat config) + Prettier. Tests: Vitest. Browser playtest: playwright-core driving the locally installed Chrome.
- Deploy target: static build (`vite build` -> `dist/`, relative `base: './'`), suitable for itch.io / Netlify / GitHub Pages.

> Verify all Phaser APIs against the installed Phaser 4 version: grep `node_modules/phaser/types/phaser.d.ts`. Do not copy Phaser 3 snippets blindly.

## Folder layout
Files marked (planned) don't exist yet.
```
hungry-seal/
  CLAUDE.md
  docs/                 design, architecture, roadmap, assets notes
  public/
    favicon.svg
    assets/             (planned) images, atlases, audio, fonts (served as-is)
  scripts/
    playtest.mjs        headless browser smoke playtest (npm run playtest)
    balance-bot.mjs     bot plays a run and logs hunger/score/stage (npm run balance)
  src/
    main.ts             Phaser.Game bootstrap; exposes window.__PHASER_GAME__ in dev
    config/
      game.ts           Phaser config, scale, physics
      layout.ts         GAME_WIDTH/HEIGHT, touch UI layout, UI font
      keys.ts           scene keys, registry keys
      balance.ts        movement, camera, input, hunger, growth, feeding, spawn, effects tuning
      zones.ts          WORLD bounds (surface, floor), depth zones + colors, zoneBand()
      assets.ts         asset manifest (keys -> optional urls)
      creatures.ts      creature definitions (tier, speeds, nutrition, behaviors, zones, school)
      upgrades.ts       (planned) upgrade definitions and cost curves
    scenes/
      BootScene.ts      reads ?debug, starts Preload
      PreloadScene.ts   load manifest, progress bar, generate missing placeholders
      MenuScene.ts      title screen (placeholder until Phase 4)
      GameScene.ts      the run
      HudScene.ts       overlay UI running parallel to GameScene
      GameOverScene.ts  results overlay launched over the still-running GameScene
      ShopScene.ts      (planned)
    entities/
      sealMotion.ts     PURE seal movement model (swim, surface, air, boost) + tests
      Seal.ts           sprite; applies sealMotion, growth stage scaling, mouth circle, visual feel
      creatureAI.ts     PURE creature behaviors (wander, drift, flee, school, band keeping) + tests
      Creature.ts       pooled prey sprite driven by a CreatureDef; School = follow-the-leader group
      Coin.ts           (planned)
    systems/
      InputController.ts   unifies mouse/touch/keyboard -> steer vector + boost
      WorldBackground.ts   parallax, depth gradient, light rays, marine snow, water line
      Effects.ts           splashes, bubbles, chomp sparks, growth burst, pooled floating text
      PlaceholderArt.ts    Canvas 2D placeholder textures under final asset keys
      Spawner.ts           camera-relative, zone-weighted, pooled creature spawning/despawning
      HungerSystem.ts      PURE hunger drain/feed/starve (tested in rules.test.ts)
      GrowthSystem.ts      PURE growth points -> stages (tested in rules.test.ts)
      feeding.ts           PURE bite rule (canEat) + circle overlap
      ComboSystem.ts, FrenzySystem.ts, UpgradeSystem.ts, AudioManager.ts  (planned)
    services/
      EventBus.ts          typed events between scenes/systems
      SaveService.ts       (planned) localStorage wrapper, versioned schema
    ui/                 (planned) reusable UI widgets (bars, buttons, panels)
    utils/
      math.ts           clamp, lerp, angle helpers, frame-rate independent damp (+ tests)
      rng.ts            seeded mulberry32 RNG (+ tests)
  index.html
  vite.config.ts        also holds the Vitest config
  eslint.config.js
  tsconfig.json
  package.json
```

## Scenes
- **Boot -> Preload -> Menu -> Game (+Hud in parallel) -> GameOver overlay -> Game (retry) / Menu**
- GameScene owns world simulation; HudScene subscribes to events (`run:hunger` every frame; `run:score`, `run:growth` on change and on the first frame; `run:over`; `seal:boost`; debug) via EventBus and never reads game objects directly. GameScene launches Hud on create and stops Hud + GameOver on shutdown. ESC returns to the menu (until a pause menu exists).
- Game over: GameScene marks itself dead, plays the death tween, then launches GameOverScene on top while the world keeps animating. Retry = `scene.start(Game)` from the overlay (restarts the running GameScene). Scene order in `main.ts` sets draw order (GameOver above Hud above Game).
- HUD can't receive events emitted during GameScene.create (it isn't created yet), so GameScene sets `hudDirty` and publishes the full state on its first update.
- EventBus subscribers pass their unsubscribe functions to `subscribeForScene(scene, [...])` so listeners are removed on scene shutdown (scenes restart cleanly).

## Key design rules
- **Data-driven:** creatures, upgrades, zones are plain config objects. Adding a creature = add a config entry + asset key; no new class unless a new behavior is needed.
- **Pure core logic:** movement (and later hunger, growth, combo, upgrade math) lives in Phaser-free modules that take state + input + params + dt and are unit-tested. Phaser classes are thin adapters.
- **Behaviors are composable:** a creature config lists behaviors (`['wander','flee']`); behavior modules are small functions/classes operating on the creature.
- **Pooling:** use Phaser groups with `maxSize` and reuse; never create/destroy per-frame. Particle emitters always set `maxParticles`.
- **Spawning is camera-relative:** spawn just outside the view ahead of/around the seal by zone; despawn far behind. World is not pre-generated.
- **Stats pipeline:** base stats (balance.ts) + upgrade levels + growth stage + frenzy modifiers = final stats, computed in one place (`Seal.stats`).
- **Fixed feel constants** live in `balance.ts`; nothing tunable is hardcoded in entities.
- **Save schema is versioned** (`version` field, migration function) so saves survive updates.
- **Input abstraction:** game code reads `InputController.steer` (length 0..1) and `.boost`, never raw pointer/keys.
- **Assets:** code only uses keys from `TextureKeys`. A manifest entry without a `url` (or that fails to load) gets a generated placeholder under the same key.

## World and background
- World is endless horizontally, bounded vertically: sky `0..surfaceY(640)`, water to `floorY(6400)`, world bottom `6560`. Camera bounds `x: ±1e7`.
- Background layers are pinned horizontally (`scrollFactorX = 0`) and scroll their tile texture by `camera.scrollX * factor`, so they repeat forever. Vertical parallax uses `scrollFactorY`.
- The depth gradient is a generated 4x2048 canvas texture stretched over the world height, built from the zone colors in `zones.ts`.
- Marine snow layers are full-screen TileSprites clipped to below the water line every frame.

## Rendering / scale
- Base design resolution: 1280x720 (landscape), `Scale.FIT` + `autoCenter`. Wide phones get side bars for now (Phase 9 item).
- Pixel-art off; smooth textures. Use texture atlases for final art to cut draw calls.
- Target 60 FPS on mid-range phones; profile in Phase 9.

## Physics and time
- **No physics plugin** (removed in Phase 2). Every mover runs its own kinematic model (`sealMotion`, `creatureAI`) integrated with frame dt, and contacts are circle-vs-circle checks (`systems/feeding.ts`). Reasons: all motion is custom anyway, ≤ ~120 movers makes O(n) checks trivially cheap, the checks are unit-testable, and it avoids Arcade body/scale issues (the roll flip squashed the seal's body). Re-add Arcade only if a feature needs real collision response.
- Eating uses the seal's **mouth circle** (`Seal.mouthPosition()` / `mouthRadius`, scales with growth) against each creature's `def.radius`.
- Gravity only above the surface line (handled in `sealMotion`).
- GameScene clamps dt to 50 ms. Note Phaser's TimeStep also clamps delta to 16.7 ms for the first 120 frames after (re)focus (`fps.panicMax`), so very slow devices run in slow motion briefly at start.
- Debug mode draws hit circles (yellow = mouth, green = edible, red = too big) from GameScene.

## Creatures and spawning
- A creature = `CreatureDef` (data) + pooled `Creature` sprite + `CreatureMotion` (pure state). Behaviors are flags derived from `def.behaviors`; priority flee > follow school leader > wander/drift, then depth-band keeping and a hard clamp to the water.
- Prey flee only from a seal that can eat them (`canEat(stage, tier)`); bumping startles them regardless.
- Schools: `School.members[0]` is the leader; members steer toward leader + a fixed slot offset. When the leader is eaten the next member leads.
- Spawner keeps ~`SPAWN.targetAlive` creatures, spawning just off-screen (70% ahead of the seal) with the zone at the spawn point choosing a weighted creature, and recycles creatures > `despawnDistance` from the camera centre. Pooled objects are reused: code that holds a creature reference across frames must also check it wasn't respawned (e.g. compare its `motion` object).

## Testing / verification
- `npm run check` = typecheck + lint + unit tests + playtest. Run it before calling a phase done.
- Unit tests (Vitest, `src/**/*.test.ts`, Node environment) for pure logic: movement, math, later hunger, growth thresholds, combo timing, upgrade cost curves, save migration.
- `npm run playtest` boots the game via Vite in headless Chrome (GPU via ANGLE D3D11 on Windows; `PLAYTEST_GL=swiftshader` for software), drives keyboard/mouse/multi-touch, asserts on live state through `window.__PHASER_GAME__`, fails on console errors or HTTP errors, and writes screenshots to `.playtest/` (gitignored). Extend it with checks for every new mechanic.
- `npm run balance -- [human|perfect] [seconds]` runs a bot that chases prey with the mouse and logs hunger/score/stage every 5 s. Use after changing tuning; reference numbers are in the script header and ROADMAP.
- Manual play on a real phone over LAN: `npm run dev:host`, open the printed network URL.

## Scripts
`npm run dev` | `dev:host` | `build` | `preview` | `typecheck` | `lint` | `format` | `format:check` | `test` | `test:watch` | `playtest` | `balance` | `check`
