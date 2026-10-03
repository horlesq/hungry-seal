// Map definitions. Each map is a bounded world: a seabed profile plus rock shapes added
// (islands, reefs, icebergs) or cut out (caves, tunnels, arches), its own colors, decor and
// creature mix. The vertical layout (sky, water line, depth zones) is shared by all maps
// (config/zones.ts), so zones, darkness and missions work the same everywhere.
import type { TerrainDef, TerrainOp, TerrainShape } from '../world/terrain';
import { TextureKeys, type TextureKey } from './assets';
import type { CreatureId } from './creatures';
import type { PredatorId } from './predators';
import { WORLD, type ZoneId } from './zones';

export type MapId = 'bay' | 'arctic' | 'tropical';

export interface MapPalette {
  /** Sky at the top, and the water color at the top of each zone, then at the seabed. */
  sky: string;
  horizon: string;
  water: Record<Exclude<ZoneId, 'surface'>, string>;
  floor: string;
  /** Rock: lit rim, body color at the surface and in the depths, outline. */
  rockRim: string;
  rockTop: string;
  rockDeep: string;
  outline: string;
  /** Rock that sticks out above the water (islands, icebergs). */
  landRim: string;
  land: string;
  /** Strength of the rock speckle texture (default 0.22). */
  speckle?: number;
}

export interface DecorPlacement {
  key: TextureKey;
  x: number;
  /** World-y of the decor's base (it's snapped down onto the ground below this point). */
  y: number;
  scale?: number;
  flip?: boolean;
  /** Hangs from the rock above instead of standing on the ground (icicles). */
  hang?: boolean;
  /** Draw in front of the seal and creatures. */
  front?: boolean;
}

/** Scatters decor along upward-facing ground in a depth range. */
export interface ScatterRule {
  keys: readonly TextureKey[];
  minY: number;
  maxY: number;
  /** Average spacing in px along x. */
  spacing: number;
  scale?: readonly [number, number];
  hang?: boolean;
  front?: number; // chance to draw in front
}

export interface MapDef {
  id: MapId;
  name: string;
  blurb: string;
  /** Unlocked by scoring this much in one run (on any map); null = always open. */
  unlockScore: number | null;
  start: { x: number; y: number };
  palette: MapPalette;
  /** Zone names/blurbs shown on the zone banners. */
  zones?: Partial<Record<ZoneId, { name: string; blurb: string }>>;
  /** Spawn weight multipliers (0 = absent on this map). */
  creatureMult?: Partial<Record<CreatureId, number>>;
  predatorMult?: Partial<Record<PredatorId, number>>;
  terrain: TerrainDef;
  decor: readonly DecorPlacement[];
  scatter: readonly ScatterRule[];
  /** Treasure chest spots (caves, wrecks). */
  treasure: ReadonlyArray<{ x: number; y: number }>;
}

// ---------------------------------------------------------------------------------------
// Shape helpers
// ---------------------------------------------------------------------------------------

type Opts = { blend?: number; rough?: number };
const add = (shape: TerrainShape, o: Opts = {}): TerrainOp => ({ mode: 'add', shape, ...o });
const cut = (shape: TerrainShape, o: Opts = {}): TerrainOp => ({ mode: 'cut', shape, ...o });
const circle = (x: number, y: number, r: number): TerrainShape => ({ type: 'circle', x, y, r });
const ellipse = (x: number, y: number, rx: number, ry: number, rot = 0): TerrainShape => ({
  type: 'ellipse',
  x,
  y,
  rx,
  ry,
  rot,
});
const box = (x: number, y: number, w: number, h: number, round = 20, rot = 0): TerrainShape => ({
  type: 'box',
  x,
  y,
  w,
  h,
  round,
  rot,
});
const poly = (...points: Array<[number, number]>): TerrainShape => ({ type: 'poly', points });
const capsule = (x1: number, y1: number, x2: number, y2: number, r1: number, r2 = r1) =>
  ({ type: 'capsule', x1, y1, x2, y2, r1, r2 }) as TerrainShape;

