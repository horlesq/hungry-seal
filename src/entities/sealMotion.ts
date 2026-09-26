// Seal movement model. Pure logic, no Phaser: the Seal game object feeds it input each
// frame and copies the resulting position/heading onto its sprite. Kept pure so the feel
// (turning, breaching, boost) is unit tested and tuned from config/balance.ts.
import { clamp, lerp, moveTowards, rotateTowards } from '../utils/math';

export interface SealMotionParams {
  maxSpeed: number;
  accel: number;
  decel: number;
  turnRateSlow: number;
  turnRateFast: number;
  levelOutRate: number;
  floorDeflectRate: number;
  steerDeadzone: number;
  radius: number;
  /** How fast a knockback impulse dies out (per second, exponential). */
  knockDecay: number;
  boost: {
    speedMult: number;
    accelMult: number;
    drainPerSec: number;
    regenPerSec: number;
    regenDelay: number;
    minToStart: number;
  };
  air: {
    gravity: number;
    control: number;
    maxFallSpeed: number;
    noseTurnRate: number;
  };
  surface: {
    minBreachSpeed: number;
    entrySpeedKeep: number;
  };
}

export interface SealMotionEnv {
  ceilingY: number;
  surfaceY: number;
  floorY: number;
}

export interface SealMotionInput {
  /** Desired direction; length 0..1 is the requested fraction of top speed. */
  steerX: number;
  steerY: number;
  boost: boolean;
}

export interface SealMotionState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Swim speed along the heading. Tracked separately so clamping vy doesn't bleed speed. */
  speed: number;
  /** Facing/travel direction in radians (0 = right, PI/2 = down). */
  heading: number;
  /** Boost stamina 0..1. */
  stamina: number;
  boosting: boolean;
  /** Seconds before stamina starts regenerating again. */
  regenDelay: number;
  inWater: boolean;
  /** Knockback velocity, added on top of swimming and decaying over time. */
  kx: number;
  ky: number;
}

export type SealMotionEvent =
  | { type: 'breach' | 'splashdown'; x: number; y: number; vx: number; vy: number }
  | { type: 'boostStart' | 'boostEnd' };

export function createSealMotionState(x: number, y: number): SealMotionState {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    speed: 0,
    heading: 0,
    stamina: 1,
    boosting: false,
    regenDelay: 0,
    inWater: true,
    kx: 0,
    ky: 0,
  };
}

/**
 * Shoves the seal (e.g. when hit). The impulse is separate from swimming so the seal keeps
 * facing the same way instead of snapping around.
 */
export function applyKnockback(s: SealMotionState, vx: number, vy: number): void {
  s.kx = vx;
  s.ky = vy;
}

export function stepSealMotion(
  s: SealMotionState,
  input: SealMotionInput,
  p: SealMotionParams,
  env: SealMotionEnv,
  dt: number,
): SealMotionEvent[] {
  const events: SealMotionEvent[] = [];

  updateBoost(s, input.boost, p, dt, events);
  if (s.inWater) swim(s, input, p, dt);
  else fly(s, input, p, dt);

  s.x += (s.vx + s.kx) * dt;
  s.y += (s.vy + s.ky) * dt;
  const decay = Math.exp(-p.knockDecay * dt);
  s.kx *= decay;
  s.ky *= decay;
  if (Math.abs(s.kx) < 1) s.kx = 0;
  if (Math.abs(s.ky) < 1) s.ky = 0;

  resolveSurface(s, p, env, events);
  resolveBounds(s, p, env, dt);
  return events;
}

function updateBoost(
  s: SealMotionState,
  wantsBoost: boolean,
  p: SealMotionParams,
  dt: number,
  events: SealMotionEvent[],
): void {
  const b = p.boost;
  const allowed = s.boosting ? s.stamina > 0 : s.stamina >= b.minToStart;
  const boosting = wantsBoost && s.inWater && allowed;

  if (boosting !== s.boosting) {
    s.boosting = boosting;
    events.push({ type: boosting ? 'boostStart' : 'boostEnd' });
  }

  if (s.boosting) {
    s.stamina = Math.max(0, s.stamina - b.drainPerSec * dt);
    s.regenDelay = b.regenDelay;
  } else if (s.regenDelay > 0) {
    s.regenDelay = Math.max(0, s.regenDelay - dt);
  } else {
    s.stamina = Math.min(1, s.stamina + b.regenPerSec * dt);
  }
}

