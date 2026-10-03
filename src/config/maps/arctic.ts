// Arctic (docs/LEVEL_DESIGN.md section 5). West to east:
// West Shore -> Floe Fields -> Iceberg Alley -> Ice Caves -> Old Tanker -> Seamount (rest) ->
// Abyss Rift (gate size 5) -> Colossal Squid's Lair (gate size 7) -> Glacier Wall -> East Shore.
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

/** Floating ice floes along the surface, with gaps of at least an OPEN passage between. */
const FLOES: Array<[number, number]> = [
  [3000, 900],
  [4300, 700],
  [5400, 600],
  [6400, 800],
  [7500, 600],
  [8500, 700],
];

/** An iceberg: a small tip above the water and a big body below. */
function iceberg(x: number, w: number, depth: number) {
  return add(
    poly(
      [x - w * 0.35, S + 60],
      [x - w * 0.15, S - 260],
      [x + w * 0.05, S - 300],
      [x + w * 0.3, S - 160],
      [x + w * 0.45, S + 120],
      [x + w * 0.5, S + depth * 0.5],
      [x + w * 0.2, S + depth],
      [x - w * 0.25, S + depth * 0.85],
      [x - w * 0.5, S + depth * 0.4],
    ),
    { rough: 14, blend: 30 },
  );
}

const iceCave = grotto(17300, 2900, {
  rx: 260,
  ry: 260,
  width: PASSAGE.TIGHT,
  chamber: 95,
  entrance: 'top',
});

