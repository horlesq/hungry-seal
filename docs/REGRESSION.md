# Regression checklist

Run before merging a phase or anything that touches gameplay, input, saves or layout.

## Automated (must pass)
- `npm run check`: typecheck, lint, unit tests (pure rules: movement, creature/predator AI, hunger, growth, combo, frenzy, upgrades, missions/achievements/top runs, saves and migration, joystick, viewport, spawning), and the headless browser playtest (desktop, landscape phone, upright phone, pause, skins, progression).
- `npm run soak`: a long run through every depth zone plus 20 restarts; fails if objects, tweens, timers, event listeners or the heap keep growing.
- After tuning anything in `src/config/`: `npm run balance -- human 600` (fresh save) and `npm run balance -- human 600 3` (all upgrades at level 3), several samples each. Targets in GAME_DESIGN.md (Difficulty curve).
- Look at the screenshots in `.playtest/`: passing checks don't prove it looks right.

## By hand (what the bots can't judge)
On a real phone (`npm run dev:host`, open the network URL), upright and sideways:
- [ ] The joystick appears under the thumb, steers smoothly, and never covers the seal; Boost works with a second finger.
- [ ] Text and buttons are readable at arm's length; nothing sits under the notch or home bar.
- [ ] Rotating the phone mid-run re-lays out the HUD and the run carries on.
- [ ] Sound starts after the first tap; the mute button works and is remembered.
- [ ] Switching apps pauses the run; coming back shows the pause menu.
- [ ] Fullscreen button (Android) enters and leaves fullscreen.

On desktop:
- [ ] Mouse steering feels direct; hold click to boost; WASD/arrows and Space work.
- [ ] Esc/P pause, Esc resumes; Tab/arrows + Enter work on every menu.
- [ ] Window resize and moving to another monitor keep everything sharp.

Saves (DevTools, Application > Local Storage, key `hungry-seal-save`):
- [ ] Deleting the save gives a clean first run with tutorial hints and starter missions.
- [ ] An old save (paste a v1-v3 JSON) loads without losing coins, upgrades or skins.

Play feel (a few real runs):
- [ ] A first run without upgrades lasts about 2-3 minutes for a new player; the death screen explains what happened.
- [ ] Mission toasts, reward chips and achievements appear when expected and pay the right amounts.
- [ ] Nothing feels unfair: predators telegraph before biting, hazards are visible in the dark.

### Maps, audio and settings (Phase 8)
- [ ] On every map: swim along walls, through tunnels, caves and arches; the seal slides, never sticks or passes through rock; creatures don't swim inside rock.
- [ ] Crabs walk on the real seabed; chests sit on the ground at the treasure spots and come back later.
- [ ] Map select: locked maps show the score needed and progress; a run that passes the score shows "New map unlocked" and the map opens.
- [ ] The pause map shows the seal in the right place.
- [ ] Music changes when diving into the deep and back up; volume sliders and the shake / high-contrast toggles apply right away and are remembered.
- [ ] No seams or flicker between terrain chunks while swimming fast (boost) across the map.
