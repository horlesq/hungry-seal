// World layout and depth zones. The world is endless horizontally and bounded vertically:
// sky (y < SURFACE) -> water column -> seabed (FLOOR).

export const WORLD = {
  /** Top of the sky; the seal can't go above this. */
  ceilingY: 0,
  /** The water line. Above = air (gravity), below = water. */
  surfaceY: 640,
  /** Seabed contact line. */
  floorY: 6400,
  /** Bottom of the camera/world bounds (a strip of seabed stays visible). */
  height: 6560,
  /** Pixels per displayed "meter" of depth in HUD/debug readouts. */
  pxPerMeter: 10,
} as const;

export type ZoneId = 'surface' | 'reef' | 'ocean' | 'deep' | 'abyss';

export interface Zone {
  id: ZoneId;
  name: string;
  /** World-y where the zone starts (inclusive). */
  top: number;
  /** Background water color at the top of the zone (CSS color). */
  color: string;
  /** One-liner shown on the banner when the seal swims into the zone. */
  blurb: string;
}

/** Ordered top to bottom. Each zone runs until the next zone's `top`. */
export const ZONES: readonly Zone[] = [
  { id: 'surface', name: 'Surface', top: WORLD.ceilingY, color: '#5ec8f2', blurb: '' },
  {
    id: 'reef',
    name: 'Shallows',
    top: WORLD.surfaceY,
    color: '#2ac6d8',
    blurb: 'Minnows, shrimp, penguins and pufferfish. Birds overhead!',
  },
  {
    id: 'ocean',
    name: 'Open Ocean',
    top: 1900,
    color: '#1a86bd',
    blurb: 'Sardines, squid, turtles... and sharks. Orcas later on',
  },
  {
    id: 'deep',
    name: 'The Deep',
    top: 3400,
    color: '#11427f',
    blurb: 'It gets dark. Lanternfish, sea mines... and a light you should not follow',
  },
  {
    id: 'abyss',
    name: 'Abyss',
    top: 5000,
    color: '#1c1a52',
    blurb: 'Crabs and sunken treasure on the seabed. Mind the anglerfish',
  },
];

/** Sky color right at the horizon (bottom of the sky gradient). */
export const SKY_HORIZON_COLOR = '#d4f4ff';
/** Water color at the seabed. */
export const FLOOR_COLOR = '#05060f';

export function zoneAt(y: number): Zone {
  for (let i = ZONES.length - 1; i >= 0; i--) {
    if (y >= ZONES[i].top) return ZONES[i];
  }
  return ZONES[0];
}

/** Bottom edge (exclusive) of a zone: the next zone's top, or the seabed. */
export function zoneBottom(id: ZoneId): number {
  const i = ZONES.findIndex((z) => z.id === id);
  return i >= 0 && i < ZONES.length - 1 ? ZONES[i + 1].top : WORLD.floorY;
}

/** Vertical span covered by a set of zones, clamped to the water column. */
export function zoneBand(ids: readonly ZoneId[]): { top: number; bottom: number } {
  let top = Infinity;
  let bottom = -Infinity;
  for (const id of ids) {
    const zone = ZONES.find((z) => z.id === id);
    if (!zone) continue;
    top = Math.min(top, zone.top);
    bottom = Math.max(bottom, zoneBottom(id));
  }
  return {
    top: Math.max(top, WORLD.surfaceY),
    bottom: Math.min(bottom, WORLD.floorY),
  };
}

/** 0 (clear) .. ~0.9 (nearly black) darkness at world-y `y`: starts just above the deep. */
export function darknessAt(y: number): number {
  const deepTop = ZONES.find((z) => z.id === 'deep')!.top;
  const abyssTop = ZONES.find((z) => z.id === 'abyss')!.top;
  const start = deepTop - 600;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));
  if (y <= start) return 0;
  if (y <= deepTop) return lerp(0, 0.35, (y - start) / 600);
  if (y <= abyssTop) return lerp(0.35, 0.75, (y - deepTop) / (abyssTop - deepTop));
  return lerp(0.75, 0.9, (y - abyssTop) / (WORLD.floorY - abyssTop));
}

/** Depth below the surface in meters (negative when airborne). */
export function depthMeters(y: number): number {
  return (y - WORLD.surfaceY) / WORLD.pxPerMeter;
}
