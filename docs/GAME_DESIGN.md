# Game Design

## Pitch
You are a hungry seal exploring a big ocean map. Your belly is always emptying. Eat fish, crabs, squid and seabirds to stay alive, dodge hazards, outgrow predators, grab coins, and spend them on upgrades between runs.

## Camera and world
- Side view, camera follows the seal with slight look-ahead.
- **Maps (done):** each map is a bounded 40,000 px world (~30 screens across) with solid terrain like Hungry Shark, beaches at both ends and named regions with a danger rating (1-5, on the region banner and the pause map). Metrics, layouts and region tables: [LEVEL_DESIGN.md](LEVEL_DESIGN.md). You slide along rock (a hard bump thuds); creatures and predators steer around it; crabs walk on the real ground. Creatures spawn around the camera by depth zone, weighted by the region's own mix, only in open water.
  - **Goals per map:** 6 pearls (some in grottos only a small seal fits; saved the moment you take one), a giant-squid boss in its lair (it telegraphs, lunges or sweeps its arms, then is exposed: bite it to take a heart), chests. 3 pearls open the next map; all pearls + the boss = mastered.
  - **Size gates:** strong currents across the entrances of the dangerous regions push back a seal below the gate's size ("Too strong! Grow to size N").
  - **Seal Bay** (free) -> **Arctic** (3 Seal Bay pearls) -> **Tropical Lagoon** (3 Arctic pearls). Older saves with a best score of 12,000 / 30,000 keep their unlocks.
  - Map dangers on top of the usual ones: eel dens in cave walls, urchin beds, chained minefields, toxic and volcanic-heat clouds, fishing boats on surface lanes (see Hazards).
  - Each map has its own colors, decor (Blender-rendered coral, kelp, wrecks, landmarks, beach props, rock/coral/ice clusters set into the rock edges), creature/predator mix and treasure spots (chests respawn 150 s after opening; a random chest can also appear on the abyss floor).
  - Map select after the first run (Play -> map cards with a picture of the map, best score, pearls, unlock progress). The pause screen shows the whole map: where you are, regions and their danger, pearls found and missing, gates, chests and the boss lair.
- Vertical range from sky through surface to the abyss; depth zones are the same on every map:
- Depth zones, each with own palette, creatures and hazards:
  1. **Surface / Sky** — water line, seabirds, jumping fish, boats (later). Seal can leap and fly ballistically.
  2. **Shallows / Reef** — small fish, crabs, coins, jellyfish.
  3. **Open Ocean** — schools, squid, penguins-in-water, sharks appear.
  4. **Deep** — anglerfish, mines, orcas, dim lighting.
  5. **Abyss** — endgame zone, big predators, rich rewards, hardest hunger drain.
- A run's difficulty scales with elapsed time (and depth).
- Measured with terrain on the earlier 14-16k maps (balance bot, human mode, no upgrades, 2026-10-03): Seal Bay 3:26 / 4:58, Arctic 6:07, Tropical 2:03 / 8:10. The 40k maps still need a balance pass.

## Controls
- **Mouse:** seal swims toward the cursor without clicking (Feeding Frenzy / Hungry Shark PC style); hold left button to boost. Speed ramps from 0 at 18 px to full at 110 px from the seal, so pointing straight at nearby prey still chases at full speed. Mouse leaving the canvas = glide.
- **Touch:** floating joystick, so the finger never covers the action. Touch anywhere except the buttons and a stick appears under the finger; drag to steer (direction and distance from where it landed; full speed at 90 design units, small centre deadzone). Dragging further pulls the stick along, so reversing is quick. Release to glide to a stop. A faint stick sits bottom-left as a hint. A touch that *starts* on the bottom-right Boost button boosts (works with a second finger while steering).
- **Keyboard:** WASD/arrows to steer. Space/Shift = boost.
- The most recently used device wins, so a resting mouse doesn't fight the keyboard.
- **Pause:** Esc or P, or the pause button (top-right). The run also pauses by itself when the tab or window loses focus. Pause menu: Resume, Restart run, Settings, Quit to menu, sound, and the map.
- Movement feel: smooth acceleration, turn rate limited (sharper when slow, wider arcs at speed), body rotates to heading, belly-roll flip when changing facing, levels out when idle.
- Leaping: swimming up slowly rides along the surface; upward speed above ~210 px/s breaches and keeps momentum; gravity applies only in air (slight air control); splashing back in keeps ~72% speed.
- Boost: stamina bar (drains ~2.4 s from full, regenerates after a short delay), ~1.75x top speed, bigger leaps. Water only.

