# Architecture

## Stack
- **Phaser 4.2.1** (no physics plugin, see Physics below), **TypeScript 6** (strict), **Vite 8**.
- No React/other UI framework. HUD/menus are Phaser scenes/containers.
- Package manager: npm. Lint/format: ESLint 10 (flat config) + Prettier. Tests: Vitest. Browser playtest: playwright-core driving the locally installed Chrome.
- Deploy target: static build (`vite build` -> `dist/`, relative `base: './'`). Live at https://hungry-seal.horly.dev/ (Vercel, from `main`). GitHub Actions (`.github/workflows/ci.yml`) only runs checks.

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
    main.ts             loads the UI font, then Phaser.Game bootstrap, window resize -> applyViewport;
                        window.__PHASER_GAME__ in dev
    config/
      game.ts           Phaser config, scale, physics
      layout.ts         edge-anchored touch UI (boostButtonCenter, pauseButtonCenter, safe-area aware), UI font
      keys.ts           scene keys, registry keys
      balance.ts        movement, camera, input, hunger, growth, feeding, spawn, effects tuning
      zones.ts          WORLD bounds (surface, floor), depth zones + colors, zoneBand()
      assets.ts         asset manifest (keys -> optional urls)
      creatures.ts      creature definitions (tier, speeds, nutrition, behaviors, zones, school)
      hazards.ts        hazard definitions (jellyfish, mine: damage, knockback, stun, drift)
      predators.ts      predator definitions (tier, speeds, radii, timings, rewards, spawn rule, glow)
      depths.ts         shared draw depths (darkness overlay, glows)
      upgrades.ts       upgrade definitions (name, costs, effect text) and per-level effects
    scenes/
      BootScene.ts      reads ?debug, starts Preload
      PreloadScene.ts   load manifest, progress bar, generate missing placeholders + UI textures
      MenuScene.ts      title: bitten wordmark intro, Play / Upgrades, coins, sound + fullscreen, seal watching the pointer
      GameScene.ts      the run (pauses itself on Esc / P / HUD button / tab or window blur)
      HudScene.ts       overlay UI running parallel to GameScene (status panel, score, pause button)
      GameOverScene.ts  results overlay launched over the still-running GameScene (score count-up, stats)
      ShopScene.ts      "Upgrades": two columns of upgrade rows, gold buy buttons, Back / Play
      PauseScene.ts     pause overlay: Resume / Restart run / Quit to menu, sound toggle
    ui/
      theme.ts          design tokens: palette (COLORS/CSS), type scale + uiText(), drawPanel, EDGE,
                        reducedMotion(), formatNumber()
      Button.ts         chunky pressable button: variants primary/gold/secondary/quiet, round icon
                        buttons, icon + label + caption, badge, keyboard focus ring
      FocusNav.ts       keyboard navigation (arrows spatial, Tab cycle, Enter/Space press)
      uiTextures.ts     Canvas 2D UI textures: ice-floe wordmark (+ bitten), icons, upgrade symbols
      widgets.ts        ocean backdrop, CoinPill, drawSegments, drawBar
    audio/
      synth.ts          PURE offline synth: effects + seamless stereo music loop (+ tests)
      sounds.ts         SoundKeys + tone recipes for every effect
    entities/
      sealMotion.ts     PURE seal movement model (swim, surface, air, boost) + tests
      Seal.ts           sprite; applies sealMotion, growth stage scaling, mouth circle, visual feel
      creatureAI.ts     PURE creature behaviors (wander, drift, flee, school, band keeping) + tests
      Creature.ts       pooled prey sprite driven by a CreatureDef; School = follow-the-leader group
      predatorAI.ts     PURE predator state machine (patrol/notice/chase/recover/flee) + tests
      Predator.ts       pooled predator sprite, mouth circle, telegraph tint + "!"
      Hazard.ts         pooled hazard sprite (drift, bob, pulse/blink)
      Coin.ts           pooled coin (float or pop-out, magnet, spin, expiry blink)
    systems/
      InputController.ts   unifies mouse/touch/keyboard -> steer vector + boost; touch = floating joystick
      joystick.ts          PURE floating-joystick math (deadzone, base follows the finger) (+ tests)
      WorldBackground.ts   parallax, depth gradient, light rays, marine snow, water line
      Effects.ts           splashes, bubbles, chomp sparks, growth burst, pooled floating text
      PlaceholderArt.ts    Canvas 2D placeholder textures under final asset keys
      Spawner.ts           camera-relative, zone-weighted, pooled creature spawning/despawning
      HungerSystem.ts      PURE hunger drain/feed/starve (tested in rules.test.ts)
      GrowthSystem.ts      PURE growth points -> stages (tested in rules.test.ts)
      feeding.ts           PURE bite rule (canEat) + circle overlap
      ComboSystem.ts       PURE combo count/multiplier/window (tested in combo.test.ts)
      danger.ts            PURE difficulty schedule: hazards/predators allowed by run time
      spawnPoint.ts        shared off-screen spawn point picker + zone-weighted pick
      HazardField.ts       pooled hazard spawning/stepping (spawnAt for scripted/tests)
      Predators.ts         predator spawning by schedule, AI stepping, off-screen warning arrows
      CoinField.ts         coin clusters + prey drops, collection
      Pickups.ts           treasure chests (seabed) + magnet orbs; returns pickup events
      Darkness.ts          depth darkness overlay with the seal's light (darknessAt() in zones.ts)
      FrenzySystem.ts      PURE frenzy meter/duration (tested in frenzy.test.ts)
      UpgradeSystem.ts     PURE upgrade levels -> run modifiers, purchase rules (upgrades.test.ts)
      Tutorial.ts          PURE first-run hint rules (tutorial.test.ts)
    services/
      EventBus.ts          typed events between scenes/systems
      saveData.ts          PURE save schema v2 (coins, bests, upgrades, tutorialDone, settings),
                           migrateSave (v1 -> v2), recordRun, purchase (+ save.test.ts)
      AudioManager.ts      registers synthesized sounds as AudioBuffers, rate-limited play,
                           music loop, mute (save is the source of truth)
      SaveService.ts       localStorage wrapper (guarded; in-memory fallback), `saves` singleton
      Viewport.ts          current viewport, safe-area insets, canvas resize, fitUiCamera/fitWorldCamera,
                           sharpenTexts, textureScale
    utils/
      math.ts           clamp, lerp, angle helpers, frame-rate independent damp (+ tests)
      rng.ts            seeded mulberry32 RNG (+ tests)
      viewport.ts       PURE viewport math: backing size, zoom, visible design area (+ tests)
  index.html
  vite.config.ts        also holds the Vitest config
  eslint.config.js
  tsconfig.json
  package.json