/** A winding tunnel: capsules along a path, cut out of the rock. */
function tunnel(points: Array<[number, number]>, r: number, o: Opts = {}): TerrainOp[] {
  const ops: TerrainOp[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    ops.push(cut(capsule(x1, y1, x2, y2, r), { blend: 30, ...o }));
  }
  return ops;
}

/** A rock ring you can swim through. */
function ring(x: number, y: number, outer: number, inner: number): TerrainOp[] {
  return [add(circle(x, y, outer), { rough: 18 }), cut(circle(x, y, inner), { blend: 20 })];
}

const S = WORLD.surfaceY;

// ---------------------------------------------------------------------------------------
// Seal Bay: the home map. Island and reef on the left, kelp slope, wreck ledge, a deep
// trench with a cave system in the middle, rock pillars and a second island on the right.
// ---------------------------------------------------------------------------------------

const BAY: MapDef = {
  id: 'bay',
  name: 'Seal Bay',
  blurb: 'Reefs, a sunken ship and the caves under the trench.',
  unlockScore: null,
  start: { x: 2000, y: 1050 },
  palette: {
    sky: '#5ec8f2',
    horizon: '#d4f4ff',
    water: { reef: '#2ac6d8', ocean: '#1a86bd', deep: '#11427f', abyss: '#1c1a52' },
    floor: '#05060f',
    rockRim: '#c9a87a',
    rockTop: '#8a6d4f',
    rockDeep: '#2c2540',
    outline: '#1f1a26',
    landRim: '#7ccf5a',
    land: '#9b7b55',
  },
  terrain: {
    width: 16000,
    height: WORLD.height,
    seed: 11,
    floorRough: 22,
    floor: [
      [0, 1500],
      [1300, 1520],
      [1900, 1780],
      [3600, 1820],
      [4300, 2600],
      [5400, 3100],
      [6200, 3320],
      [7600, 3360],
      [8300, 4600],
      [9100, 5700],
      [9900, 6300],
      [11500, 6340],
      [12100, 5300],
      [13300, 4400],
      [14400, 2700],
      [15200, 1550],
      [16000, 1350],
    ],
    ops: [
      // Left island with a lighthouse.
      add(
        poly([-200, 1600], [-200, 430], [300, 360], [700, 400], [1000, 520], [1150, 700], [1280, 1600]),
        { rough: 14, blend: 40 },
      ),
      // Reef arch and coral heads in the shallows.
      add(ellipse(2700, 1520, 420, 280), { rough: 20, blend: 60 }),
      cut(capsule(2420, 1700, 2980, 1700, 125), { blend: 30 }),
      add(circle(3460, 1720, 140), { rough: 16, blend: 50 }),
      add(circle(1960, 1720, 100), { rough: 14, blend: 50 }),
      // Kelp slope pillars.
      add(capsule(4650, 2250, 4720, 2900, 110, 150), { rough: 18, blend: 60 }),
      add(capsule(5150, 2650, 5120, 3200, 90, 140), { rough: 18, blend: 60 }),
      // Overhang above the wreck ledge.
      add(ellipse(6250, 2650, 330, 210, -0.2), { rough: 20, blend: 80 }),
      // A rock ring in open water.
      ...ring(7900, 2650, 270, 150),
      // The trench caves: a big rock mass with winding tunnels and a treasure chamber.
      add(ellipse(10900, 4750, 1300, 900), { rough: 30, blend: 140 }),
      ...tunnel(
        [
          [9750, 4150],
          [10300, 4450],
          [10900, 4300],
          [11500, 4600],
          [12150, 4500],
        ],
        115,
      ),
      ...tunnel(
        [
          [10600, 4420],
          [10700, 5000],
          [10950, 5300],
        ],
        100,
      ),
      cut(circle(10980, 5380, 230), { blend: 40, rough: 12 }),
      ...tunnel(
        [
          [11500, 4600],
          [11700, 3950],
        ],
        100,
      ),
      // Deep pillars.
      add(capsule(12750, 3750, 12800, 4800, 150, 190), { rough: 22, blend: 80 }),
      add(capsule(13700, 3300, 13650, 3900, 90, 130), { rough: 18, blend: 60 }),
      // Right island and its sea stack.
      add(
        poly([14900, 1700], [15100, 600], [15350, 420], [15700, 380], [16200, 420], [16200, 1700]),
        { rough: 14, blend: 40 },
      ),
      add(capsule(14480, 380, 14520, 2700, 95, 150), { rough: 12, blend: 80 }),
    ],
  },
  decor: [
    { key: TextureKeys.DecorLighthouse, x: 470, y: 300 },
    { key: TextureKeys.DecorPalm, x: 15600, y: 300, flip: true },
    { key: TextureKeys.DecorShipwreck, x: 6950, y: 3200 },
    { key: TextureKeys.DecorAnchor, x: 7480, y: 3300 },
    { key: TextureKeys.DecorBarrel, x: 6400, y: 3300 },
    { key: TextureKeys.DecorSkeleton, x: 10980, y: 5500 },
    { key: TextureKeys.DecorClam, x: 2700, y: 1800 },
  ],
  scatter: [
    {
      keys: [
        TextureKeys.DecorCoralBranch,
        TextureKeys.DecorCoralBrain,
        TextureKeys.DecorCoralFan,
        TextureKeys.DecorStarfish,
        TextureKeys.DecorShell,
        TextureKeys.DecorSeaweed,
      ],
      minY: S + 200,
      maxY: 2000,
      spacing: 120,
      front: 0.15,
    },
    {
      keys: [TextureKeys.DecorKelp, TextureKeys.DecorKelp, TextureKeys.DecorSeaweed],
      minY: 2000,
      maxY: 3500,
      spacing: 110,
      scale: [0.8, 1.3],
      front: 0.2,
    },
    {
      keys: [TextureKeys.DecorBoulder, TextureKeys.DecorUrchin, TextureKeys.DecorAnemone],
      minY: 3400,
      maxY: 6500,
      spacing: 260,
    },
  ],
  treasure: [
    { x: 10980, y: 5560 },
    { x: 7300, y: 3300 },
    { x: 2700, y: 1780 },
  ],
};