## Core mechanics

### Hunger (health)
- Single bar (max 100). Drains continuously; rate rises with time in the run and with depth zone.
  - Current tuning: 2.1/s at the start (full bar lasts ~48 s without food), +100% after 360 s, zone multiplier reef 1.0 / ocean 1.15 / deep 1.35 / abyss 1.6.
- Eating restores hunger by the prey's nutrition value.
- Hazards and predators deal damage to the same bar. Zero = run ends.
- Starvation warning: bar flashes and a red screen vignette pulses below 25%.

### Eating
- The seal eats with its **mouth** (a circle just behind the nose), not its whole body, so you have to face your food.
- Bite on contact when seal stage (bite tier) >= prey tier. Otherwise the seal bumps off: it loses most of its speed, the prey bolts, and "Too big!" pops up (no damage yet).
- Predators bite the seal with their mouth (see Damage).
- Eating gives: nutrition, score (x combo), growth progress, sometimes a coin.
- Feedback: gulp squash, star sparks, floating "+score" text; brief hit-stop on bigger prey.

### Growth
- Growth meter fills from eating. Filling it grows the seal by a stage (8 sizes per run, ~4x longer from size 1 to 8) and raises bite tier: size N eats tier N. Stage resets at the start of each run.
  - Size is physical: everything edible at a size looks clearly smaller than the seal, and predators are bigger than it until it outgrows them. Small seals fit through grottos; big ones push through size-gate currents. The camera pulls back as the seal grows (zoom 1 -> 0.55) and the ocean fills up to match (spawn counts follow the view size).
  - Eating: the meal is pulled into the mouth and shrinks away (a gulp), with the chomp burst.
  - Current tuning (`GROWTH` in balance.ts, metrics table in [LEVEL_DESIGN.md](LEVEL_DESIGN.md)): stage costs 60 / 130 / 220 / 340 / 480 / 650 / 850 growth points; scale 0.6 -> 2.4; top speed up to +30%.

### Combo and Frenzy
- Eating within 2.2 s of the last meal builds a combo (done). Multiplier on score: x2 at 2 meals, x3 at 5, x4 at 10, x5 at 16. Getting hurt breaks the combo. Combos of 5+ get a "N COMBO!" callout when they end. HUD shows multiplier, count and a shrinking timer bar.
- Meals fill a **Frenzy** meter (done): +3.6% per meal x combo multiplier (~28 plain meals, far fewer on a combo); drains slowly after 3 s without eating. When full: 8 s frenzy — 1.3x speed, invulnerable (smashes through jellyfish/mines for +50 each), everything edible including sharks (they flee), score x2, 280 px coin magnet, golden glow, HUD meter pulses.

### Damage (done)
- Hazards and predator bites take a chunk of hunger, knock the seal back (it keeps facing the same way), may stun it (no steering), and give 1.2 s of invulnerability (seal blinks). Screen shake, brief hit-stop, red vignette flash, "-N" popup.
- Death cause = the last hit if hunger hit zero within 0.6 s of it, otherwise "starved". Results screen title per cause: Starved! / Chomped! / Kaboom! / Stung! / Crunched! / Lured! / Spiked!

### Boost
- Limited stamina bar, regenerates when not boosting. Gives a speed burst; ideal for chasing prey and escaping.

### Hazards
Appear from 25 s into a run: 2 allowed at first, +2 per minute, max 7 (`DANGER` in balance.ts).

