// Map data model. A map is a bounded world: terrain (seabed profile + rock shapes), named
// regions with a danger rating, size gates (currents), collectibles, a boss lair, danger
// placements (eel dens, urchin beds, minefields, toxic zones, boat lanes), decor and colors.
// See docs/LEVEL_DESIGN.md for the metrics every dimension is sized from.
import type { TerrainDef } from '../../world/terrain';
import type { TextureKey } from '../assets';
import type { CreatureId } from '../creatures';
import type { PredatorId } from '../predators';
import type { ZoneId } from '../zones';

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
  /** Rock that sticks out above the water (islands, icebergs, beaches). */
  landRim: string;
  land: string;
  /** Strength of the rock speckle texture (default 0.22; canvas fallback renderer). */
  speckle?: number;
  /**
   * Material atlas tiles (0 rock, 1 sand, 2 coral stone, 3 plates) for: underwater rock, land,
   * top caps, deep rock.
   */
  tiles?: readonly [number, number, number, number];
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
  /** Keep exactly at y (don't snap to the ground), e.g. a pier over the water. */
  free?: boolean;
}

/** Scatters decor along upward-facing ground in a depth range (optionally an x range). */
export interface ScatterRule {
  keys: readonly TextureKey[];
  minY: number;
  maxY: number;
  minX?: number;
  maxX?: number;
  /** Average spacing in px along x. */
  spacing: number;
  scale?: readonly [number, number];
  hang?: boolean;
  /** Chance to draw in front. */
  front?: number;
}

/** A named stretch of the map with its own danger and creature mix. */
export interface RegionDef {
  id: string;
  name: string;
  /** One line for the region banner. */
  blurb: string;
  x0: number;
  x1: number;
  /** Optional depth band (a lair inside a wider region). */
  y0?: number;
  y1?: number;
  /** 1 (calm) .. 5 (deadly), shown on the banner and the map. */
  danger: number;
  creatureMult?: Partial<Record<CreatureId, number>>;
  predatorMult?: Partial<Record<PredatorId, number>>;
  /** Extra jellyfish drifting here (a bloom), as a multiplier on the hazard cap. */
  jellyBloom?: number;
}

/**
 * A size gate: a current inside a box that shoves seals smaller than `minStage` back the
 * way they came (`dir` points where the water pushes).
 */
export interface GateDef {
  x: number;
  y: number;
  w: number;
  h: number;
  dir: readonly [number, number];
  minStage: number;
}

export type BossId = 'kraken' | 'colossal' | 'abyssal';

export interface MapDef {
  id: MapId;
  name: string;
  blurb: string;
  /** Opens after this many pearls on `after`, or (older saves) this best score. */
  unlock: { after: MapId; pearls: number; score: number } | null;
  start: { x: number; y: number };
  palette: MapPalette;
  /** Zone names/blurbs (depth bands), shown when no region banner applies. */
  zones?: Partial<Record<ZoneId, { name: string; blurb: string }>>;
  /** Map-wide spawn weight multipliers (0 = absent on this map). */
  creatureMult?: Partial<Record<CreatureId, number>>;
  predatorMult?: Partial<Record<PredatorId, number>>;
  terrain: TerrainDef;
  regions: readonly RegionDef[];
  gates: readonly GateDef[];
  /** Six pearls per map (persistent collectibles). */
  pearls: ReadonlyArray<{ x: number; y: number }>;
  boss: { id: BossId; x: number; y: number; lairRadius: number };
  /** Cave walls where an eel hides; `dir` points from the wall into the water. */
  eelDens: ReadonlyArray<{ x: number; y: number; kind: 'moray' | 'electric'; dir: readonly [number, number] }>;
  /** Stretches of seabed covered in sea urchins. */
  urchinBeds: ReadonlyArray<{ x0: number; x1: number; minY: number; maxY: number }>;
  /** Mines on chains rising off the seabed. */
  minefields: ReadonlyArray<{ x0: number; x1: number; count: number }>;
  /** Clouds that drain hunger fast: toxic dumps and hot vents. */
  toxicZones: ReadonlyArray<{ x: number; y: number; r: number; kind: 'toxic' | 'heat' }>;
  /** Stretches of surface where fishing boats patrol. */
  boatLanes: ReadonlyArray<{ x0: number; x1: number }>;
  decor: readonly DecorPlacement[];
  scatter: readonly ScatterRule[];
  /** Treasure chest spots (caves, wrecks). */
  treasure: ReadonlyArray<{ x: number; y: number }>;
}
