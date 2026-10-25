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
  1. **Surface / Sky** â€” water line, seabirds, jumping fish, boats (later). Seal can leap and fly ballistically.
  2. **Shallows / Reef** â€” small fish, crabs, coins, jellyfish.
  3. **Open Ocean** â€” schools, squid, penguins-in-water, sharks appear.
  4. **Deep** â€” anglerfish, mines, orcas, dim lighting.
  5. **Abyss** â€” endgame zone, big predators, rich rewards, hardest hunger drain.
- A run's difficulty scales with elapsed time (and depth).
- Measured on the 40k maps with the 8-size ladder: see Difficulty curve below.

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
  - Current tuning: 2.2/s at the start (full bar lasts ~45 s without food), +100% after 200 s and on (+200% at 6:40), zone multiplier reef 1.0 / ocean 1.15 / deep 1.35 / abyss 1.6, size multiplier x1 at size 1 to x2.25 at size 8 (steepest at the top: x1.6 / x1.9 / x2.25 for sizes 6-8) (`HUNGER.sizeMultiplier`): a big seal sees ~3x more ocean, swims faster and has a bigger mouth, so without it a grown seal never went hungry. Maps multiply the drain too: Arctic x1.1, Tropical x1.2 (`difficulty.hunger`).
  - So in the shallows of Seal Bay the bar lasts ~45 s at the start, ~17 s for a size-5 seal at 3 minutes, and ~10 s for a size-7 seal at 5 minutes: a long run is a hunt, not a cruise.
- Eating restores hunger by the prey's nutrition value.
- Hazards and predators deal damage to the same bar. Zero = run ends.
- Starvation warning: bar flashes and a red screen vignette pulses below 25%, or earlier when fewer than 6 s of food are left at the current drain (late in a run the bar empties in ~15 s, so 25% would be too little warning).

### Eating
- The seal eats with its **mouth** (a circle just behind the nose), not its whole body, so you have to face your food.
- Bite on contact when seal stage (bite tier) >= prey tier. Otherwise the seal bumps off: it loses most of its speed, the prey bolts, and "Too big!" pops up (no damage yet).
- Predators bite the seal with their mouth (see Damage).
- Eating gives: nutrition, score (x combo), growth progress, sometimes a coin.
- **Outgrown prey** (Hungry Shark style): prey up to 2 tiers below your size give full nutrition and growth; each tier further below divides them by (1 + 0.3 x tiers) (`mealValue` in systems/feeding.ts). A minnow is worth 40% to a size-8 seal, a turtle 63%: a big seal has to hunt big prey and the predators it has outgrown. Score isn't reduced.
- Feedback: gulp squash, star sparks, floating "+score" text; brief hit-stop on bigger prey.

### Growth
- Growth meter fills from eating. Filling it grows the seal by a stage (8 sizes per run, ~4x longer from size 1 to 8) and raises bite tier: size N eats tier N. Stage resets at the start of each run.
  - Size is physical: everything edible at a size looks clearly smaller than the seal, and predators are bigger than it until it outgrows them. Small seals fit through grottos; big ones push through size-gate currents. The camera pulls back as the seal grows (zoom 1 -> 0.55) and the ocean fills up to match (spawn counts follow the view size).
  - Eating: the meal is pulled into the mouth and shrinks away (a gulp), with the chomp burst.
  - Current tuning (`GROWTH` in balance.ts, metrics table in [LEVEL_DESIGN.md](LEVEL_DESIGN.md)): stage costs 60 / 140 / 260 / 420 / 620 / 880 / 1200 growth points; scale 0.6 -> 2.4; top speed up to +30%. A good player reaches size 5-6 around 3-4 min and size 7 (the boss) around 5 min.

### Combo and Frenzy
- Eating within 2.2 s of the last meal builds a combo (done). Multiplier on score: x2 at 2 meals, x3 at 5, x4 at 10, x5 at 16. Getting hurt breaks the combo. Combos of 5+ get a "N COMBO!" callout when they end. HUD shows multiplier, count and a shrinking timer bar.
- Meals fill a **Frenzy** meter (done): +3% per full-value meal (~34 plain meals), scaled by what the meal is worth to the seal (`mealValue`: minnows barely count for a big seal) and by the combo at half weight (a x5 combo charges x3); drains slowly after 3 s without eating. When full: 8 s frenzy â€” 1.3x speed, invulnerable (smashes through jellyfish/mines for +50 each), everything edible including sharks (they flee), score x2, 280 px coin magnet, golden glow, HUD meter pulses. Afterwards the meter rests for 30 s (its flame icon dims): a frenzy is a treat, not a state. Before this, a grown seal on a combo was in a frenzy most of the time.