// ---------------------------------------------------------------------------------------
// Arctic: ice floes on the surface, icebergs reaching deep, an ice cave and a seamount arch.
// ---------------------------------------------------------------------------------------

const ARCTIC: MapDef = {
  id: 'arctic',
  name: 'Arctic',
  blurb: 'Ice floes, icebergs and penguins. Watch out for orcas.',
  unlockScore: 12000,
  start: { x: 2150, y: 1000 },
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
    land: '#d6eef9',
    speckle: 0.07,
  },
  zones: {
    reef: { name: 'Ice Shelf', blurb: 'Penguins under the floes. Leap through the gaps!' },
    ocean: { name: 'Cold Current', blurb: 'Icebergs, squid... and orcas on the hunt' },
    deep: { name: 'Frozen Deep', blurb: 'Dark and cold. Follow the glow at your peril' },
    abyss: { name: 'Abyss', blurb: 'The seamount arch hides treasure' },
  },
  creatureMult: { turtle: 0, pufferfish: 0, penguin: 3, seabird: 1.4, squid: 1.3 },
  predatorMult: { orca: 2, shark: 0.6 },
  terrain: {
    width: 14000,
    height: WORLD.height,
    seed: 23,
    floorRough: 18,
    floor: [
      [0, 1350],
      [1400, 1400],
      [2400, 2300],
      [4000, 2600],
      [5200, 3600],
      [6800, 4200],
      [7600, 5600],
      [9200, 6300],
      [10400, 6250],
      [11200, 5000],
      [12400, 3800],
      [13200, 2100],
      [14000, 1500],
    ],
    ops: [
      // Ice floes along the surface (gaps between them to breathe and leap).
      add(box(950, S + 10, 1700, 170, 50), { rough: 8 }),
      add(box(2650, S + 15, 700, 140, 45), { rough: 8 }),
      add(box(3900, S + 10, 900, 160, 50), { rough: 8 }),
      add(box(5250, S + 15, 600, 130, 45), { rough: 8 }),
      add(box(11900, S + 10, 1100, 160, 50), { rough: 8 }),
      // Icebergs: small tips above the water, huge bodies below.
      add(
        poly(
          [6700, 700],
          [6820, 400],
          [6960, 320],
          [7100, 430],
          [7260, 660],
          [7330, 1300],
          [7120, 1950],
          [6900, 1750],
          [6740, 1200],
        ),
        { rough: 16, blend: 30 },
      ),
      add(
        poly([9700, 690], [9820, 470], [9990, 430], [10120, 620], [10180, 1100], [9980, 1450], [9760, 1100]),
        { rough: 14, blend: 30 },
      ),
      // Ice cave in the shelf slope.
      add(ellipse(4600, 3150, 760, 400, 0.1), { rough: 24, blend: 120 }),
      ...tunnel(
        [
          [3900, 3050],
          [4600, 3170],
          [5300, 2950],
        ],
        100,
      ),
      cut(circle(4620, 3260, 170), { blend: 40 }),
      // Seamount with an arch in the abyss.
      add(circle(8500, 5550, 620), { rough: 26, blend: 160 }),
      cut(ellipse(8500, 5720, 300, 230), { blend: 40, rough: 10 }),
      // Glacier wall on the far right.
      add(poly([13300, 2200], [13350, 300], [13600, 220], [14200, 260], [14200, 2200]), {
        rough: 16,
        blend: 60,
      }),
    ],
  },
  decor: [
    { key: TextureKeys.DecorIgloo, x: 900, y: S - 60 },
    { key: TextureKeys.DecorIgloo, x: 11950, y: S - 60, flip: true },
    { key: TextureKeys.DecorSkeleton, x: 8500, y: 5900 },
    { key: TextureKeys.DecorAnchor, x: 4650, y: 3400 },
  ],
  scatter: [
    { keys: [TextureKeys.DecorIcicle], minY: S, maxY: 2200, spacing: 70, hang: true },
    {
      keys: [TextureKeys.DecorIceChunk, TextureKeys.DecorSeaweed, TextureKeys.DecorStarfish],
      minY: S + 200,
      maxY: 3000,
      spacing: 170,
    },
    {
      keys: [TextureKeys.DecorKelp, TextureKeys.DecorUrchin, TextureKeys.DecorBoulder],
      minY: 3000,
      maxY: 6500,
      spacing: 220,
    },
  ],
  treasure: [
    { x: 4620, y: 3420 },
    { x: 8500, y: 5940 },
  ],
};

