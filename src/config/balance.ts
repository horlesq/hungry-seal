// All gameplay feel/tuning numbers live here. Units: px, seconds, radians.
import type { SealMotionParams } from '../entities/sealMotion';

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
  /** Display scale of the stage-1 seal texture. */
  scale: 0.72,
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
  /** Pointer distance (px) from the seal that means full speed. */
  pointerFullSpeedDist: 230,
  /** Pointer closer than this to the seal = no steering. */
  pointerDeadzone: 22,
} as const;

export const EFFECTS = {
  /** Min vertical speed for a surface crossing to make a splash. */
  splashMinSpeed: 140,
  /** Seconds between trail bubbles at full speed / boosting. */
  trailInterval: 0.045,
  /** Ambient bubbles spawned per second around the camera. */
  ambientBubblesPerSec: 3,
} as const;
