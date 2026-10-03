// Seal Bay: the home map (docs/LEVEL_DESIGN.md section 4). West to east:
// West Beach -> Coral Gardens -> Kelp Forest -> Wreck Graveyard -> Gull Rock (rest) ->
// Shark Shelf -> The Trench (gate size 5) -> Kraken's Lair (gate size 7) -> Vent Ridge ->
// East Beach.
import { TextureKeys as T } from '../assets';
import { WORLD } from '../zones';
import {
  add,
  beachProfile,
  box,
  capsule,
  circle,
  cut,
  ellipse,
  grotto,
  island,
  MAP_WIDTH,
  PASSAGE,
  poly,
  S,
  spire,
  tunnel,
} from './helpers';
import type { MapDef } from './types';

const coralGrotto = grotto(5400, 1330, {
  rx: 380,
  ry: 230,
  width: PASSAGE.TIGHT,
  chamber: 90,
  entrance: 'left',
  bend: -30,
});
const ventCave = grotto(34000, 3900, {
  rx: 620,
  ry: 320,
  width: PASSAGE.OPEN,
  chamber: 230,
  entrance: 'top',
});

export const BAY: MapDef = {
  id: 'bay',
  name: 'Seal Bay',
  blurb: 'Beaches, reefs, a ship graveyard and the Kraken in the trench.',
  unlock: null,
  start: { x: 2500, y: 820 },
  palette: {
    sky: '#5ec8f2',
    horizon: '#d4f4ff',
    water: { reef: '#2ac6d8', ocean: '#1a86bd', deep: '#11427f', abyss: '#1c1a52' },
    floor: '#05060f',
    rockRim: '#c9a87a',
    rockTop: '#8a6d4f',
    rockDeep: '#2c2540',
    outline: '#1f1a26',
    landRim: '#f2dc9b',
    land: '#e2c27f',
  },
  terrain: {
    width: MAP_WIDTH,
    height: WORLD.height,
    seed: 11,
    floorRough: 20,
    floor: [
      ...beachProfile('west'),
      // Coral Gardens: a shallow reef shelf.
      [3200, 1480],
      [4200, 1640],
      [5200, 1580],
      [6200, 1760],
      [7200, 1700],
      [8000, 1860],
      // Kelp Forest: sloping down.
      [8800, 2300],
      [10000, 2700],
      [11200, 2950],
      [12000, 3150],
      // Wreck Graveyard ledge.
      [12600, 3300],
      [14000, 3350],
      [15500, 3400],
      [16400, 3350],
      [17000, 3200],
      // Gull Rock rises from a saddle.
      [18300, 3000],
      // Shark Shelf: open blue.
      [20500, 3650],
      [22000, 3850],
      [23500, 3750],
      [24400, 3950],
      // The Trench.
      [25000, 4600],
      [25500, 6000],
      [26000, 6350],
      [30000, 6350],
      [30500, 6000],
      [31000, 5200],
      // Vent Ridge climbing back up.
      [31600, 4800],
      [32500, 4500],
      [33500, 4200],
      [34500, 3500],
      [35500, 2600],
      [36500, 1700],
      ...beachProfile('east'),
    ],
    ops: [
      // Coral Gardens: an arch, coral mounds and the grotto (pearl 2, small seals only).
      add(ellipse(3700, 1260, 420, 230), { rough: 20, blend: 80 }),
      ...tunnel(
        [
          [3420, 1420],
          [3980, 1420],
        ],
        PASSAGE.OPEN,
      ),
      add(circle(4700, 1580, 150), { rough: 16, blend: 70 }),
      ...coralGrotto.ops,
      add(circle(6150, 1720, 170), { rough: 16, blend: 70 }),
      add(circle(7450, 1640, 140), { rough: 16, blend: 70 }),
      // Kelp Forest spires.
      spire(9300, 2450, 1750, 110),
      spire(10600, 2800, 2100, 130, 60),
      spire(11500, 3050, 2350, 100, -40),
      // The big wreck (enterable: pearl 3 inside), lying on the ledge.
      add(
        poly(
          [14300, 3060],
          [16100, 3040],
          [16000, 3240],
          [15700, 3390],
          [14700, 3390],
          [14400, 3250],
        ),
        { rough: 4, blend: 30 },
      ),
      cut(ellipse(15200, 3220, 700, 118), { blend: 20 }),
      ...tunnel(
        [
          [15450, 3225],
          [15900, 3210],
          [16300, 3140],
        ],
        220,
      ),
      cut(circle(14760, 3080, 70), { blend: 16 }),
      // Gull Rock: a rest island with a sea stack; pearl 4 floats above the stack (leap!).
      island(18200, 650, 300, 3000),
      add(capsule(19050, 3050, 19020, 600, 160, 110), { rough: 14, blend: 120 }),
      // A wide arch under the island so the whole map stays connected below the water.
      cut(ellipse(18200, 2300, 1350, 380), { blend: 40, rough: 10 }),
      // Shark Shelf: a mushroom rock (one stem, a wide cap to hide under) and a pillar.
      add(capsule(21700, 3950, 21700, 3000, 170, 120), { rough: 16, blend: 80 }),
      add(capsule(21150, 2880, 22250, 2860, 120, 130), { rough: 18, blend: 90 }),
      spire(23000, 3800, 2900, 150),
      // The Trench: an eel cave in the west wall (pearl 5)...
      cut(ellipse(25150, 5250, 260, 150), { blend: 30, rough: 10 }),
      ...tunnel(
        [
          [25150, 5250],
          [25750, 5260],
        ],
        200,
      ),
      // ...and the Kraken's lair: a rock dome with a cavern, entered from the top.
      add(ellipse(28300, 6050, 1300, 650), { rough: 26, blend: 160 }),
      cut(ellipse(28300, 6060, 760, 360), { blend: 40, rough: 12 }),
      ...tunnel(
        [
          [28300, 5800],
          [28300, 5250],
        ],
        320,
      ),
      // Vent Ridge: a cave with a chest, and a spire near the top.
      ...ventCave.ops,
      spire(36200, 1950, 1350, 100),
      // Keep the beach plateaus solid under the land props.
      add(box(250, S - 160, 600, 320, 40), { blend: 60 }),
      add(box(MAP_WIDTH - 250, S - 160, 600, 320, 40), { blend: 60 }),
    ],
  },
  regions: [
    { id: 'west-beach', name: 'West Beach', blurb: 'Sun, sand and an easy snack', x0: 0, x1: 2600, danger: 1 },
    {
      id: 'coral',
      name: 'Coral Gardens',
      blurb: 'Reef fish, pufferfish and a grotto only a small seal fits in',
      x0: 2600,
      x1: 8000,
      danger: 1,
      creatureMult: { pufferfish: 1.6, minnow: 1.3 },
    },
    {
      id: 'kelp',
      name: 'Kelp Forest',
      blurb: 'Mind the urchins on the floor. Barracuda hunt in packs',
      x0: 8000,
      x1: 12000,
      danger: 2,
    },
    {
      id: 'wrecks',
      name: 'Wreck Graveyard',
      blurb: 'Old mines around the wrecks, fishing boats overhead',
      x0: 12000,
      x1: 17000,
      danger: 3,
    },
    {
      id: 'gull-rock',
      name: 'Gull Rock',
      blurb: 'Catch your breath. Gulls love this island',
      x0: 17000,
      x1: 19500,
      danger: 1,
      creatureMult: { seabird: 2.5 },
      predatorMult: { shark: 0, orca: 0 },
    },
    {
      id: 'shark-shelf',
      name: 'Shark Shelf',
      blurb: 'Open water. Sharks patrol here; hammerheads too',
      x0: 19500,
      x1: 24500,
      danger: 4,
      predatorMult: { shark: 2.5 },
      jellyBloom: 1.5,
    },
    {
      id: 'trench',
      name: 'The Trench',
      blurb: 'A strong current at the mouth. Eels in the walls, poison at the bottom',
      x0: 24500,
      x1: 31000,
      danger: 4,
    },
    {
      id: 'lair',
      name: "Kraken's Lair",
      blurb: 'Something huge lives here',
      x0: 27540,
      x1: 29060,
      y0: 5700,
      y1: 6420,
      danger: 5,
      creatureMult: {},
      predatorMult: { shark: 0, orca: 0, anglerfish: 0 },
    },
    {
      id: 'vent-ridge',
      name: 'Vent Ridge',
      blurb: 'Hot vents and anglerfish caves on the way back up',
      x0: 31000,
      x1: 37400,
      danger: 3,
      predatorMult: { anglerfish: 2 },
    },
    {
      id: 'east-beach',
      name: 'East Beach',
      blurb: 'Made it across! The lighthouse keeps watch',
      x0: 37400,
      x1: MAP_WIDTH,
      danger: 1,
    },
  ],
  gates: [
    // An upwelling across the trench: below it is the deep trench (size 5).
    { x: 28000, y: 5080, w: 6300, h: 220, dir: [0, -1], minStage: 5 },
    // The lair entrance (size 7).
    { x: 28300, y: 5470, w: 380, h: 200, dir: [0, -1], minStage: 7 },
  ],
  pearls: [
    { x: 2000, y: 790 }, // 1: on the sand under the pier
    coralGrotto.chamber, // 2: the coral grotto (small seals only)
    { x: 15000, y: 3250 }, // 3: inside the big wreck
    { x: 19030, y: 420 }, // 4: above the sea stack (leap)
    { x: 25100, y: 5300 }, // 5: the eel cave in the trench wall
    { x: 28850, y: 6250 }, // 6: the Kraken's lair
  ],
  boss: { id: 'kraken', x: 28200, y: 6060, lairRadius: 760 },
  eelDens: [
    { x: 24900, y: 4500, kind: 'moray', dir: [1, 0] },
    { x: 25560, y: 5620, kind: 'moray', dir: [1, -0.2] },
    { x: 27050, y: 5900, kind: 'electric', dir: [-1, -0.3] },
    { x: 29550, y: 5900, kind: 'electric', dir: [1, -0.3] },
    { x: 33400, y: 4150, kind: 'moray', dir: [-0.3, -1] },
  ],
  urchinBeds: [
    { x0: 6000, x1: 6600, minY: 1500, maxY: 1950 },
    { x0: 9600, x1: 10200, minY: 2300, maxY: 3000 },
    { x0: 10800, x1: 11300, minY: 2600, maxY: 3100 },
  ],
  minefields: [{ x0: 13500, x1: 16800, count: 9 }],
  toxicZones: [
    { x: 26800, y: 6200, r: 380, kind: 'toxic' },
    { x: 32600, y: 4450, r: 300, kind: 'heat' },
    { x: 35000, y: 3150, r: 260, kind: 'heat' },
  ],
  boatLanes: [
    { x0: 12000, x1: 17000 },
    { x0: 19500, x1: 24500 },
  ],
  decor: [
    { key: T.DecorPalm, x: 350, y: S - 340 },
    { key: T.DecorPalm, x: 820, y: S - 330, flip: true, scale: 0.85 },
    { key: T.DecorLighthouse, x: 39500, y: S - 340 },
    { key: T.DecorPalm, x: 18050, y: 280 },
    { key: T.DecorShipwreck, x: 13100, y: 3250, scale: 0.8 },
    { key: T.DecorAnchor, x: 16500, y: 3350 },
    { key: T.DecorBarrel, x: 14200, y: 3350 },
    { key: T.DecorBarrel, x: 26700, y: 6300 },
    { key: T.DecorBarrel, x: 26950, y: 6300, flip: true },
    { key: T.DecorSkeleton, x: 28600, y: 6350 },
    { key: T.DecorVent, x: 32600, y: 4500 },
    { key: T.DecorVent, x: 35000, y: 3200, scale: 0.8 },
    { key: T.DecorClam, x: coralGrotto.chamber.x, y: coralGrotto.chamber.y + 60 },
  ],
  scatter: [
    {
      keys: [T.DecorShell, T.DecorStarfish],
      minY: S - 400,
      maxY: S + 700,
      spacing: 260,
    },
    {
      keys: [T.DecorCoralBranch, T.DecorCoralBrain, T.DecorCoralFan, T.DecorSeaweed, T.DecorStarfish],
      minY: S + 400,
      maxY: 2000,
      minX: 2600,
      maxX: 8000,
      spacing: 110,
      front: 0.15,
    },
    {
      keys: [T.DecorKelp, T.DecorKelp, T.DecorSeaweed],
      minY: 2000,
      maxY: 3300,
      minX: 8000,
      maxX: 12200,
      spacing: 90,
      scale: [0.9, 1.4],
      front: 0.2,
    },
    {
      keys: [T.DecorBoulder, T.DecorSeaweed, T.DecorBarrel],
      minY: 3000,
      maxY: 3600,
      minX: 12000,
      maxX: 17000,
      spacing: 300,
    },
    {
      keys: [T.DecorBoulder, T.DecorUrchin, T.DecorAnemone],
      minY: 3400,
      maxY: 6500,
      minX: 19500,
      maxX: 37400,
      spacing: 260,
    },
  ],
  treasure: [
    { x: 3700, y: 1530 },
    { x: 13300, y: 3300 },
    { x: 25900, y: 6300 },
    ventCave.chamber,
  ],
};