### Damage (done)
- Hazards and predator bites take a chunk of hunger, knock the seal back (it keeps facing the same way), may stun it (no steering), and give 1.2 s of invulnerability (seal blinks). Screen shake, brief hit-stop, red vignette flash, "-N" popup.
- Death cause = the last hit if hunger hit zero within 0.6 s of it, otherwise "starved". Results screen title per cause (Starved! / Chomped! / Kaboom! / Stung! / Crunched! / Lured! / Spiked! ...) with a one-line tip for next time ("Sharks outswim you: boost away when you see "!"").

### Boost
- Limited stamina bar, regenerates when not boosting. Gives a speed burst; ideal for chasing prey and escaping.

### Hazards
Appear from 25 s into a run: 2 allowed at first, +2 per minute, max 8 (`DANGER` in balance.ts). The counts are for a size-1 view: they grow gently with the view (with the square root of its scale: x1.35 at size 8; a big seal is also a big target) and with the map's danger (Arctic x1.2, Tropical x1.35). Stings (jellyfish, urchins, a puffed pufferfish) hurt a bigger seal less: -5% per size, 65% at size 8 (`DAMAGE.stingSizeFalloff`); mines, predators, eels and boats always hit in full.

| Hazard | Behaviour | Effect |
|---|---|---|
| Jellyfish âœ… | Drifts slowly, bobs and pulses; reef/ocean/deep | 12 damage, 0.7 s stun, knockback |
| Sea mine âœ… | Sways on its chain, blinks; ocean/deep/abyss | 30 damage, explodes (gone), big knockback |
| Pufferfish âœ… | Puffs up when the seal comes within 130 px (plus a big seal's longer reach) for 2 s, then needs 2.5 s to recover | Eating it puffed stings (see prey table). At 170 px, crowds of puffers puffed at seals hunting other fish nearby and were the top damage source on Seal Bay and the Lagoon |
| Urchin bed âœ… | Fixed on the seabed in beds (map config) | 8 damage, 0.4 s stun |
| Minefield âœ… | Chained mines in fixed fields (map config) | as sea mine |
| Toxic / heat cloud âœ… | Map zones (pollution, volcanic vents) | Hunger drains 3x (toxic) / 2x (heat) inside |
| Fishing boat âœ… | Patrols a surface lane; the crew attacks a seal within 650 px and 1,000 px deep | Nets sink and trap (6 damage, 2.2 s at 30% speed); harpoons 16 damage + knockback; a size-7 seal rams it for 3 crates of fish |
| Eel den âœ… | Moray in a cave wall: tenses, lunges out 230 px, snaps back; electric eel: charges, zaps 240 px around | 18 / 14 damage; edible at tier 5 / 6 |

### Predators
- Shark âœ… (open water and up into the lower shallows, from 1:15), Orca âœ… (from 2:45, hunts higher than sharks; tier 8 = never edible outside a frenzy, 40 damage), Anglerfish âœ… (deep/abyss while you're there: lurks still behind a glowing lure, 0.35 s telegraph, short 540 px/s lunge; edible from size 5), Barracuda âœ… (packs of 3-4 in their home regions from 50 s; fast, small bites), Hammerhead âœ… (tier 7, open-water regions, charges). Giant squid bosses âœ… (one per map lair, 6-8 hearts; see Maps).
- States: patrol â†’ (stalk) â†’ notice (0.8 s telegraph: stops, turns to the seal, flashes red, "!") â†’ chase (turns slower than the seal, gives up after 6 s or 900 px) â†’ bite â†’ recover (swims off, then 4 s cooldown). A patrolling hunter that senses a seal it can eat (2.5x its notice range) stalks it: it cruises toward it at its own depth instead of drifting past. Only hunts a seal that's in the water. Off-screen hunters show a red arrow at the screen edge.
- Chase speeds sit just above a small seal's cruise (430 px/s): shark 445, hammerhead 470, barracuda 470; the orca at 560 outswims even a full-grown seal's cruise (559). Swimming straight away barely holds a shark off; boosting (750 px/s) or leaping out of the water loses it. Before this sharks chased at 370 and a seal could ignore them.
- The water near the surface stays a refuge: sharks and hammerheads patrol from y 1500 down, orcas from 1150 (the surface is at 640).
- Shark bite: 28 damage + knockback.
- Seal outgrowing a predator's tier makes it flee and turns it into a big reward. Tiers: barracuda 4, anglerfish 5, shark 6, hammerhead 7, orca 8 (moray 5, electric eel 6).
- Schedule: sharks 1 at 1:15, 2 at 2:30, 3 at 4:00, 4 at 5:30; orcas 1 at 2:45, 2 at 4:45, 3 at 6:45, 4 at 8:45. Arctic allows x1.2 as many of every hunter, Tropical x1.35 (map `difficulty.danger`).

## Prey table (tune in `src/config/creatures.ts`)
Prey flee only from a seal big enough to eat them. Display size grows with tier (`scale`): tier 1 ~40-50 px, tier 2 ~55-70, tier 3 ~95-100, tier 4 ~130.

| Tier | Creature | Zone | Nutrition | Score | Behaviour |
|---|---|---|---|---|---|
| 1 | Minnow âœ… | Reef/Ocean | 6 | 10 | schools of 3-6, flees at 290 px/s |
| 1 | Shrimp âœ… | Reef | 5 | 8 | drifts and bobs, flees at 230 px/s |
| 2 | Sardine school âœ… | Ocean/Deep | 11 | 20 | schools of 6-10, flees at 330 px/s |
| 3 | Seabird âœ… | Sky above the surface | 12 | 50 | glides and swoops low; leap out of the water to catch |
| 3 | Squid âœ… | Ocean/Deep | 16 | 60 | cruises slowly, escapes in jet bursts (420 px/s kicks) |
| 3 | Penguin âœ… | Upper reef (near surface) | 20 | 90 | groups of 2-3, fast (390 px/s flee) |
| 4 | Sea turtle âœ… | Reef/Ocean | 32 | 120 | slow, doesn't flee: a big safe meal once you're size 4 |
| 2 | Pufferfish âœ… | Reef/Ocean | 14 | 40 | doesn't flee; puffs into a spiky ball near you for 2 s (bigger hitbox), then has to catch its breath for 2.5 s: eat it then. Eating it puffed stings: 14 damage + knockback |
| 1 | Lanternfish âœ… | Deep/Abyss | 7 | 15 | glowing schools of 4-7; food for small seals in the dark |
| 2 | Crab âœ… | Abyss seabed | 16 | 45 | walks along the floor, scuttles sideways away from you |

Predators you've outgrown are the big meals (see Predators): barracuda (size 4), anglerfish (5), shark (6), hammerhead (7); the orca only in a frenzy.

## Currency and progression
- **Coins:** collected in run (floating clusters of 4-7 ahead of the seal, dropped by prey: 10% tier 1, 22% tier 2, ..., treasure chests later). Touch to collect, with a short magnet pull; dropped coins vanish after 10 s. Banked into the save when the run ends (done).
- **Gems (done):** rare currency, never sold. Earned from treasure chests (30% chance of 1), harder missions (1-2) and achievements (1-5 each, ~38 in total). Spent on premium skins.
- **Upgrades** (permanent, bought with coins in the Shop; 5 levels, costs 60 / 150 / 300 / 550 / 900) â€” done for 4:
  - Flippers: +4% top speed per level. Big Belly: +12 max hunger per level. Blubber: -7% hunger drain per level. Turbo Tail: +18% boost (lasts longer, refills faster) per level.
  - Big Jaws: +10% growth per meal per level. Coin Whiskers: +30% coin magnet range per level. Feeding Frenzy: +12% frenzy charge per level. (All 7 done.)

## Pickups (done)
- **Treasure chest:** sits on the abyss seabed (one at a time, while you're near the bottom). Touch to burst it open: 12-18 coins + 150 score.
- **Magnet orb:** floating bubble, roughly every 35 s ahead of you, lasts 30 s. Grab it for 12 s of long-range (320 px) coin magnet; HUD shows the countdown.
- Chests and orbs glow, so they're findable in the dark.

## Depth and light (done)
- The deep gets dark: darkness starts ~600 px above the Deep and ramps to ~90% at the seabed. The seal carries a small light circle (clear ~110 px, dark by ~360 px).
- Glows show through the dark: anglerfish lures, lanternfish, jellyfish (pink), mine warning lights (blinking red), chests, orbs.
- The camera pulls back as the seal grows (100% â†’ 82% zoom at size 5).
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
First run only (until the first run ends): bottom-centre hints â€” how to swim (mouse/keys or touch), eat smaller fish + hunger drains, boost + leap for birds, jellyfish/mine warning at 24 s, "you grew", and "SHARK!" when one first hunts you. Zone banners (every run) name each depth zone as you enter it.

## Interface (done)
- Look: deep-water ink panels, sea-foam text, gold for coins, buoy orange for the main action. Chunky buttons that sink when pressed. One rounded typeface (Baloo 2).
- **Title:** "Hungry Seal" on an ice floe that gets a bite taken out of it (first visit per session). Play, Upgrades (gold dot when you can afford something), best score, coin balance, sound and fullscreen buttons. The seal floats on the right and turns to look at the mouse.
- **Upgrades:** two columns, one row per upgrade: icon, name, what it does, level segments, current effect, and a gold buy button with the price and the next level's effect ("Need 40 more" when you can't afford it).
- **HUD:** top-left panel with hunger (fish icon; flashes, with red screen edges, under 25% or with under 6 s of food left), size progress (7 segments, one per size step), boost stamina and frenzy charge (flame dims while it recharges); top-right score, coins, coin-magnet timer, pause button. Combo top-centre. Everything stays inside phone notches (safe area).
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
- Measured on the 40k maps (Phase 8, 2026-10-24, `BOT_MAP=<map> npm run balance -- human 600 [3]`). The bot got smarter in this pass (hunts outgrown predators, times pufferfish, keeps a berth that grows with its size), so it plays better than the Phase 7 bot.
  - Before the size changes: 4 of 6 fresh runs never ended (size 8 by 3-4 min, hunger pinned near full, 10:00+ and 200-380k score).
  - After, fresh save: Seal Bay 1:11 / 4:07 / 6:38, Arctic 4:10 / 5:21 (one more run stuck under a floe, a bot fault), Tropical 5:11 / 5:52 / 7:32. Median ~5:10, deaths spread over stings, mines, orcas and late starvation; coins ~190-560 per run.
  - All upgrades at level 3: 7:02, 10:00+, 10:00+ (~950-1,000 coins in 10 min). Correction (2026-10-25): all three were Seal Bay runs; the bot's upgraded save put the default map back (fixed: the bot now logs the map it actually plays).
  - Arctic's Floe Fields were made a calm teaching stretch (no barracuda packs): before, 4 of 5 fresh Arctic runs died there at size 1-2.
  - Open then: Tropical played a little easier than Seal Bay for the bot (addressed in the difficulty pass below: per-map difficulty); and scores ran 30-150k for a good run, so the old score unlock (Arctic 12,000, Tropical 30,000) opened the maps after one or two good runs, before the pearls did (after the pass a good run scores ~10-50k, so the unlock is a "one good run" goal again).
- **Difficulty pass (2026-10-25)** after the first hand playtest found the game too easy. The bot agreed: median ~5:15 fresh, hunger at 85-100% most of the run, sharks too slow to matter, the shallows a safe zone, and a grown seal on a combo in a frenzy most of the time. Changes: hunger ramps to x2 by 3:20 (start barely changed), predators chase just faster than a small seal cruises and stalk a seal they sense, sharks patrol up into the lower shallows, hazards scale gently with the view while stings hurt a big seal less, frenzy charges by meal value and rests 30 s, per-map difficulty (Arctic, Tropical harder), the food guarantee feeds a big seal real meals. The bot was also taught to boost once a hunter charges and to give pufferfish a wide berth, so these numbers are a good player's.
  - Overshooting first (hunger 2.7/s from the start, sharks from 35 s, more hazards): most runs died at 0:50-1:25 at size 1-2. The start was pulled back to roughly the old feel; the pressure now builds from ~1:30.
  - Mid-pass (round 4): fresh Seal Bay 2:52 / 2:59, Arctic 2:20, Tropical 2:17 / 3:02. With stings at half damage for a big seal, upgraded (level 3) runs then lasted 8:17 and 9:16+ at size 8, nearly immortal; the top sizes got steeper hunger (x2.25), stings a 65% floor and the orca a faster chase (560).
  - Final tuning, fresh save: Seal Bay 2:56 / 2:10, Arctic 2:55 / 3:21 (after thinning West Shore's penguins; before that a size-1 seal could starve there at 0:46), Tropical 2:53 / 3:00 / 1:14 (that one rushed into a barracuda region at size 2). Median ~2:55 (was ~5:15), sizes 3-6 at death, coins ~80-170 per run; deaths by hunters (sharks, the first orca at 2:45, hammerheads, barracuda packs) and stings once the hunger bar empties fast.
  - Final tuning, all upgrades at level 3: Arctic 3:16 (orca), Tropical 4:27 (size 8, stings), Seal Bay 6:34 (size 8, a mine after 4 orca bites). Upgrades buy roughly 1-4 extra minutes; the harder maps take the most out of them.
  - Upgrades now add less than before (deaths come from hits, which only Big Belly softens). If progression feels weak in hand playtests, a damage-reduction effect (e.g. on Blubber) is the lever.

## Juice checklist
Screen shake, hit-stop on big bites, particles (bubbles, blood-free chomp bits/stars), water splash on breach, parallax backgrounds, light rays, floating text, squash and stretch, low-hunger vignette, satisfying audio per bite.

## Out of scope for v1
Multiplayer, monetization, leaderboards (maybe local top-5 only), pets/companions, 3D models.