function swim(s: SealMotionState, input: SealMotionInput, p: SealMotionParams, dt: number): void {
  const mag = Math.min(1, Math.hypot(input.steerX, input.steerY));
  const hasInput = mag > p.steerDeadzone;
  const topSpeed = p.maxSpeed * (s.boosting ? p.boost.speedMult : 1);

  if (hasInput) {
    const target = Math.atan2(input.steerY, input.steerX);
    const t = clamp(s.speed / p.maxSpeed, 0, 1);
    s.heading = rotateTowards(s.heading, target, lerp(p.turnRateSlow, p.turnRateFast, t) * dt);
  } else if (!s.boosting) {
    const level = Math.cos(s.heading) >= 0 ? 0 : Math.PI;
    s.heading = rotateTowards(s.heading, level, p.levelOutRate * dt);
  }

  // Boosting always drives at full speed along the current heading.
  const targetSpeed = s.boosting ? topSpeed : hasInput ? topSpeed * mag : 0;
  const rate = s.speed < targetSpeed ? p.accel * (s.boosting ? p.boost.accelMult : 1) : p.decel;
  s.speed = moveTowards(s.speed, targetSpeed, rate * dt);

  s.vx = Math.cos(s.heading) * s.speed;
  s.vy = Math.sin(s.heading) * s.speed;
}

function fly(s: SealMotionState, input: SealMotionInput, p: SealMotionParams, dt: number): void {
  s.vy = Math.min(s.vy + p.air.gravity * dt, p.air.maxFallSpeed);
  s.vx += clamp(input.steerX, -1, 1) * p.air.control * dt;
  s.speed = Math.hypot(s.vx, s.vy);
  // Nose follows the arc; skip near the apex of a vertical jump to avoid snapping.
  if (s.speed > 40) {
    s.heading = rotateTowards(s.heading, Math.atan2(s.vy, s.vx), p.air.noseTurnRate * dt);
  }
}

function resolveSurface(
  s: SealMotionState,
  p: SealMotionParams,
  env: SealMotionEnv,
  events: SealMotionEvent[],
): void {
  if (s.inWater) {
    if (s.y >= env.surfaceY) return;
    if (-s.vy >= p.surface.minBreachSpeed) {
      s.inWater = false;
      events.push({ type: 'breach', x: s.x, y: env.surfaceY, vx: s.vx, vy: s.vy });
    } else {
      // Too slow to jump: ride along the water line. Heading and speed are kept so the
      // seal can still turn upward and build enough speed to leap.
      s.y = env.surfaceY;
      if (s.vy < 0) s.vy = 0;
      if (s.ky < 0) s.ky = 0;
    }
    return;
  }

  if (s.y >= env.surfaceY) {
    s.inWater = true;
    events.push({ type: 'splashdown', x: s.x, y: env.surfaceY, vx: s.vx, vy: s.vy });
    s.vx *= p.surface.entrySpeedKeep;
    s.vy *= p.surface.entrySpeedKeep;
    s.speed = Math.hypot(s.vx, s.vy);
    if (s.speed > 1) s.heading = Math.atan2(s.vy, s.vx);
  }
}

function resolveBounds(
  s: SealMotionState,
  p: SealMotionParams,
  env: SealMotionEnv,
  dt: number,
): void {
  const floor = env.floorY - p.radius;
  if (s.y > floor) {
    s.y = floor;
    if (s.vy > 0) s.vy = 0;
    if (s.ky > 0) s.ky = 0;
    if (Math.sin(s.heading) > 0) {
      const level = Math.cos(s.heading) >= 0 ? 0 : Math.PI;
      s.heading = rotateTowards(s.heading, level, p.floorDeflectRate * dt);
    }
  }

  const ceiling = env.ceilingY + p.radius;
  if (s.y < ceiling) {
    s.y = ceiling;
    if (s.vy < 0) s.vy = 0;
  }
}
