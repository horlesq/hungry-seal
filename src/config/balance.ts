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
  /** Body radius at size 1 (scale 0.6); grows with the seal (30 px per unit of scale). */
  radius: 18,
  knockDecay: 4,
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
  /** Animated seals: swim cycles per second at full speed, and bite length (seconds). */
  swimCycleHz: 1.5,
  biteTime: 0.26,
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
  /**
   * Touch: a floating joystick where the finger lands. Drag distance (design units) for full
   * speed, and the centred fraction that doesn't steer.
   */
  stick: { radius: 90, deadzone: 0.12 },
} as const;

export const HUNGER = {
  max: 100,
  /** Drain at the start of a run; a full bar lasts max / this seconds without food. */
  baseDrainPerSec: 2.1,
  /** Drain grows linearly with run time: +100% after this many seconds. */
  rampSeconds: 360,
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
  stageCosts: [60, 130, 220, 340, 480, 650, 850],
  /**
   * Per stage, index 0 = stage 1 (docs/LEVEL_DESIGN.md metrics: the seal grows ~4x, 106 ->
   * 422 px long). Bite tier = stage number. `zoom` pulls the camera back as the seal grows so
   * a big seal still sees plenty of ocean around it.
   */
  stages: [
    { scale: 0.6, speedMult: 1, zoom: 1 },
    { scale: 0.75, speedMult: 1.04, zoom: 0.95 },
    { scale: 0.92, speedMult: 1.08, zoom: 0.89 },
    { scale: 1.12, speedMult: 1.12, zoom: 0.82 },
    { scale: 1.36, speedMult: 1.16, zoom: 0.75 },
    { scale: 1.64, speedMult: 1.21, zoom: 0.68 },
    { scale: 1.98, speedMult: 1.26, zoom: 0.61 },
    { scale: 2.4, speedMult: 1.3, zoom: 0.55 },
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
  /** Eating a puffed-up pufferfish: damage, knockback, stun. */
  pufferDamage: 14,
  pufferKnockback: 300,
  pufferStun: 0.4,
} as const;

export const SPAWN = {
  /**
   * Swimmers kept alive around the camera. Bigger prey (penguin, squid, turtle) take slots a
   * small seal can't eat, so this is higher than the edible density we actually want.
   */
  targetAlive: 44,
  /**
   * Edible swimmers (for the seal's current size) to keep within foodRadius of the view.
   * Below this, spawns are food only, even past targetAlive (up to maxAlive): eaten prey
   * vanish while big creatures linger.
   */
  minFood: 14,
  foodRadius: 1000,
  maxAlive: 58,
  /** Seconds between spawn attempts. */
  interval: 0.2,
  /** Spawn this far beyond the screen edge (min/max px). */
  marginMin: 80,
  marginMax: 340,
  /**
   * Creatures farther than this from the camera centre are recycled (at least: a zoomed-out
   * view pushes it out, see despawnRange). Counts and foodRadius above are for a 1455x720 view
   * and scale with the view's size (viewScale).
   */
  despawnDistance: 1500,
  /** Chance a spawn is placed ahead of the seal's movement. */
  aheadBias: 0.7,
  /** Seabirds alive at once (only while the view is near the surface), and spawn cadence. */
  maxFlyers: 3,
  skyInterval: 1.5,
  /** Groups placed around the seal when a run starts. */
  initialGroups: 7,
  initialMinDistance: 260,
} as const;

export const DAMAGE = {
  /** Seconds of invulnerability (flashing) after being hurt. */
  invulnTime: 1.2,
  /** Hunger reaching zero within this many seconds of a hit counts as killed by it. */
  killWindow: 0.6,
} as const;

export const COMBO = {
  /** Seconds after a meal in which the next meal continues the combo. */
  window: 2.2,
  /** Combo counts at which the score multiplier becomes x2, x3, x4, x5. */
  thresholds: [2, 5, 10, 16],
} as const;

export const COINS = {
  /** Chance a prey drops a coin when eaten, by tier (index = tier). */
  dropChanceByTier: [0, 0.1, 0.22, 0.35, 0.5, 1],
  /** Coin pickup radius around the seal centre (on top of the seal's body radius). */
  pickupRadius: 16,
  /** Coins inside this distance fly to the seal. */
  magnetRadius: 90,
  magnetSpeed: 700,
  /** Dropped coins disappear after this many seconds (blinking near the end). */
  dropLifetime: 10,
  /** Floating coin clusters kept around the camera, and coins per cluster. */
  clustersAlive: 2,
  clusterSize: [4, 7],
  clusterInterval: 3,
} as const;

/** Difficulty ramp: when hazards and predators start and how many are allowed. */
export const DANGER = {
  hazardsStartAt: 25,
  /** Max hazards alive = base + perMinute * minutes since start, capped. */
  hazardsBase: 2,
  hazardsPerMinute: 2,
  hazardsMax: 7,
  hazardSpawnInterval: 1.2,
  /** Seconds between spawn attempts per predator kind (spawn rules live in predators.ts). */
  predatorSpawnInterval: 6,
} as const;

export const FRENZY = {
  /** Meter per meal (x combo multiplier): ~28 plain meals, far fewer on a combo. */
  perMeal: 0.036,
  decayDelay: 3,
  decayPerSec: 0.04,
  duration: 8,
  speedMult: 1.3,
  scoreMult: 2,
  /** Coins within this distance fly to the seal during a frenzy. */
  magnetRadius: 280,
  /** Score for smashing through a hazard during a frenzy. */
  hazardScore: 50,
} as const;

export const PICKUPS = {
  /** Treasure chests sit on the seabed: at most one around, spawned while near the bottom. */
  chestCheckInterval: 6,
  chestNearFloor: 900,
  chestCoins: [12, 18],
  chestScore: 150,
  /** Chance a chest also holds a gem (the rare currency). */
  chestGemChance: 0.3,
  chestRadius: 30,
  /** Magnet orbs float in the water now and then; collect for a big coin magnet. */
  magnetInterval: 35,
  magnetLifetime: 30,
  magnetDuration: 12,
  magnetRadius: 320,
  orbRadius: 20,
} as const;

/** Brief freezes on impactful moments (seconds). */
export const HITSTOP = {
  eatBig: 0.05,
  hurt: 0.09,
  explode: 0.12,
} as const;

export const EFFECTS = {
  /** Min vertical speed for a surface crossing to make a splash. */
  splashMinSpeed: 140,
  /** Seconds between trail bubbles at full speed / boosting. */
  trailInterval: 0.045,
  /** Ambient bubbles spawned per second around the camera. */
  ambientBubblesPerSec: 3,
  /** Seconds an eaten creature takes to be pulled into the seal's mouth and shrink away. */
  gulpTime: 0.16,
} as const;