export const ARCTIC: MapDef = {
  id: 'arctic',
  name: 'Arctic',
  blurb: 'Ice floes, icebergs, an old tanker and the Colossal Squid.',
  unlock: { after: 'bay', pearls: 3, score: 12000 },
  start: { x: 2500, y: 820 },
  palette: {
    sky: '#9fd8f5',
    horizon: '#eefaff',
    water: { reef: '#3fb8d6', ocean: '#1e7fb0', deep: '#123d70', abyss: '#141c45' },
    floor: '#04070f',
    rockRim: '#ffffff',
    rockTop: '#b7dcef',
    rockDeep: '#2a4a72',
    outline: '#17324d',
    landRim: '#ffffff',
    land: '#e8f6fd',
    speckle: 0.07,
    tiles: [3, 3, 1, 3],
  },
  zones: {
    reef: { name: 'Ice Shelf', blurb: 'Penguins under the floes. Leap through the gaps!' },
    ocean: { name: 'Cold Current', blurb: 'Icebergs, squid... and orcas on the hunt' },
    deep: { name: 'Frozen Deep', blurb: 'Dark and cold. Follow the glow at your peril' },
    abyss: { name: 'Abyss', blurb: 'The rift goes down forever' },
  },
  creatureMult: { turtle: 0, pufferfish: 0, penguin: 2.5, seabird: 1.4, squid: 1.3 },
  predatorMult: { orca: 2, shark: 0.6 },
  terrain: {
    width: MAP_WIDTH,
    height: WORLD.height,
    seed: 23,
    floorRough: 16,
    floor: [
      ...beachProfile('west'),
      // Floe Fields: a shallow shelf under the ice.
      [3200, 1500],
      [4500, 1700],
      [6000, 1650],
      [7500, 1900],
      [9000, 2100],
      // Iceberg Alley.
      [10000, 2800],
      [11500, 3300],
      [13000, 3500],
      [14500, 3400],
      // Ice Caves.
      [16000, 3100],
      [17500, 3100],
      [19000, 3200],
      // Old Tanker ledge.
      [20500, 3400],
      [22000, 3450],
      [23500, 3400],
      [24500, 3700],
      // Seamount saddle.
      [26000, 3900],
      // Abyss Rift.
      [27000, 4600],
      [27500, 6200],
      [31500, 6300],
      [32000, 5000],
      // Glacier Wall.
      [33000, 4600],
      [34000, 3800],
      [35000, 2800],
      [36000, 2000],
      [37000, 1400],
      ...beachProfile('east'),
    ],
    ops: [
      // Floes along the surface (pearl 2 floats above the fourth one).
      ...FLOES.map(([x, w]) => add(box(x, S + 10, w, 140, 50), { rough: 8 })),
      // Iceberg Alley: three bergs with plenty of room under them.
      iceberg(10400, 900, 1500),
      iceberg(12300, 1100, 1900),
      iceberg(14300, 800, 1400),
      // Ice Caves: an ice mass with an open tunnel through it and a tight side chamber.
      add(ellipse(17300, 2550, 1500, 600), { rough: 22, blend: 140 }),
      ...tunnel(
        [
          [15700, 2450],
          [16500, 2300],
          [17300, 2500],
          [18100, 2350],
          [18900, 2500],
        ],
        PASSAGE.OPEN,
      ),
      ...iceCave.ops,
      // The Old Tanker, enterable from the stern (pearl 4 inside).
      add(
        poly(
          [19800, 3080],
          [22400, 3060],
          [22300, 3280],
          [21900, 3420],
          [20200, 3420],
          [19900, 3260],
        ),
        { rough: 4, blend: 30 },
      ),
      add(box(20300, 2930, 500, 260, 16), { rough: 3 }),
      cut(ellipse(21100, 3240, 950, 120), { blend: 20 }),
      ...tunnel(
        [
          [20500, 3240],
          [20050, 3240],
          [19500, 3200],
        ],
        220,
      ),
      // Seamount: a rest stop rising close to the surface.
      add(ellipse(25500, 2900, 700, 1300), { rough: 22, blend: 200 }),
      // Abyss Rift: an eel cave in the west wall (pearl 5)...
      cut(ellipse(27150, 5300, 260, 150), { blend: 30, rough: 10 }),
      ...tunnel(
        [
          [27150, 5300],
          [27750, 5310],
        ],
        200,
      ),
      // ...and the Colossal Squid's lair at the bottom.
      add(ellipse(29600, 6050, 1300, 650), { rough: 26, blend: 160 }),
      cut(ellipse(29600, 6060, 760, 360), { blend: 40, rough: 12 }),
      ...tunnel(
        [
          [29600, 5800],
          [29600, 5250],
        ],
        320,
      ),
      // Glacier Wall: an ice cliff hanging off the east shore, open water underneath.
      add(
        poly(
          [37300, S + 20],
          [37100, S + 140],
          [37250, S + 220],
          [37800, S + 180],
          [38300, S],
          [38300, S - 260],
          [37700, S - 200],
          [37400, S - 60],
        ),
        { rough: 14, blend: 40 },
      ),
      spire(34500, 3400, 2500, 120, -80),
      add(circle(35600, 2500, 160), { rough: 18, blend: 90 }),
      add(box(250, S - 160, 600, 320, 40), { blend: 60 }),
      add(box(MAP_WIDTH - 250, S - 160, 600, 320, 40), { blend: 60 }),
    ],
  },
  regions: [
    {
      id: 'west-shore',
      name: 'West Shore',
      blurb: 'The penguin colony. Lunch!',
      x0: 0,
      x1: 2600,
      danger: 1,
      creatureMult: { penguin: 4 },
    },
    {
      id: 'floes',
      name: 'Floe Fields',
      blurb: 'Leap between the floes. Something shiny sits on one',
      x0: 2600,
      x1: 9000,
      danger: 2,
    },
    {
      id: 'icebergs',
      name: 'Iceberg Alley',
      blurb: 'Orcas hunt between the bergs',
      x0: 9000,
      x1: 15000,
      danger: 4,
      predatorMult: { orca: 3 },
    },
    {
      id: 'ice-caves',
      name: 'Ice Caves',
      blurb: 'Tunnels through the ice. One is very narrow',
      x0: 15000,
      x1: 19500,
      danger: 2,
    },
    {
      id: 'tanker',
      name: 'Old Tanker',
      blurb: 'Leaking oil, old mines and trawlers overhead',
      x0: 19500,
      x1: 24500,
      danger: 3,
    },
    {
      id: 'seamount',
      name: 'Seamount',
      blurb: 'A quiet peak in the cold. Rest here',
      x0: 24500,
      x1: 26500,
      danger: 1,
      predatorMult: { orca: 0, shark: 0 },
    },
    {
      id: 'rift',
      name: 'Abyss Rift',
      blurb: 'A current guards the rift. Eels wait in the walls',
      x0: 26500,
      x1: 32500,
      danger: 4,
    },
    {
      id: 'lair',
      name: "Colossal Squid's Lair",
      blurb: 'Eyes the size of dinner plates',
      x0: 28840,
      x1: 30360,
      y0: 5700,
      y1: 6420,
      danger: 5,
      predatorMult: { shark: 0, orca: 0, anglerfish: 0 },
    },
    {
      id: 'glacier',
      name: 'Glacier Wall',
      blurb: 'Climb past the ice wall',
      x0: 32500,
      x1: 37400,
      danger: 2,
    },
    { id: 'east-shore', name: 'East Shore', blurb: 'Snow, at last', x0: 37400, x1: MAP_WIDTH, danger: 1 },
  ],
  gates: [
    { x: 29600, y: 5080, w: 5600, h: 220, dir: [0, -1], minStage: 5 },
    { x: 29600, y: 5470, w: 380, h: 200, dir: [0, -1], minStage: 7 },
  ],
  pearls: [
    { x: 2000, y: 790 }, // 1: off the penguin beach
    { x: 6400, y: S - 140 }, // 2: on a floe (leap)
    iceCave.chamber, // 3: the narrow ice chamber (small seals only)
    { x: 21300, y: 3260 }, // 4: inside the tanker
    { x: 27100, y: 5340 }, // 5: rift eel cave
    { x: 30150, y: 6250 }, // 6: the lair
  ],
  boss: { id: 'colossal', x: 29500, y: 6060, lairRadius: 760 },
  eelDens: [
    { x: 26900, y: 4500, kind: 'moray', dir: [1, 0] },
    { x: 27560, y: 5650, kind: 'moray', dir: [1, -0.2] },
    { x: 28350, y: 5900, kind: 'electric', dir: [-1, -0.3] },
    { x: 30850, y: 5900, kind: 'electric', dir: [1, -0.3] },
  ],
  urchinBeds: [{ x0: 34600, x1: 35400, minY: 2700, maxY: 3500 }],
  minefields: [{ x0: 19600, x1: 24300, count: 10 }],
  toxicZones: [
    { x: 21100, y: 2700, r: 420, kind: 'toxic' },
    { x: 28300, y: 6250, r: 350, kind: 'toxic' },
  ],
  boatLanes: [
    { x0: 9500, x1: 15000 },
    { x0: 19500, x1: 24500 },
  ],
  decor: [
    { key: T.DecorIgloo, x: 500, y: S - 340 },
    { key: T.DecorIgloo, x: 39400, y: S - 340, flip: true },
    { key: T.DecorSkeleton, x: 29900, y: 6350 },
    { key: T.DecorAnchor, x: 22700, y: 3500 },
    { key: T.DecorBarrel, x: 22900, y: 3500 },
    { key: T.DecorBarrel, x: 19300, y: 3500, flip: true },
  ],
  scatter: [
    { keys: [T.DecorIcicle], minY: S, maxY: 3400, spacing: 70, hang: true },
    { keys: [T.DecorIceChunk, T.DecorShell], minY: S - 400, maxY: S + 700, spacing: 300 },
    {
      keys: [T.DecorIceChunk, T.DecorSeaweed, T.DecorStarfish],
      minY: S + 400,
      maxY: 3000,
      spacing: 170,
    },
    {
      keys: [T.DecorKelp, T.DecorUrchin, T.DecorBoulder],
      minY: 3000,
      maxY: 6500,
      spacing: 220,
    },
  ],
  treasure: [
    { x: 17300, y: 2480 },
    { x: 25500, y: 1600 },
    { x: 27900, y: 6300 },
    { x: 35600, y: 2300 },
  ],
};
