// Creature movement/behavior. Pure logic, no Phaser: the Creature sprite owns a
// CreatureMotion and calls stepCreatureMotion each frame with a context describing the
// threat (the seal), its depth band and, for school members, the school leader.
//
// Priority: flee > follow school leader > wander/drift. Band keeping and a hard clamp to the
// water column apply on top.
import type { BehaviorId, CreatureDef } from '../config/creatures';
import { moveTowards, rotateTowards } from '../utils/math';

export interface CreatureMotionParams {
  speed: number;
  fleeSpeed: number;
  turnRate: number;
  accel: number;
  fleeRadius: number;
  flee: boolean;
  drift: boolean;
}

export interface CreatureMotion {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  speed: number;
  /** Heading the creature is wandering toward. */
  targetHeading: number;
  wanderTimer: number;
  /** > 0 while fleeing; keeps fleeing briefly after the threat leaves the radius. */
  fleeTimer: number;
  /** Fixed per-flee angle offset so a school scatters instead of moving as one. */
  fleeJitter: number;
  age: number;
}

export interface CreatureSteerContext {
  threatX: number;
  threatY: number;
  /** Only a threat that can eat this creature makes it flee. */
  threatActive: boolean;
  /** Preferred vertical range (from the creature's zones). */
  bandTop: number;
  bandBottom: number;
  /** Absolute vertical limits (inside the water). */
  hardTop: number;
  hardBottom: number;
  /** School leader to follow, or null for leaders and loners. */
  leader: CreatureMotion | null;
  slotX: number;
  slotY: number;
  random: () => number;
}

const BAND_MARGIN = 70;
const FLEE_MEMORY = 0.9;
const SCHOOL_PULL = 2.2;
const FLEE_TURN_BOOST = 1.6;
const DRIFT_BOB = 18;

export function motionParamsFor(def: CreatureDef): CreatureMotionParams {
  const has = (b: BehaviorId) => def.behaviors.includes(b);
  return {
    speed: def.speed,
    fleeSpeed: def.fleeSpeed,
    turnRate: def.turnRate,
    accel: def.accel,
    fleeRadius: def.fleeRadius,
    flee: has('flee'),
    drift: has('drift'),
  };
}

export function createCreatureMotion(x: number, y: number, heading: number): CreatureMotion {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    heading,
    speed: 0,
    targetHeading: heading,
    wanderTimer: 0,
    fleeTimer: 0,
    fleeJitter: 0,
    age: 0,
  };
}

/** Makes the creature bolt away from (x, y) for a moment, e.g. after bumping the seal. */
export function startle(m: CreatureMotion, random: () => number): void {
  m.fleeTimer = FLEE_MEMORY;
  m.fleeJitter = (random() - 0.5) * 0.8;
}

export function stepCreatureMotion(
  m: CreatureMotion,
  p: CreatureMotionParams,
  ctx: CreatureSteerContext,
  dt: number,
): void {
  m.age += dt;

  if (p.flee && ctx.threatActive) {
    const dx = m.x - ctx.threatX;
    const dy = m.y - ctx.threatY;
    if (dx * dx + dy * dy < p.fleeRadius * p.fleeRadius) {
      if (m.fleeTimer <= 0) m.fleeJitter = (ctx.random() - 0.5) * 0.8;
      m.fleeTimer = FLEE_MEMORY;
    }
  }

  let target: number;
  let targetSpeed: number;
  const fleeing = m.fleeTimer > 0;

  if (fleeing) {
    m.fleeTimer -= dt;
    target = Math.atan2(m.y - ctx.threatY, m.x - ctx.threatX) + m.fleeJitter;
    targetSpeed = p.fleeSpeed;
  } else if (ctx.leader) {
    // Steer toward our slot next to the leader while matching its velocity.
    const tx = ctx.leader.x + ctx.slotX;
    const ty = ctx.leader.y + ctx.slotY;
    const dvx = (tx - m.x) * SCHOOL_PULL + ctx.leader.vx;
    const dvy = (ty - m.y) * SCHOOL_PULL + ctx.leader.vy;
    const len = Math.hypot(dvx, dvy);
    target = len > 1 ? Math.atan2(dvy, dvx) : m.heading;
    targetSpeed = Math.min(len, p.fleeSpeed);
  } else {
    m.wanderTimer -= dt;
    if (m.wanderTimer <= 0) {
      // Fish mostly cruise horizontally: usually keep direction, tilt a little.
      const goingRight = Math.cos(m.targetHeading) >= 0;
      const goRight = ctx.random() < 0.8 ? goingRight : !goingRight;
      const tilt = (ctx.random() - 0.5) * 0.9;
      m.targetHeading = goRight ? tilt : Math.PI - tilt;
      m.wanderTimer = 1.5 + ctx.random() * 2.5;
    }
    target = m.targetHeading;
    targetSpeed = p.drift ? p.speed * (0.55 + 0.45 * Math.sin(m.age * 2.1)) : p.speed;
  }

  // Stay inside the preferred depth band.
  const right = Math.cos(target) >= 0;
  if (m.y < ctx.bandTop + BAND_MARGIN && Math.sin(target) < 0.35) {
    target = right ? 0.5 : Math.PI - 0.5;
    if (!fleeing && !ctx.leader) m.targetHeading = target;
  } else if (m.y > ctx.bandBottom - BAND_MARGIN && Math.sin(target) > -0.35) {
    target = right ? -0.5 : -(Math.PI - 0.5);
    if (!fleeing && !ctx.leader) m.targetHeading = target;
  }

  const turn = p.turnRate * (fleeing ? FLEE_TURN_BOOST : 1) * dt;
  m.heading = rotateTowards(m.heading, target, turn);
  m.speed = moveTowards(m.speed, targetSpeed, p.accel * dt);
  m.vx = Math.cos(m.heading) * m.speed;
  m.vy = Math.sin(m.heading) * m.speed;
  if (p.drift && !fleeing) m.vy += Math.sin(m.age * 3.3) * DRIFT_BOB;

  m.x += m.vx * dt;
  m.y += m.vy * dt;
  if (m.y < ctx.hardTop) m.y = ctx.hardTop;
  else if (m.y > ctx.hardBottom) m.y = ctx.hardBottom;
}
