# Hungry Seal

Web-based side-scrolling arcade game in the style of Hungry Shark Evolution / Feeding Frenzy, starring a seal. Swim, eat, survive the hunger timer, collect coins, upgrade, repeat.

## Read first
- [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) — mechanics, creatures, progression, tuning numbers
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — stack, folder layout, scenes, systems, conventions
- [docs/ROADMAP.md](docs/ROADMAP.md) — development phases from scaffold to finished product (track progress here)
- [docs/ASSETS.md](docs/ASSETS.md) — art/audio style, sources, manifest rules

## Stack
TypeScript + Vite + Phaser 4. No physics plugin: custom kinematic motion + circle contact checks (see ARCHITECTURE.md). No UI framework; HUD and menus are Phaser scenes. Targets desktop and mobile browsers.

## Commands
- `npm run dev` (or `npm run dev:host` to test on a phone over LAN)
- `npm run check` — typecheck + lint + unit tests + headless browser playtest. Must pass before a phase/feature is called done.
- `npm run playtest` — screenshots land in `.playtest/`; look at them, passing checks don't prove it looks right. `PLAYTEST_ONLY=desktop,mobile` runs single sections.
- `npm run balance -- human 600 [upgradeLevel]` — bot plays a run (optionally with every upgrade at a level); use it after any tuning change in `config/*.ts`. Take several samples (high variance). Run batches of 2-4 per background task (each run can take 10 min).
- `npm run soak` — long run + 20 restarts; fails on growing objects, listeners or heap.
- Release checklist: [docs/REGRESSION.md](docs/REGRESSION.md).
- URL flags: `?debug` (overlay + hit circles, or press `), `?calm` (no hazards/predators).
- Git: `main` holds finished phases; do each phase on a `phase-N-...` branch.
- Phaser API lookup: grep `node_modules/phaser/types/phaser.d.ts`.
- Skills live in `.agents/skills/` (tracked, versions in `skills-lock.json`); `.claude/skills/` holds junctions to them (gitignored, recreate after cloning). Use `frontend-design` + `game-ui-ux` for UI work, `phaser-coder` for Phaser code.

## UI rules
- Use the design system in `src/ui/`: tokens and `uiText()` in `theme.ts`, `Button` (+ `setName` for tests), `FocusNav` for keyboard, `widgets.ts`. No ad-hoc fonts, colors or glossy buttons.
- Buoy orange (`variant: 'primary'`) is for the single main action on a screen; gold is for spending coins.
- Anchor to view edges plus `getSafeInsets()`; check desktop and phone screenshots after UI changes.

## Decisions already made (do not re-litigate)
- Side-scroll, free 2D swim in all directions; seal can leap out of the water.
- Desktop + mobile, unified pointer/touch/keyboard input.
- Core loop: constant hunger drain, eat to survive, coins buy upgrades, endless run with score.
- One playable seal, cosmetic skins only.
- Art style: bright, chunky, cartoon, close to Hungry Shark. Free packs (Kenney, CC0) plus generated art; placeholders first.
- Data-driven creatures and upgrades (config tables, not hardcoded in scenes).

## Working rules
- Update the phase checklist in docs/ROADMAP.md as work completes.
- Keep gameplay tuning numbers in `src/config/`, not scattered in scene code.
- All assets are referenced through the manifest so they can be swapped without code changes.
- Prefer object pooling for anything spawned repeatedly (prey, coins, particles).
- Verify Phaser 4 APIs against the installed version's types/docs; do not assume Phaser 3 examples still apply.
- Run the game and check it in the browser before calling a feature done; test touch input via device emulation.