// ---------------------------------------------------------------------------------------
// Tropical Lagoon: shallow coral lagoon, sunken ruins, a volcanic island with a lava tube,
// and a deep trench with hot vents.
// ---------------------------------------------------------------------------------------

const TROPICAL: MapDef = {
  id: 'tropical',
  name: 'Tropical Lagoon',
  blurb: 'Coral gardens, sunken ruins and a volcano with a tunnel through it.',
  unlockScore: 30000,
  start: { x: 2000, y: 900 },
  palette: {
    sky: '#4cc3f5',
    horizon: '#fff4c9',
    water: { reef: '#19d3cf', ocean: '#1497c6', deep: '#0e4f8e', abyss: '#1b1650' },
    floor: '#06050f',
    rockRim: '#f3dca0',
    rockTop: '#b98f60',
    rockDeep: '#3a2440',
    outline: '#241826',
    landRim: '#5fd16b',
    land: '#6b5a4a',
  },
  zones: {
    reef: { name: 'Lagoon', blurb: 'Coral gardens full of fish, pufferfish and turtles' },
    ocean: { name: 'Coral Sea', blurb: 'Sunken ruins and sharks on patrol' },
    deep: { name: 'Twilight', blurb: 'Lanternfish and hot vents. Something glows down there' },
    abyss: { name: 'Trench', blurb: 'The deepest trench. Treasure for the brave' },
  },
  creatureMult: { penguin: 0, turtle: 2, pufferfish: 2, minnow: 1.2 },
  predatorMult: { shark: 1.3, orca: 0.5 },
  terrain: {
    width: 16000,
    height: WORLD.height,
    seed: 37,
    floorRough: 20,
    floor: [
      [0, 1150],
      [1500, 1180],
      [3200, 1380],
      [4200, 1520],
      [5200, 2050],
      [6400, 2450],
      [7200, 2450],
      [8200, 3200],
      [9000, 4600],
      [9600, 5800],
      [10800, 6350],
      [12000, 6300],
      [12600, 5200],
      [13400, 3600],
      [14400, 1800],
      [15200, 1250],
      [16000, 1050],
    ],
    ops: [
      // Sandy island on the left.
      add(poly([-200, 1250], [-200, 540], [350, 500], [700, 560], [900, 760], [1000, 1250]), {
        rough: 10,
        blend: 40,
      }),
      // Coral heads and an arch in the lagoon.
      add(circle(1900, 1200, 110), { rough: 14, blend: 50 }),
      add(circle(3000, 1330, 130), { rough: 14, blend: 50 }),
      add(ellipse(2450, 1150, 300, 200), { rough: 16, blend: 50 }),
      cut(capsule(2250, 1260, 2650, 1260, 90), { blend: 25 }),
      // Sunken ruins: broken columns and a fallen slab.
      add(box(5750, 2000, 70, 380, 10), { rough: 4 }),
      add(box(5980, 2080, 70, 300, 10), { rough: 4 }),
      add(box(6210, 2150, 70, 420, 10), { rough: 4 }),
      add(box(5980, 1830, 600, 60, 10, 0.05), { rough: 4 }),
      // The volcano: rises far above the water; a lava tube runs under it.
      add(
        poly(
          [6900, 2700],
          [7450, 900],
          [7780, 200],
          [7950, 160],
          [8120, 200],
          [8400, 900],
          [8900, 2300],
          [9000, 3900],
          [8300, 3500],
        ),
        { rough: 22, blend: 240 },
      ),
      cut(ellipse(7950, 150, 110, 60), { blend: 30 }),
      ...tunnel(
        [
          [7000, 1650],
          [7600, 1850],
          [8300, 1750],
          [8900, 2000],
        ],
        125,
      ),
      // Trench walls with ledges.
      add(capsule(9800, 4700, 9650, 5900, 150, 230), { rough: 24, blend: 120 }),
      add(ellipse(11700, 5600, 420, 260), { rough: 22, blend: 120 }),
      cut(circle(11750, 5700, 150), { blend: 30 }),
      // Right island with palms.
      add(
        poly([15000, 1300], [15150, 640], [15450, 520], [15800, 540], [16200, 600], [16200, 1300]),
        { rough: 10, blend: 40 },
      ),
    ],
  },
  decor: [
    { key: TextureKeys.DecorPalm, x: 300, y: 480 },
    { key: TextureKeys.DecorPalm, x: 620, y: 520, flip: true, scale: 0.85 },
    { key: TextureKeys.DecorPalm, x: 15450, y: 480 },
    { key: TextureKeys.DecorStatue, x: 5450, y: 2050 },
    { key: TextureKeys.DecorColumn, x: 6450, y: 2300, scale: 0.9 },
    { key: TextureKeys.DecorVent, x: 10500, y: 6300 },
    { key: TextureKeys.DecorVent, x: 11300, y: 6300, scale: 0.8 },
    { key: TextureKeys.DecorClam, x: 11750, y: 5800 },
  ],
  scatter: [
    {
      keys: [
        TextureKeys.DecorCoralBranch,
        TextureKeys.DecorCoralBrain,
        TextureKeys.DecorCoralFan,
        TextureKeys.DecorAnemone,
        TextureKeys.DecorStarfish,
        TextureKeys.DecorShell,
      ],
      minY: S + 200,
      maxY: 2600,
      spacing: 95,
      front: 0.15,
    },
    {
      keys: [TextureKeys.DecorSeaweed, TextureKeys.DecorUrchin, TextureKeys.DecorBoulder],
      minY: 2600,
      maxY: 6500,
      spacing: 230,
    },
  ],
  treasure: [
    { x: 11750, y: 5840 },
    { x: 5980, y: 2350 },
    { x: 7950, y: 1900 },
  ],
};

export const MAPS: Record<MapId, MapDef> = { bay: BAY, arctic: ARCTIC, tropical: TROPICAL };
export const MAP_ORDER: readonly MapId[] = ['bay', 'arctic', 'tropical'];