| Hazard | Behaviour | Effect |
|---|---|---|
| Jellyfish ✅ | Drifts slowly, bobs and pulses; reef/ocean/deep | 12 damage, 0.7 s stun, knockback |
| Sea mine ✅ | Sways on its chain, blinks; ocean/deep/abyss | 30 damage, explodes (gone), big knockback |
| Pufferfish ✅ | Puffs up near the seal for 2 s, then needs 2.5 s to recover | Eating it puffed stings (see prey table) |
| Urchin bed ✅ | Fixed on the seabed in beds (map config) | 8 damage, 0.4 s stun |
| Minefield ✅ | Chained mines in fixed fields (map config) | as sea mine |
| Toxic / heat cloud ✅ | Map zones (pollution, volcanic vents) | Hunger drains 3x (toxic) / 2x (heat) inside |
| Fishing boat ✅ | Patrols a surface lane; the crew attacks a seal within 650 px and 1,000 px deep | Nets sink and trap (6 damage, 2.2 s at 30% speed); harpoons 16 damage + knockback; a size-7 seal rams it for 3 crates of fish |
| Eel den ✅ | Moray in a cave wall: tenses, lunges out 230 px, snaps back; electric eel: charges, zaps 240 px around | 18 / 14 damage; edible at tier 5 / 6 |

