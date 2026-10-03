// Tropical Lagoon (docs/LEVEL_DESIGN.md section 6). West to east:
// Resort Beach -> Coral Lagoon -> Sunken City -> Volcano Isle -> Hammerhead Alley ->
// the Blue Hole (gate size 5) -> Abyssal Squid's Lair (gate size 7, under the shelf) ->
// Shelf Edge -> Pirate Cove -> Mangroves -> Palm Beach.
import { TextureKeys as T } from '../assets';
import { WORLD } from '../zones';
import {
  add,
  beachProfile,
  box,
  circle,
  cut,
  ellipse,
  grotto,
  MAP_WIDTH,
  PASSAGE,
  poly,
  S,
  spire,
  tunnel,
} from './helpers';
import type { MapDef } from './types';

const lagoonGrotto = grotto(5600, 1150, {
  rx: 360,
  ry: 210,
  width: PASSAGE.TIGHT,
  chamber: 90,
  entrance: 'right',
  bend: 30,
});

export const TROPICAL: MapDef = {
  id: 'tropical',
  name: 'Tropical Lagoon',
  blurb: 'Coral, a sunken city, a volcano and the Blue Hole.',
  unlock: { after: 'arctic', pearls: 3, score: 30000 },
  start: { x: 2500, y: 820 },
  palette: {
    sky: '#4cc3f5',
    horizon: '#fff4c9',
    water: { reef: '#19d3cf', ocean: '#1497c6', deep: '#0e4f8e', abyss: '#1b1650' },
    floor: '#06050f',
    rockRim: '#f3dca0',
    rockTop: '#b98f60',
    rockDeep: '#3a2440',
    outline: '#241826',
    landRim: '#fff0c2',
    land: '#f0d595',
  },
  zones: {
    reef: { name: 'Lagoon', blurb: 'Coral gardens full of fish, pufferfish and turtles' },
    ocean: { name: 'Coral Sea', blurb: 'Sunken ruins and sharks on patrol' },
    deep: { name: 'Twilight', blurb: 'Lanternfish and hot vents. Something glows down there' },
    abyss: { name: 'Trench', blurb: 'The deepest water. Treasure for the brave' },
  },
  creatureMult: { penguin: 0, turtle: 2, pufferfish: 2, minnow: 1.2 },
  predatorMult: { shark: 1.3, orca: 0.5 },
  terrain: {
    width: MAP_WIDTH,
    height: WORLD.height,
    seed: 37,
    floorRough: 18,
    floor: [
      ...beachProfile('west'),
      // Coral Lagoon.
      [3200, 1250],
      [4500, 1350],
      [6000, 1300],
      [7200, 1450],
      [8000, 1600],
      // Sunken City ledge.
      [8800, 2100],
      [10000, 2400],
      [12000, 2450],
      [13000, 2600],
      // Volcano Isle.
      [14000, 2700],
      [15200, 2800],
      [16500, 2700],
      [17500, 2900],
      // Hammerhead Alley.
      [18500, 3600],
      [20500, 3900],
      [22000, 3800],
      [23000, 1700],
      // The Blue Hole: a sheer shaft in a shallow shelf.
      [24100, 1560],
      [24300, 6200],
      [25300, 6250],
      [25500, 1560],
      [26500, 1600],
      // Shelf Edge: a reef wall dropping to the deep plain.
      [27500, 2600],
      [28500, 4200],
      [30000, 4600],
      [31000, 4300],
      // Pirate Cove: a ledge with the wreck, then up the slope.
      [32000, 3620],
      [32600, 3500],
      [33900, 3480],
      [35000, 2300],
      // Mangroves.
      [35800, 1400],
      [36800, 1250],
      ...beachProfile('east'),
    ],
    ops: [
      // Coral Lagoon: coral heads and the grotto (pearl 2, small seals only).
      add(circle(3500, 1240, 130), { rough: 14, blend: 60 }),
      add(circle(4400, 1300, 160), { rough: 14, blend: 60 }),
      ...lagoonGrotto.ops,
      add(circle(6800, 1380, 150), { rough: 14, blend: 60 }),
      // Sunken City: broken columns and a temple you can swim into (pearl 3).
      add(box(9200, 2170, 70, 420, 10), { rough: 3 }),
      add(box(9600, 2250, 70, 300, 10), { rough: 3 }),
      add(box(10800, 2200, 1000, 420, 16), { rough: 3 }),
      add(poly([10250, 2000], [10800, 1760], [11350, 2000]), { rough: 3, blend: 10 }),
      cut(box(10800, 2240, 840, 280, 12), { blend: 10 }),
      ...tunnel(
        [
          [11200, 2280],
          [11500, 2280],
        ],
        200,
      ),
      add(box(12300, 2300, 70, 360, 10, 0.2), { rough: 3 }),
      // Volcano Isle: far above the water, a lava tube underneath, a ledge to leap to (pearl 4).
      add(
        poly(
          [13600, 2800],
          [14400, 900],
          [14850, 200],
          [15050, 160],
          [15250, 200],
          [15700, 900],
          [16500, 2800],
        ),
        { rough: 22, blend: 220 },
      ),
      cut(ellipse(15050, 150, 120, 60), { blend: 30 }),
      ...tunnel(
        [
          [13500, 1750],
          [14300, 1950],
          [15300, 1850],
          [16300, 2050],
          [16900, 1900],
        ],
        PASSAGE.OPEN,
      ),
      add(box(15900, S + 30, 260, 70, 30), { rough: 6, blend: 60 }),
      // Hammerhead Alley pillars.
      spire(19300, 3700, 2600, 140),
      spire(21300, 3850, 2900, 120, 50),
      // The Blue Hole: an eel cave in its wall (pearl 5) and the lair under the shelf.
      cut(ellipse(24120, 4300, 240, 140), { blend: 30, rough: 10 }),
      add(ellipse(26700, 5850, 1300, 700), { rough: 20, blend: 120 }),
      cut(ellipse(26700, 5850, 900, 380), { blend: 40, rough: 12 }),
      ...tunnel(
        [
          [24900, 5950],
          [25500, 5930],
          [26000, 5900],
        ],
        320,
      ),
      // Shelf Edge: an anglerfish cave dug into the reef wall.
      cut(ellipse(27750, 3350, 300, 170), { blend: 30, rough: 10 }),
      ...tunnel(
        [
          [27750, 3380],
          [28350, 3420],
        ],
        PASSAGE.OPEN,
      ),
      // Pirate Cove: a pirate wreck on the slope.
      add(
        poly([32700, 3200], [34000, 3180], [33950, 3360], [33600, 3470], [32900, 3470], [32750, 3380]),
        { rough: 4, blend: 30 },
      ),
      cut(ellipse(33350, 3350, 560, 85), { blend: 16 }),
      ...tunnel(
        [
          [33500, 3350],
          [33900, 3340],
          [34300, 3280],
        ],
        200,
      ),
      // Mangroves: roots hanging from little islands at the surface.
      add(ellipse(35900, S - 30, 240, 90), { rough: 10 }),
      add(capsule2(35850, S, 35800, 1050, 26)),
      add(capsule2(35980, S, 36060, 1000, 22)),
      add(ellipse(36700, S - 20, 220, 80), { rough: 10 }),
      add(capsule2(36650, S, 36600, 1000, 24)),
      add(box(250, S - 160, 600, 320, 40), { blend: 60 }),
      add(box(MAP_WIDTH - 250, S - 160, 600, 320, 40), { blend: 60 }),
    ],
  },
  regions: [
    { id: 'resort', name: 'Resort Beach', blurb: 'Sunbathers and snacks', x0: 0, x1: 2600, danger: 1 },
    {
      id: 'lagoon',
      name: 'Coral Lagoon',
      blurb: 'Coral, turtles and a grotto for small seals',
      x0: 2600,
      x1: 8000,
      danger: 1,
    },
    {
      id: 'city',
      name: 'Sunken City',
      blurb: 'Ruins full of eels and urchins. The temple is open',
      x0: 8000,
      x1: 13300,
      danger: 3,
    },
    {
      id: 'volcano',
      name: 'Volcano Isle',
      blurb: 'Hot water in the lava tube. Leap for the ledge',
      x0: 13300,
      x1: 17500,
      danger: 3,
    },
    {
      id: 'hammerheads',
      name: 'Hammerhead Alley',
      blurb: 'Open water and big sharks',
      x0: 17500,
      x1: 23000,
      danger: 4,
      predatorMult: { shark: 2.5 },
      jellyBloom: 1.5,
    },
    {
      id: 'blue-hole',
      name: 'The Blue Hole',
      blurb: 'Straight down. A current guards the shaft',
      x0: 23000,
      x1: 26500,
      danger: 4,
    },
    {
      id: 'lair',
      name: "Abyssal Squid's Lair",
      blurb: 'It glows in the dark',
      x0: 25800,
      x1: 27600,
      y0: 5470,
      y1: 6230,
      danger: 5,
      predatorMult: { shark: 0, orca: 0, anglerfish: 0 },
    },
    {
      id: 'shelf-edge',
      name: 'Shelf Edge',
      blurb: 'The reef wall drops into the dark',
      x0: 26500,
      x1: 31000,
      danger: 3,
      predatorMult: { anglerfish: 2 },
    },
    {
      id: 'pirate-cove',
      name: 'Pirate Cove',
      blurb: 'Pirate gold, if you dare',
      x0: 31000,
      x1: 35500,
      danger: 3,
    },
    {
      id: 'mangroves',
      name: 'Mangroves',
      blurb: 'Shallow, tangled and calm',
      x0: 35500,
      x1: 37400,
      danger: 2,
    },
    { id: 'palm-beach', name: 'Palm Beach', blurb: 'Paradise', x0: 37400, x1: MAP_WIDTH, danger: 1 },
  ],
  gates: [
    { x: 24800, y: 3000, w: 1300, h: 220, dir: [0, -1], minStage: 5 },
    { x: 25350, y: 5930, w: 200, h: 380, dir: [-1, 0], minStage: 7 },
  ],
  pearls: [
    { x: 2000, y: 790 }, // 1: under the resort pier
    lagoonGrotto.chamber, // 2: the lagoon grotto (small seals only)
    { x: 10600, y: 2280 }, // 3: inside the temple
    { x: 15900, y: S - 120 }, // 4: on the volcano ledge (leap)
    { x: 24100, y: 4330 }, // 5: the Blue Hole wall cave
    { x: 27250, y: 6020 }, // 6: the lair
  ],
  boss: { id: 'abyssal', x: 26700, y: 5850, lairRadius: 900 },
  eelDens: [
    { x: 9900, y: 2350, kind: 'moray', dir: [0, -1] },
    { x: 12000, y: 2400, kind: 'moray', dir: [0, -1] },
    { x: 24300, y: 3600, kind: 'moray', dir: [1, 0] },
    { x: 25300, y: 4900, kind: 'electric', dir: [-1, 0] },
    { x: 27500, y: 3250, kind: 'moray', dir: [1, 0] },
  ],
  urchinBeds: [
    { x0: 8800, x1: 9800, minY: 2000, maxY: 2600 },
    { x0: 11800, x1: 12800, minY: 2300, maxY: 2700 },
    { x0: 34200, x1: 35000, minY: 2200, maxY: 2900 },
  ],
  minefields: [],
  toxicZones: [
    { x: 14700, y: 1950, r: 300, kind: 'heat' },
    { x: 15800, y: 2000, r: 260, kind: 'heat' },
    { x: 29500, y: 4500, r: 320, kind: 'heat' },
  ],
  boatLanes: [
    { x0: 17500, x1: 23000 },
    { x0: 31000, x1: 35500 },
  ],
  decor: [
    { key: T.DecorPalm, x: 300, y: S - 340 },
    { key: T.DecorPalm, x: 700, y: S - 330, flip: true, scale: 0.85 },
    { key: T.DecorPalm, x: 39300, y: S - 340 },
    { key: T.DecorPalm, x: 39700, y: S - 330, flip: true, scale: 0.9 },
    { key: T.DecorStatue, x: 9900, y: 2350 },
    { key: T.DecorColumn, x: 12600, y: 2450, scale: 0.9 },
    { key: T.DecorColumn, x: 9450, y: 2400, scale: 0.7, flip: true },
    { key: T.DecorVent, x: 29500, y: 4550 },
    { key: T.DecorVent, x: 30200, y: 4500, scale: 0.8 },
    { key: T.DecorClam, x: lagoonGrotto.chamber.x, y: lagoonGrotto.chamber.y + 60 },
    { key: T.DecorSkeleton, x: 26800, y: 6150 },
  ],
  scatter: [
    { keys: [T.DecorShell, T.DecorStarfish], minY: S - 400, maxY: S + 700, spacing: 240 },
    {
      keys: [
        T.DecorCoralBranch,
        T.DecorCoralBrain,
        T.DecorCoralFan,
        T.DecorAnemone,
        T.DecorStarfish,
        T.DecorShell,
      ],
      minY: S + 300,
      maxY: 2800,
      spacing: 90,
      front: 0.15,
    },
    {
      keys: [T.DecorSeaweed, T.DecorUrchin, T.DecorBoulder],
      minY: 2800,
      maxY: 6500,
      spacing: 230,
    },
  ],
  treasure: [
    { x: 4400, y: 1100 },
    { x: 10900, y: 2300 },
    { x: 15000, y: 1900 },
    { x: 27750, y: 3420 },
    { x: 33300, y: 3400 },
  ],
};

/** A thin mangrove root (capsule) as a terrain shape. */
function capsule2(x1: number, y1: number, x2: number, y2: number, r: number) {
  return { type: 'capsule', x1, y1, x2, y2, r1: r, r2: r * 0.6 } as const;
}
