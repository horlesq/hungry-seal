// Creature movement/behavior. Pure logic, no Phaser: the Creature sprite owns a
// CreatureMotion and calls stepCreatureMotion each frame with a context describing the
// threat (the seal), its depth band and, for school members, the school leader.
//
// Priority: flee > follow school leader > wander/drift. Band keeping and a hard clamp to the
// creature's medium (water column, or the air for flyers) apply on top. Jetters (squid) move
// in bursts: a sudden kick to high speed that decays back to cruising.
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
  jet: boolean;
  /** Walks along the bottom of its band (the seabed) instead of swimming. */
  walk: boolean;
  /** Puffs up (and slows down) when the seal gets close, instead of fleeing. */
  puff: boolean;
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
  /** Seconds until the next jet burst (jetters only). */
  jetTimer: number;
  /** Puffers: currently inflated, seconds of puff left, and recovery before it can puff again. */
  puffed: boolean;
  puffTimer: number;
  puffCooldown: number;
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
  /** Solid terrain to steer around (and, for walkers, to walk on). */
  terrain?: CreatureTerrain;
  /** Body radius, for keeping clear of rock. */
  radius?: number;
}

export interface CreatureTerrain {
  distance(x: number, y: number): number;
  normal(x: number, y: number, out: { x: number; y: number }): { x: number; y: number };
  groundBelow(x: number, y: number, maxScan?: number): number | null;
}

const wallNormal = { x: 0, y: 0 };
/** Walkers turn back where the ground steps more than this between frames' probes. */
const WALK_MAX_STEP = 26;

const BAND_MARGIN = 70;
const FLEE_MEMORY = 0.9;
const SCHOOL_PULL = 2.2;
const FLEE_TURN_BOOST = 1.6;
const DRIFT_BOB = 18;
/**
 * Puffers inflate when the seal comes this close, stay puffed for PUFF_TIME, then need
 * PUFF_RECOVER seconds before they can puff again: the window to eat one without a sting.
 */
export const PUFF_RADIUS = 170;
export const PUFF_TIME = 2;
export const PUFF_RECOVER = 2.5;

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
    jet: has('jet'),
    walk: has('walk'),
    puff: has('puff'),
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
    jetTimer: 0,
    puffed: false,
    puffTimer: 0,
    puffCooldown: 0,
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
    // Jetters escape in rapid bursts rather than at a steady top speed.
    targetSpeed = p.jet ? p.speed * 1.5 : p.fleeSpeed;
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

  // Puffers blow up (and nearly stop) when the seal comes close, whether or not it can eat
  // them. A puff lasts PUFF_TIME; then it has to catch its breath before puffing again.
  if (p.puff) {
    if (m.puffTimer > 0) {
      m.puffTimer -= dt;
      if (m.puffTimer <= 0) m.puffCooldown = PUFF_RECOVER;
    } else if (m.puffCooldown > 0) {
      m.puffCooldown -= dt;
    } else if (Math.hypot(m.x - ctx.threatX, m.y - ctx.threatY) < PUFF_RADIUS) {
      m.puffTimer = PUFF_TIME;
    }
    m.puffed = m.puffTimer > 0;
    if (m.puffed) targetSpeed = p.speed * 0.25;
  }

  if (p.walk) {
    // Walkers stay on the bottom of their band and only move left/right.
    target = Math.cos(target) >= 0 ? 0 : Math.PI;
  } else {
    // Stay inside the preferred depth band.
    const right = Math.cos(target) >= 0;
    if (m.y < ctx.bandTop + BAND_MARGIN && Math.sin(target) < 0.35) {
      target = right ? 0.5 : Math.PI - 0.5;
      if (!fleeing && !ctx.leader) m.targetHeading = target;
    } else if (m.y > ctx.bandBottom - BAND_MARGIN && Math.sin(target) > -0.35) {
      target = right ? -0.5 : -(Math.PI - 0.5);
      if (!fleeing && !ctx.leader) m.targetHeading = target;
    }
  }

  // Look ahead along the wanted direction and slide along any rock in the way.
  const terrain = ctx.terrain;
  const radius = ctx.radius ?? 12;
  if (terrain && !p.walk) {
    const look = 40 + radius * 2 + m.speed * 0.4;
    const ax = m.x + Math.cos(target) * look;
    const ay = m.y + Math.sin(target) * look;
    if (terrain.distance(ax, ay) < radius + 24) {
      const n = terrain.normal(ax, ay, wallNormal);
      target = Math.atan2(Math.sin(target) + n.y * 1.6, Math.cos(target) + n.x * 1.6);
      if (!fleeing && !ctx.leader) m.targetHeading = target;
    }
  }

  const turn = p.turnRate * (fleeing ? FLEE_TURN_BOOST : 1) * dt;
  m.heading = rotateTowards(m.heading, target, turn);
  m.speed = moveTowards(m.speed, targetSpeed, p.accel * dt);
  if (p.jet) {
    m.jetTimer -= dt;
    if (m.jetTimer <= 0) {
      // Kick: jump to (near) top speed, then let accel bleed it back to the target.
      m.speed = p.fleeSpeed * (fleeing ? 1 : 0.7);
      m.jetTimer = fleeing ? 0.45 + ctx.random() * 0.35 : 1.4 + ctx.random() * 1.6;
    }
  }
  m.vx = Math.cos(m.heading) * m.speed;
  m.vy = Math.sin(m.heading) * m.speed;
  if (p.drift && !fleeing) m.vy += Math.sin(m.age * 3.3) * DRIFT_BOB;

  if (p.walk) {
    m.vx = Math.cos(m.heading) >= 0 ? m.speed : -m.speed;
    m.vy = 0;
    if (terrain) {
      walkOnGround(m, terrain, radius, dt);
      return;
    }
    m.y = ctx.bandBottom;
  }

  m.x += m.vx * dt;
  m.y += m.vy * dt;
  if (m.y < ctx.hardTop) m.y = ctx.hardTop;
  else if (m.y > ctx.hardBottom) m.y = ctx.hardBottom;
  if (terrain) {
    const d = terrain.distance(m.x, m.y);
    if (d < radius) {
      const n = terrain.normal(m.x, m.y, wallNormal);
      m.x += n.x * (radius - d);
      m.y += n.y * (radius - d);
    }
  }
}

/** Walkers follow the ground under them and turn around at cliffs and walls. */
function walkOnGround(m: CreatureMotion, terrain: CreatureTerrain, radius: number, dt: number): void {
  const nx = m.x + m.vx * dt;
  const probe = m.y - radius * 2;
  const ground = terrain.groundBelow(nx, probe, radius * 6);
  const next = ground === null ? null : ground - radius * 0.8;
  if (next !== null && m.age < 0.25) {
    // Just spawned: settle onto the ground.
    m.x = nx;
    m.y = next;
    return;
  }
  if (next === null || Math.abs(next - m.y) > WALK_MAX_STEP || terrain.distance(nx, m.y) < radius * 0.5) {
    // Cliff or wall ahead: turn around.
    m.heading = Math.cos(m.heading) >= 0 ? Math.PI : 0;
    m.targetHeading = m.heading;
    m.vx = -m.vx;
    return;
  }
  m.x = nx;
  m.y = next;
}
