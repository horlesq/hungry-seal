# Game Design

## Pitch
You are a hungry seal in an endless ocean. Your belly is always emptying. Eat fish, crabs, squid and seabirds to stay alive, dodge hazards, outgrow predators, grab coins, and spend them on upgrades between runs.

## Camera and world
- Side view, camera follows the seal with slight look-ahead.
- Endless horizontal scroll (procedurally spawned), vertical range from sky through surface to the abyss.
- Depth zones, each with own palette, creatures and hazards:
  1. **Surface / Sky** — water line, seabirds, jumping fish, boats (later). Seal can leap and fly ballistically.
  2. **Shallows / Reef** — small fish, crabs, coins, jellyfish.
  3. **Open Ocean** — schools, squid, penguins-in-water, sharks appear.
  4. **Deep** — anglerfish, mines, orcas, dim lighting.
  5. **Abyss** — endgame zone, big predators, rich rewards, hardest hunger drain.
- Horizontal world is effectively infinite; a run's difficulty scales with elapsed time and distance.

## Controls
- **Mouse:** seal swims toward the cursor without clicking (Feeding Frenzy / Hungry Shark PC style); hold left button to boost. Speed ramps from 0 at 18 px to full at 110 px from the seal, so pointing straight at nearby prey still chases at full speed. Mouse leaving the canvas = glide.
- **Touch:** hold/drag anywhere to swim toward the finger; release to glide to a stop. A touch that *starts* on the bottom-right BOOST button boosts (works with a second finger while steering).
- **Keyboard:** WASD/arrows to steer. Space/Shift = boost.
- The most recently used device wins, so a resting mouse doesn't fight the keyboard.
- Movement feel: smooth acceleration, turn rate limited (sharper when slow, wider arcs at speed), body rotates to heading, belly-roll flip when changing facing, levels out when idle.
- Leaping: swimming up slowly rides along the surface; upward speed above ~210 px/s breaches and keeps momentum; gravity applies only in air (slight air control); splashing back in keeps ~72% speed.
- Boost: stamina bar (drains ~2.4 s from full, regenerates after a short delay), ~1.75x top speed, bigger leaps. Water only.

## Core mechanics

### Hunger (health)
- Single bar (max 100). Drains continuously; rate rises with time in the run and with depth zone.
  - Current tuning: 2.6/s at the start (full bar lasts ~38 s without food), +100% after 240 s, zone multiplier reef 1.0 / ocean 1.15 / deep 1.35 / abyss 1.6.
- Eating restores hunger by the prey's nutrition value.
- Hazards and predators deal damage to the same bar. Zero = run ends. (Phase 3)
- Starvation warning: bar flashes below 25% (done); screen vignette (Phase 3).

### Eating
- The seal eats with its **mouth** (a circle just behind the nose), not its whole body, so you have to face your food.
- Bite on contact when seal stage (bite tier) >= prey tier. Otherwise the seal bumps off: it loses most of its speed, the prey bolts, and "Too big!" pops up (no damage yet).
- Larger predators eat the seal if they touch it (damage chunk, brief invulnerability after). (Phase 3)
- Eating gives: nutrition, score, growth progress (coins in Phase 3).
- Feedback: gulp squash, star sparks, floating "+score" text (done); hit-stop and shake scaled to prey size (Phase 3).

### Growth
- Growth meter fills from eating. Filling it grows the seal by a stage (visible size increase, up to 5 stages per run) and raises bite tier. Stage resets at the start of each run; upgrades set the starting stage/baseline.
  - Current tuning: stage costs 80 / 200 / 380 / 600 growth points; scale 0.72 → 1.12; top speed +4% per stage.

### Combo and Frenzy
- Eating within ~2s of the last meal builds a combo multiplier (x2..x5) on score.
- Combo also fills a **Frenzy** meter. When full: brief frenzy (speed boost, invulnerability, coin magnet, everything edible, score x2).

### Boost
- Limited stamina bar, regenerates when not boosting. Gives a speed burst; ideal for chasing prey and escaping.

### Hazards
| Hazard | Behaviour | Effect |
|---|---|---|
| Jellyfish | Drifts vertically, static-ish | Damage + brief stun |
| Sea mine | Stationary, blinks | Big damage, explodes |
| Pufferfish | Inflates near seal | Damage if eaten too early |
| Fishing net / hook (later) | Hangs from surface | Slows/traps |
| Toxic waste / oil (later) | Zone | Drains hunger fast |

### Predators
- Shark (mid), Orca (deep), Giant squid / Anglerfish (abyss).
- States: patrol, notice, chase, bite, flee-when-frenzy. Telegraph before attack (readable warning).
- Seal outgrowing a predator's tier makes it prey and turns it into a big reward.

## Prey table (initial; tune in `src/config/creatures.ts`)
Implemented so far: minnow, shrimp, sardine. Prey flee only from a seal big enough to eat them.

| Tier | Creature | Zone | Nutrition | Score | Behaviour |
|---|---|---|---|---|---|
| 1 | Minnow ✅ | Reef/Ocean | 4 | 10 | schools of 3-6, flees at 290 px/s |
| 1 | Shrimp ✅ | Reef | 3 | 8 | drifts and bobs, flees at 230 px/s |
| 2 | Sardine school ✅ | Ocean/Deep | 8 | 20 | schools of 6-10, flees at 330 px/s |
| 2 | Crab | Reef floor | 10 | 25 | walks, snaps |
| 3 | Seabird | Surface/Air | 15 | 50 | glides, dives |
| 3 | Squid | Ocean | 18 | 60 | jets away |
| 4 | Penguin | Surface/Ocean | 25 | 100 | swims fast |
| 4 | Turtle | Reef | 30 | 120 | slow, tanky |
| 5 | Small shark | Deep | 45 | 250 | fights back |

## Currency and progression
- **Coins:** collected in run (floating, from prey, treasure chests). Persist across runs.
- **Gems (later):** rare, premium-feel currency for skins; earned from rare events, not sold.
- **Upgrades** (permanent, bought with coins, 5-8 levels each):
  - Speed, Boost capacity, Max health, Hunger resistance (slower drain), Bite/Growth (faster growth), Coin magnet, Frenzy charge rate.
- **Skins:** cosmetic seal variants (harbor, leopard, arctic, pirate, etc.).
- **Missions (later):** 3 rotating goals per run set ("eat 20 crabs", "reach abyss").
- Save data in localStorage: coins, upgrade levels, skins owned/equipped, best score, settings.

## Run structure
1. Menu -> Play (or Shop).
2. Start near surface. Hunger full, stage 1.
3. Endless run; difficulty ramps with time.
4. Death -> results (score, coins, distance, best) -> Shop / Retry.

## Difficulty curve (targets to tune)
- First 30s: safe tutorial-ish, plenty of tier-1 food, one hint overlay.
- 30-90s: hazards appear, first predator sighting.
- 2-4 min: predators frequent, hunger drain noticeably higher; player must have grown.
- Without upgrades a typical first run lasts ~2-3 min; with upgrades 5+ min.

## Juice checklist
Screen shake, hit-stop on big bites, particles (bubbles, blood-free chomp bits/stars), water splash on breach, parallax backgrounds, light rays, floating text, squash and stretch, low-hunger vignette, satisfying audio per bite.

## Out of scope for v1
Multiplayer, monetization, leaderboards (maybe local top-5 only), pets/companions, 3D models.
