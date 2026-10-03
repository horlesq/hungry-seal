# Level design

How the maps are built, following the `level-design` skill: **metrics first, then blockout,
validate, and only then dress.** Every gap, cave and gate below is sized from the seal's real
movement numbers, and `src/world/mapCheck.test.ts` proves each map is playable at every size.

## 1. Metrics (from `config/balance.ts`)

The seal grows a lot over a run (8 sizes, ~4x longer). Size is physical: small seals fit where
big ones can't, big seals bully their way through currents and eat what used to chase them.

| Size | Scale | Length | Body radius | Camera zoom | Newly edible (tier = size) |
|---|---|---|---|---|---|
| 1 | 0.60 | 106 | 18 | 1.00 | minnow, shrimp, lanternfish |
| 2 | 0.75 | 132 | 23 | 0.95 | sardine, crab, pufferfish |
| 3 | 0.92 | 162 | 28 | 0.89 | squid, penguin, seabird |
| 4 | 1.12 | 197 | 34 | 0.82 | barracuda, turtle |
| 5 | 1.36 | 239 | 41 | 0.75 | moray eel, anglerfish |
| 6 | 1.64 | 289 | 50 | 0.68 | shark, electric eel |
| 7 | 1.98 | 348 | 60 | 0.61 | hammerhead, fishing-boat catch |
| 8 | 2.40 | 422 | 73 | 0.55 | orca |

- **Speed:** cruise 430 px/s at size 1 rising to ~560 at size 8; boost x1.75. A 40,000 px map
  takes ~90 s to cross straight; real routes (dives, detours) take several minutes.
- **View:** ~1,455 x 720 at size 1, ~2,650 x 1,310 at size 8.
- **Leap:** ~100 px high at cruise, ~300 px when boosting straight up. Rock above the water that
  must be hopped is <= 220 px tall; higher islands are walk-around landmarks.
- **Passages** (width = 2 x radius + margin):
  - `TIGHT` 70 px: sizes 1-3 only. Grottos and secret pearls (take them early in a run).
  - `SNUG` 100 px: up to size 5.
  - `OPEN` 260 px+: every size. All critical-path routes are at least this wide.
- **Size gates** are currents: below the gate size the water shoves you back ("Too strong! Grow to
  size 6"); at or above it you push through. Gates sit across the entrance of a danger region.

## 2. Map structure

Every map is 40,000 px wide (world height unchanged: sky, water line at 640, seabed to 6,400),
split into named **regions** with a danger rating (1-5) shown on the region banner and the map.
Beaches sit at both ends. Pacing is a rising sawtooth: calm beach, a teaching area, a first
danger spike, a breather, a bigger spike, the gated deep and the boss lair, then a calmer
climb out to the far beach.

Each map has:
- **6 pearls** (persistent collectibles). At least one is small-only (`TIGHT` grotto), one needs a
  leap, one sits in a danger region, one is behind a size gate and one in the boss lair.
- **A boss** in a lair behind the deepest gate (size 7). It has to be fought, not eaten: bite it
  while it's exposed after an attack.
- **Map goals:** all 6 pearls + the boss = map mastered (big reward). The next map opens after
  3 pearls on the previous map (or the old score unlock for existing saves).

## 3. Danger catalogue

| Danger | Where | Notes |
|---|---|---|
| Barracuda packs | kelp, open water | fast, 3-5 together, small bites (tier 4) |
| Moray eels | cave walls (eel dens) | hide in the rock, lunge when you pass (tier 5) |
| Electric eels | deep caves | zap everything nearby on a cycle; stun (tier 6) |
| Sharks / hammerheads | open water regions | sharks as now; hammerheads charge in pairs (tier 6/7) |
| Orcas | open water, Arctic | the top predator (tier 8) |
| Boss (giant squid family) | boss lair | tentacle sweeps, ink, lunge; vulnerable after a lunge |
| Urchin beds | reef and kelp floors | spikes: hurt and stun on contact |
| Jellyfish blooms | marked regions | many jellyfish drifting |
| Minefields | around wrecks | chained mines rising off the floor |
| Toxic waste | barrel dumps, deep | green cloud: hunger drains much faster inside |
| Currents | size gates, trench mouths | push you; the gate kind blocks small seals |
| Fishing boats | surface lanes | drop nets (trap + slow) and harpoons; a size-7 seal can bump a boat to knock its catch loose |

## 4. Seal Bay (40,000 px)

| # | Region | x | Danger | Beat | Teaches / tests |
|---|---|---|---|---|---|
| 1 | West Beach | 0-2,600 | 1 | teach | sand, pier (landmark), leap for gulls. Pearl 1 under the pier |
| 2 | Coral Gardens | 2,600-8,000 | 1 | teach | reef heads, arches; first jellies and puffers. Pearl 2 in a TIGHT grotto |
| 3 | Kelp Forest | 8,000-12,000 | 2 | develop | tall kelp, urchin beds, barracuda |
| 4 | Wreck Graveyard | 12,000-17,000 | 3 | spike | two wrecks, minefield, boat lane. Pearl 3 inside the big wreck |
| 5 | Gull Rock | 17,000-19,500 | 1 | rest | mid-map island with a beach, sea stack. Pearl 4 on a ledge you must leap to |
| 6 | Shark Shelf | 19,500-24,500 | 4 | spike | open blue, sharks + hammerheads, rock ring |
| 7 | The Trench | 24,500-31,000 | 4 | gated deep | gate size 5 at the trench mouth; eel dens, toxic dump. Pearl 5 in an eel cave |
| 8 | Kraken's Lair | 26,500-29,500 (bottom) | 5 | climax | gate size 7; the Kraken. Pearl 6 in the lair |
| 9 | Vent Ridge | 31,000-37,400 | 3 | release | climb back up past hot vents and anglerfish caves |
| 10 | East Beach | 37,400-40,000 | 1 | rest | beach, lighthouse |

## 5. Arctic (40,000 px)

West Shore (snowy beach, penguin colony) -> Floe Fields (leap between floes; pearl on a floe) ->
Iceberg Alley (orcas, danger 4) -> Ice Caves (TIGHT tunnels, pearl) -> Old Tanker (wreck,
oil/toxic zone, minefield, trawler lane) -> Seamount (rest) -> the Abyss Rift (gate 5, eels) ->
Colossal Squid's lair (gate 7) -> Glacier Wall and East Shore.

## 6. Tropical Lagoon (40,000 px)

Resort Beach -> Coral Lagoon (TIGHT grotto pearl) -> Sunken City (ruins, morays, urchins) ->
Volcano Isle (lava tube, hot vents; pearl at the crater lip, needs a leap) -> Hammerhead Alley
(danger 4) -> the Blue Hole (a sinkhole straight down; gate 5) -> Abyssal Squid's lair (gate 7)
-> Mangrove Shallows -> Palm Beach.

## 7. Validation (automated)

`src/world/mapCheck.test.ts` bakes each map and flood-fills the open water with each size's
radius (gates closed below their size). It checks:
- the start is open and both beaches are reachable at size 1;
- every region's entry is reachable at the size it's meant for;
- every pearl is reachable at some size, and the boss lair only at size >= 7;
- no pocket of open water a seal can enter but not leave.
