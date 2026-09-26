// All gameplay feel/tuning numbers live here. Units: px, seconds, radians.
import type { SealMotionParams } from '../entities/sealMotion';
import type { ZoneId } from './zones';

export const SEAL_MOTION: SealMotionParams = {
  maxSpeed: 430,
  accel: 950,
  decel: 520,
  // Turning is sharp when slow and wider at full speed, which gives arcing turns.
  turnRateSlow: 7.5,
  turnRateFast: 3.8,
  // When idle, the seal gently rolls back to a horizontal pose.
  levelOutRate: 1.6,
  floorDeflectRate: 7,
  steerDeadzone: 0.12,
  radius: 22,
  boost: {
    speedMult: 1.75,
    accelMult: 2.4,
    drainPerSec: 0.42,
    regenPerSec: 0.2,
    regenDelay: 0.6,
    minToStart: 0.15,
  },
  air: {
    gravity: 950,
    control: 160,
    maxFallSpeed: 1000,
    noseTurnRate: 9,
  },
  surface: {
    // Upward speed needed to leave the water; slower = ride along the surface.
    minBreachSpeed: 210,
    // Fraction of speed kept when splashing back in.
    entrySpeedKeep: 0.72,
  },
};

export const SEAL_VISUAL = {
  /** How fast the belly-roll flip happens when changing facing (per second). */
  flipRate: 11,
  /** Swim wiggle: radians of body wobble at full speed, and wobble frequency (Hz). */
  wiggleAmp: 0.07,
  wiggleFreq: 3.2,
  /** Stretch along the body at full speed. */
  stretch: 0.08,
} as const;

export const CAMERA = {
  lerpX: 0.09,
  lerpY: 0.11,
  /** Look-ahead = velocity * this many seconds, capped. */
  lookAheadTime: 0.38,
  lookAheadMaxX: 240,
  lookAheadMaxY: 150,
  lookAheadRate: 2.4,
} as const;

export const INPUT = {
  /**
   * Pointer distance (px) from the seal centre that means full speed. Kept short so that
   * pointing straight at nearby prey still chases at full speed (players aim at the fish).
   */
  pointerFullSpeedDist: 110,
  /** Pointer closer than this to the seal = no steering. Speed ramps up from here. */
  pointerDeadzone: 18,
} as const;

export const HUNGER = {
  max: 100,
  /** Drain at the start of a run; a full bar lasts max / this seconds without food. */
  baseDrainPerSec: 2.6,
  /** Drain grows linearly with run time: +100% after this many seconds. */
  rampSeconds: 240,
  /** Deeper water burns more energy. */
  zoneMultiplier: {
    surface: 1,
    reef: 1,
    ocean: 1.15,
    deep: 1.35,
    abyss: 1.6,
  } satisfies Record<ZoneId, number>,
  /** Below this fraction the HUD bar flashes. */
  lowFraction: 0.25,
} as const;

export const GROWTH = {
  /** Growth points to go from stage N to N+1 (index 0 = stage 1 -> 2). Max stage = length + 1. */
  stageCosts: [80, 200, 380, 600],
  /** Per stage, index 0 = stage 1. Bite tier = stage number. */
  stages: [
    { scale: 0.72, speedMult: 1 },
    { scale: 0.82, speedMult: 1.04 },
    { scale: 0.92, speedMult: 1.08 },
    { scale: 1.02, speedMult: 1.12 },
    { scale: 1.12, speedMult: 1.16 },
  ],
} as const;

export const FEEDING = {
  /** Mouth centre ahead of the seal centre, in seal-texture px (scales with growth). */
  mouthOffset: 58,
  /** Mouth radius in seal-texture px (scales with growth). */
  mouthRadius: 26,
  /** Fraction of speed kept after bumping into something too big to eat. */
  bumpSpeedKeep: 0.35,
  /** Seconds before the same creature can bump the seal again. */
  bumpCooldown: 0.6,
} as const;

export const SPAWN = {
  /** Creatures kept alive around the camera. */
  targetAlive: 30,
  /** Seconds between spawn attempts. */
  interval: 0.2,
  /** Spawn this far beyond the screen edge (min/max px). */
  marginMin: 80,
  marginMax: 340,
  /** Creatures farther than this from the camera centre are recycled. */
  despawnDistance: 1500,
  /** Chance a spawn is placed ahead of the seal's movement. */
  aheadBias: 0.7,
  /** Groups placed around the seal when a run starts. */
  initialGroups: 7,
  initialMinDistance: 260,
} as const;

export const EFFECTS = {
  /** Min vertical speed for a surface crossing to make a splash. */
  splashMinSpeed: 140,
  /** Seconds between trail bubbles at full speed / boosting. */
  trailInterval: 0.045,
  /** Ambient bubbles spawned per second around the camera. */
  ambientBubblesPerSec: 3,
} as const;
