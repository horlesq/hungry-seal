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
}

/** Ordered top to bottom. Each zone runs until the next zone's `top`. */
export const ZONES: readonly Zone[] = [
  { id: 'surface', name: 'Surface', top: WORLD.ceilingY, color: '#5ec8f2' },
  { id: 'reef', name: 'Shallows', top: WORLD.surfaceY, color: '#2ac6d8' },
  { id: 'ocean', name: 'Open Ocean', top: 1900, color: '#1a86bd' },
  { id: 'deep', name: 'The Deep', top: 3400, color: '#11427f' },
  { id: 'abyss', name: 'Abyss', top: 5000, color: '#1c1a52' },
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

/** Depth below the surface in meters (negative when airborne). */
export function depthMeters(y: number): number {
  return (y - WORLD.surfaceY) / WORLD.pxPerMeter;
}