```

## Scenes
- **Boot -> Preload -> Menu <-> Shop -> Game (+Hud in parallel) -> GameOver overlay -> Game (retry) / Shop / Menu**; Game <-> Pause overlay -> resume / restart / Menu.
- Upgrades are read once at run start (`runModifiers(saves.data.upgrades)`) and passed to the Seal (speed, boost) and HungerSystem (max, drain).
- Audio: `audio.register(game)` in Preload renders every sound into Phaser's audio cache (Web Audio only; silent otherwise). `audio.play(key)` rate-limits per key. Phaser's `sound.mute` can't be read reliably before the first user gesture unlocks audio, so the save's `settings.muted` is the source of truth.
- GameScene owns world simulation; HudScene subscribes to events (`run:hunger` every frame; `run:score`, `run:growth` on change and on the first frame; `run:over`; `seal:boost`; debug) via EventBus and never reads game objects directly. GameScene launches Hud on create and stops Hud + GameOver + Pause on shutdown.
- Pause: Esc / P, the HUD pause button (`ui:pause` event) and game BLUR/HIDDEN call `GameScene.pauseRun()`, which pauses Game + Hud and launches PauseScene. Scene pause/resume are queued by Phaser (they apply on the next update). Paused scenes get no input, so GameScene calls `keyboard.resetKeys()` on RESUME (no stuck keys). Taps on the pause button don't steer (InputController.isOnPauseButton).
- Game over: GameScene marks itself dead, plays the death tween, then launches GameOverScene on top while the world keeps animating. Retry = `scene.start(Game)` from the overlay (restarts the running GameScene). Scene order in `main.ts` sets draw order (GameOver above Hud above Game).
- HUD can't receive events emitted during GameScene.create (it isn't created yet), so GameScene sets `hudDirty` and publishes the full state on its first update.
- EventBus subscribers pass their unsubscribe functions to `subscribeForScene(scene, [...])` so listeners are removed on scene shutdown (scenes restart cleanly).

## UI system
- Design direction (from the `frontend-design` + `game-ui-ux` skills): deep-water ink panels, sea-foam text, glacier cyan for progress/focus, gold for coins and purchases, coral for danger; buoy orange only for the one main action per screen. One typeface, Baloo 2 (800 for titles/buttons/numbers, 600 body), bundled via `@fontsource-variable/baloo-2` and loaded in `main.ts` before the game starts (canvas text doesn't re-render when a font arrives late).
- Create text with `uiText(scene, x, y, text, kind, options)` (kinds: title, heading, button, number, body, caption) and colors from `COLORS`/`CSS`; don't hand-roll font styles. Text shadows need padding (Phaser doesn't size for them); `uiText` adds it.
- Buttons: `new Button(scene, x, y, { width, height, label, icon, caption, variant, round, onClick })`, then `.setName('id')` (the playtest finds buttons by name). Register a screen's buttons with `new FocusNav(scene).add(...)`; the focus ring only shows once the keyboard is used. A click needs pointer-down on the button (a finger held from gameplay can't trigger it).
- Layout: anchor to view edges with `getViewport()` plus `getSafeInsets()` (notches, in design units) and `EDGE` margin. Menus author a 720-tall column centred vertically.
- Motion: one intro moment per screen (menu wordmark chomp, results count-up, pause fade); skip it when `reducedMotion()`. Input is ignored on objects inside a container at alpha 0, so overlays accept clicks once faded in.
- UI textures are painted in `ui/uiTextures.ts` after the font loads; icons are white (tint them).

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

## Rendering / scale (no letterboxing, native resolution)
- Scale mode `NONE`, managed by us (`services/Viewport.ts`, math in `utils/viewport.ts`): the canvas backing store = window CSS size × devicePixelRatio (capped at 2), shown at CSS size via scale `zoom = 1/dpr`. `main.ts` re-applies it on window/visualViewport resize.
- Every camera zooms by `zoom = min(backingW/1280, backingH/720)`: the 1280x720 **design area** always fits and the longer axis shows more (a 16:9 monitor minus browser chrome sees ~1455x720 design units). No bars on any aspect ratio.
- UI scenes call `fitUiCamera()` → camera shows design space `[0..viewWidth] x [0..viewHeight]`; anchor UI to edges with `getViewport().viewWidth/viewHeight` (never fixed 1280/720) and re-layout via `onResize()` (Menu/GameOver just restart). The world camera uses `fitWorldCamera()`; world systems use `camera.worldView` for anything view-sized.
- Text: `sharpenTexts(scene)` re-rasterizes all Text at the current zoom (call after create and on resize); text created later sets `resolution: uiTextResolution()`.
- Textures carry a pixel density in `texture.customData.resolution` (placeholders: 2 for sprites/effects/UI, 1 for soft backgrounds; real files: manifest `resolution`). Anything that sets a sprite/particle/tile scale multiplies by `textureScale(scene, key)` so display size stays in design units.
- Portrait phones currently get a very tall view; add a rotate-device prompt or portrait layout in Phase 9.
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
- Spawner keeps ~`SPAWN.targetAlive` creatures, spawning just off-screen (70% ahead of the seal) with the zone at the spawn point choosing a weighted creature, and recycles creatures > `despawnDistance` from the camera centre. Eaten prey vanish while bigger creatures linger, so when fewer than `SPAWN.minFood` edible swimmers are within `foodRadius` of the view it spawns only food (`pickSpawn`), up to `maxAlive`. Pooled objects are reused: code that holds a creature reference across frames must also check it wasn't respawned (e.g. compare its `motion` object).

## Danger, damage and saves
- Hazards spawn by run time (`hazardsAllowed`); each predator kind has its own `spawn` rule in `predators.ts` — a run-time schedule (shark, orca) or home zones where it lives while the camera is there (anglerfish) — evaluated by `predatorsAllowed(rule, elapsed, viewZone)` in `systems/danger.ts`. URL `?calm` forces danger time to 0, so no hazards and no predators (every rule has `after` > 0).
- Darkness/glow layering: world sprites < `Depths.Darkness` (25) overlay < `Depths.Glow` (26) glows < floating text (30). Anything that must be findable in the dark gets a glow image at `Depths.Glow`.
- Contacts: hazards vs the seal's body circle; predator **mouth** circle vs the seal's body; the seal's mouth vs a predator's body when the seal has outgrown it (predators flee then).
- `GameScene.hurt()` is the single damage path: hunger damage, knockback (`applyKnockback` — a decaying impulse separate from swimming, so facing doesn't flip), stun, i-frames, combo reset, hit-stop, shake, `seal:hurt` event (HUD vignette flash). It records the last hit for the death cause.
- Hit-stop: `GameScene.update` returns early while `hitStop > 0` (tweens keep running).
- On death `saves.recordRun()` banks coins and bests; the result (with `newBest`, totals) goes to GameOverScene. The menu shows best score and coins.

## Testing / verification
- `npm run check` = typecheck + lint + unit tests + playtest. Run it before calling a phase done.
- Unit tests (Vitest, `src/**/*.test.ts`, Node environment) for pure logic: movement, math, later hunger, growth thresholds, combo timing, upgrade cost curves, save migration.
- `npm run playtest` boots the game via Vite in headless Chrome (GPU via ANGLE D3D11 on Windows; `PLAYTEST_GL=swiftshader` for software), drives keyboard/mouse/multi-touch, asserts on live state through `window.__PHASER_GAME__`, fails on console errors or HTTP errors, and writes screenshots to `.playtest/` (gitignored). Extend it with checks for every new mechanic.
- `PLAYTEST_ONLY=desktop,mobile npm run playtest` runs just those sections (screens, desktop, danger, phase4, phase5, gameplay, mobile). Click UI with `clickButton(page, scene, name)` / `buttonAt()`; a timed-out `sceneActive()` reports every scene's status.
- Playtest flows: desktop movement + pause, gameplay (eating/growth/game over) and mobile run with `?calm`; the danger flow runs without it and places threats with `hazards.spawnAt` / `predators.spawnAt`. Page-side helpers must return plain data, never game objects (serializing the scene graph takes seconds and breaks timing checks).
- `npm run balance -- [human|perfect] [seconds]` runs a bot that chases prey with the mouse, dodges close threats (boosting away from hunting sharks), and logs hunger/score/stage every 5 s plus hits taken and cause of death. Results vary a lot run to run: take several samples. Reference numbers are in the script header and ROADMAP.
- Manual play on a real phone over LAN: `npm run dev:host`, open the printed network URL.

## Scripts
`npm run dev` | `dev:host` | `build` | `preview` | `typecheck` | `lint` | `format` | `format:check` | `test` | `test:watch` | `playtest` | `balance` | `check`