### Predators
- Shark ✅ (ocean/deep, from 45 s), Orca ✅ (ocean/deep, from 3 min; tier 6 = never edible outside a frenzy, 40 damage), Anglerfish ✅ (deep/abyss while you're there: lurks still behind a glowing lure, 0.35 s telegraph, short 540 px/s lunge; edible from size 4), Barracuda ✅ (packs of 3-4 in their home regions; fast, small bites), Hammerhead ✅ (tier 6, open-water regions, charges). Giant squid bosses ✅ (one per map lair, 6-8 hearts; see Maps).
- States: patrol → notice (0.8 s telegraph: stops, turns to the seal, flashes red, "!") → chase (370 px/s, turns slower than the seal, gives up after 6 s or 900 px) → bite → recover (swims off, then 4 s cooldown). Only hunts a seal that's in the water. Off-screen hunters show a red arrow at the screen edge.
- Shark bite: 28 damage + knockback. Outrun it with boost, out-turn it, or leap out of the water.
- Seal outgrowing a predator's tier makes it flee and turns it into a big reward. Tiers: barracuda 4, anglerfish 5, shark 6, hammerhead 7, orca 8 (moray 5, electric eel 6).
- Schedule: first shark at 45 s, up to 2 at 150 s, 3 at 270 s.

## Prey table (tune in `src/config/creatures.ts`)
Prey flee only from a seal big enough to eat them. Display size grows with tier (`scale`): tier 1 ~40-50 px, tier 2 ~55-70, tier 3 ~95-100, tier 4 ~130.

| Tier | Creature | Zone | Nutrition | Score | Behaviour |
|---|---|---|---|---|---|
| 1 | Minnow ✅ | Reef/Ocean | 6 | 10 | schools of 3-6, flees at 290 px/s |
| 1 | Shrimp ✅ | Reef | 5 | 8 | drifts and bobs, flees at 230 px/s |
| 2 | Sardine school ✅ | Ocean/Deep | 11 | 20 | schools of 6-10, flees at 330 px/s |
| 3 | Seabird ✅ | Sky above the surface | 12 | 50 | glides and swoops low; leap out of the water to catch |
| 3 | Squid ✅ | Ocean/Deep | 16 | 60 | cruises slowly, escapes in jet bursts (420 px/s kicks) |
| 3 | Penguin ✅ | Upper reef (near surface) | 20 | 90 | groups of 2-3, fast (390 px/s flee) |
| 4 | Sea turtle ✅ | Reef/Ocean | 32 | 120 | slow, doesn't flee: a big safe meal once you're size 4 |
| 2 | Pufferfish ✅ | Reef/Ocean | 14 | 40 | doesn't flee; puffs into a spiky ball near you for 2 s (bigger hitbox), then has to catch its breath for 2.5 s: eat it then. Eating it puffed stings: 14 damage + knockback |
| 1 | Lanternfish ✅ | Deep/Abyss | 7 | 15 | glowing schools of 4-7; food for small seals in the dark |
| 2 | Crab ✅ | Abyss seabed | 16 | 45 | walks along the floor, scuttles sideways away from you |
| 5 | Small shark | Deep | 45 | 250 | fights back |

## Currency and progression
- **Coins:** collected in run (floating clusters of 4-7 ahead of the seal, dropped by prey: 10% tier 1, 22% tier 2, ..., treasure chests later). Touch to collect, with a short magnet pull; dropped coins vanish after 10 s. Banked into the save when the run ends (done).
- **Gems (done):** rare currency, never sold. Earned from treasure chests (30% chance of 1), harder missions (1-2) and achievements (1-5 each, ~38 in total). Spent on premium skins.
- **Upgrades** (permanent, bought with coins in the Shop; 5 levels, costs 60 / 150 / 300 / 550 / 900) — done for 4:
  - Flippers: +4% top speed per level. Big Belly: +12 max hunger per level. Blubber: -7% hunger drain per level. Turbo Tail: +18% boost (lasts longer, refills faster) per level.
  - Big Jaws: +10% growth per meal per level. Coin Whiskers: +30% coin magnet range per level. Feeding Frenzy: +12% frenzy charge per level. (All 7 done.)

## Pickups (done)
- **Treasure chest:** sits on the abyss seabed (one at a time, while you're near the bottom). Touch to burst it open: 12-18 coins + 150 score.
- **Magnet orb:** floating bubble, roughly every 35 s ahead of you, lasts 30 s. Grab it for 12 s of long-range (320 px) coin magnet; HUD shows the countdown.
- Chests and orbs glow, so they're findable in the dark.

## Depth and light (done)
- The deep gets dark: darkness starts ~600 px above the Deep and ramps to ~90% at the seabed. The seal carries a small light circle (clear ~110 px, dark by ~360 px).
- Glows show through the dark: anglerfish lures, lanternfish, jellyfish (pink), mine warning lights (blinking red), chests, orbs.
- The camera pulls back as the seal grows (100% → 82% zoom at size 5).
- **Skins (done):** cosmetic only (same stats), bought on the Skins screen (menu), which previews the selected skin and buys or equips it; buying also wears it. Coins: Harbor Seal (free, default), Arctic Pup (harp seal pup, 300), Sea Lion (450), Tropical Seal (Hawaiian monk seal with a lei, 600), Leopard Seal (800), Walrus (1,000), Elephant Seal (1,500). Gems: Pirate Seal (12), Golden Seal (20). The equipped skin shows on the title screen and in runs.
- **Missions (done):** 3 active goals from a pool of 22 (`config/missions.ts`), shown on the title screen with progress rings. "In one run" goals keep your best attempt; "total" goals add up across runs. Completing one mid-run pops a toast; it's paid (coins, sometimes gems) when the run ends and a new mission replaces it. New players start with Eat 20 fish / Score 2,000 / Catch 2 seabirds.
- **Achievements (done):** 12 one-time milestones from lifetime stats (First Bite, Big Eater, Abyss Diver, Rock Bottom, Fully Grown, Shark Snack, Orca Crunch, Treasure Hunter, Frenzied, Marathon, Deep Pockets, Bird Watcher), each worth gems. Unlocked at the end of a run.
- **Stats screen (done, trophy button on the title screen):** top 5 runs (score, time, size, date), lifetime totals (runs, best score, fish eaten, favorite snack, deepest dive, longest run, time played, coins/gems earned, chests, frenzies, missions done) and the achievement badges (locked ones say how to unlock them).
- **Results screen:** a row of reward chips: missions done (+coins/gems), achievements unlocked, gems found, and the run's place on your top 5.
- Save data in localStorage (save v4, migrates v1-v3): coins, gems, bests, runs, settings, upgrade levels, skins owned/equipped, lifetime stats, missions, achievements, top runs.

## Settings (done)
Title screen (gear) and pause menu: music volume, sound-effect volume, screen shake on/off, high-contrast warnings (predator "!" becomes big yellow with a black outline, warning flashes blink white instead of red, off-screen danger arrows turn yellow, mines blink white: readable without telling red from other colors). Saved with the game.

## Audio (done, synthesized)
Three music loops crossfade: menu, a brighter loop in the upper water (shallows/open ocean) and a dark ambient loop in the deep and abyss. Effects include chomps, splash, hurt, zap, explosion, boost, grow, frenzy, shark alert, bump, rock thud, pufferfish puff, chest open, gem, magnet, mission complete, combo, zone change, map unlock, buy, click and game over.

## Audio notes
All sounds are synthesized in code at startup (`src/audio/`): chomp / big chomp, coin, splash, hurt, jellyfish zap, explosion, boost whoosh, grow and frenzy arpeggios, shark "dun-dun" on its telegraph, bump, UI click, purchase, game over, and a calm 8-bar underwater music loop. Mute from the menu (persists). Replace with recorded audio later under the same keys.

## Onboarding (done)
First run only (until the first run ends): bottom-centre hints — how to swim (mouse/keys or touch), eat smaller fish + hunger drains, boost + leap for birds, jellyfish/mine warning at 24 s, "you grew", and "SHARK!" when one first hunts you. Zone banners (every run) name each depth zone as you enter it.

## Interface (done)
- Look: deep-water ink panels, sea-foam text, gold for coins, buoy orange for the main action. Chunky buttons that sink when pressed. One rounded typeface (Baloo 2).
- **Title:** "Hungry Seal" on an ice floe that gets a bite taken out of it (first visit per session). Play, Upgrades (gold dot when you can afford something), best score, coin balance, sound and fullscreen buttons. The seal floats on the right and turns to look at the mouse.
- **Upgrades:** two columns, one row per upgrade: icon, name, what it does, level segments, current effect, and a gold buy button with the price and the next level's effect ("Need 40 more" when you can't afford it).
- **HUD:** top-left panel with hunger (fish icon), size progress (4 segments to max size), boost stamina and frenzy charge; top-right score, coins, coin-magnet timer, pause button. Combo top-centre. Everything stays inside phone notches (safe area).
- **Results:** cause of death as the title, score counting up, "New best!" badge, six stats (coins earned, time, size, distance, deepest, fish eaten), then Swim again / Upgrades / Menu.
- Keyboard works everywhere: arrows or Tab to move, Enter or Space to press (focus ring appears once you use the keyboard). Reduced-motion settings skip intros and count-ups.

## Run structure
1. Menu -> Play (or Upgrades). Keys: arrows/Tab + Enter, S upgrades, M mute, F fullscreen. Results: Swim again / Upgrades / Menu (S, Esc).
2. Start near surface. Hunger full, stage 1.
3. Endless run; difficulty ramps with time.
4. Death -> results (score, coins, distance, best) -> Shop / Retry.

## Difficulty curve (targets to tune)
- First 30s: safe tutorial-ish, plenty of tier-1 food, one hint overlay.
- 30-90s: hazards appear, first predator sighting.
- 2-4 min: predators frequent, hunger drain noticeably higher; player must have grown.
- Without upgrades a typical first run lasts ~2-3 min; with upgrades 5+ min.
- Measured (Phase 7, human-like balance bot, which plays better than a first-timer): fresh save 1:49 / 2:15 / 2:54 / 3:42 / 3:54 / 10:00+ (median ~3:20, deaths mostly sharks); all upgrades at level 3: 7:41, 10:00+, and a run still at full health at 4:46 when stopped. Coins per run: ~30-140 fresh, ~430-490 upgraded, plus mission rewards. Maxing every upgrade costs 13,720 coins (roughly 40-60 runs).

## Juice checklist
Screen shake, hit-stop on big bites, particles (bubbles, blood-free chomp bits/stars), water splash on breach, parallax backgrounds, light rays, floating text, squash and stretch, low-hunger vignette, satisfying audio per bite.

## Out of scope for v1
Multiplayer, monetization, leaderboards (maybe local top-5 only), pets/companions, 3D models.
