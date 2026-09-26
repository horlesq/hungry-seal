// Predator behavior as a small state machine. Pure logic, no Phaser.
//
//   patrol --(seal close, in water, catchable)--> notice --(telegraph time)--> chase
//   chase --(too far / too long)--> patrol (cooldown)      chase --(bite)--> recover --> patrol
//   any --(seal has outgrown it and is close)--> flee --(seal far)--> patrol
//
// "notice" is the readable warning: the predator slows, turns toward the seal and shows "!".
import type { PredatorDef } from '../config/predators';
import { moveTowards, rotateTowards } from '../utils/math';

export type PredatorState = 'patrol' | 'notice' | 'chase' | 'recover' | 'flee';
export type PredatorEvent = 'notice' | 'chase' | 'giveUp' | 'flee';

export type PredatorParams = Pick<
  PredatorDef,
  | 'patrolSpeed'
  | 'chaseSpeed'
  | 'fleeSpeed'
  | 'turnRate'
  | 'chaseTurnRate'
  | 'accel'
  | 'noticeRadius'
  | 'loseRadius'
  | 'telegraphTime'
  | 'maxChaseTime'
  | 'recoverTime'
  | 'cooldown'
>;

export interface PredatorMotion {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  speed: number;
  state: PredatorState;
  stateTime: number;
  targetHeading: number;
  wanderTimer: number;
  /** Seconds before it can notice the seal again. */
  cooldown: number;
}

export interface PredatorContext {
  preyX: number;
  preyY: number;
  preyInWater: boolean;
  /** True while the seal is small enough to be bitten; false once it has outgrown us. */
  canEatPrey: boolean;
  bandTop: number;
  bandBottom: number;
  hardTop: number;
  hardBottom: number;
  random: () => number;
}

const BAND_MARGIN = 90;
const NOTICE_SPEED = 40;
const FLEE_EXIT_FACTOR = 1.4;

export function createPredatorMotion(x: number, y: number, heading: number): PredatorMotion {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    heading,
    speed: 0,
    state: 'patrol',
    stateTime: 0,
    targetHeading: heading,
    wanderTimer: 0,
    cooldown: 0,
  };
}

/** Called after a successful bite: swim off for a while. */
export function predatorBit(m: PredatorMotion, p: PredatorParams): void {
  enter(m, 'recover');
  m.cooldown = p.recoverTime + p.cooldown;
}

export function stepPredator(
  m: PredatorMotion,
  p: PredatorParams,
  ctx: PredatorContext,
  dt: number,
): PredatorEvent[] {
  const events: PredatorEvent[] = [];
  m.stateTime += dt;
  m.cooldown = Math.max(0, m.cooldown - dt);

  const dx = ctx.preyX - m.x;
  const dy = ctx.preyY - m.y;
  const dist = Math.hypot(dx, dy);
  const toPrey = Math.atan2(dy, dx);
  const awayFromPrey = Math.atan2(-dy, -dx);

  // Outgrown by the seal: flee from it whatever we were doing.
  if (!ctx.canEatPrey && m.state !== 'flee' && dist < p.noticeRadius) {
    enter(m, 'flee');
    events.push('flee');
  }

  let target = m.heading;
  let targetSpeed = p.patrolSpeed;
  let turnRate = p.turnRate;
  let keepInBand = true;

  switch (m.state) {
    case 'patrol': {
      if (ctx.canEatPrey && ctx.preyInWater && m.cooldown <= 0 && dist < p.noticeRadius) {
        enter(m, 'notice');
        events.push('notice');
        target = toPrey;
        targetSpeed = NOTICE_SPEED;
        break;
      }
      target = wander(m, ctx, dt);
      break;
    }
    case 'notice': {
      target = toPrey;
      targetSpeed = NOTICE_SPEED;
      keepInBand = false;
      if (dist > p.loseRadius) {
        enter(m, 'patrol');
      } else if (m.stateTime >= p.telegraphTime) {
        enter(m, 'chase');
        events.push('chase');
      }
      break;
    }
    case 'chase': {
      target = toPrey;
      targetSpeed = p.chaseSpeed;
      turnRate = p.chaseTurnRate;
      keepInBand = false;
      if (dist > p.loseRadius || m.stateTime >= p.maxChaseTime) {
        enter(m, 'patrol');
        m.cooldown = p.cooldown;
        events.push('giveUp');
      }
      break;
    }
    case 'recover': {
      target = awayFromPrey;
      targetSpeed = p.patrolSpeed * 1.6;
      if (m.stateTime >= p.recoverTime) enter(m, 'patrol');
      break;
    }
    case 'flee': {
      target = awayFromPrey;
      targetSpeed = p.fleeSpeed;
      keepInBand = false;
      if (dist > p.noticeRadius * FLEE_EXIT_FACTOR) enter(m, 'patrol');
      break;
    }
  }

  if (keepInBand) target = bandSteer(m, ctx, target);

  m.heading = rotateTowards(m.heading, target, turnRate * dt);
  m.speed = moveTowards(m.speed, targetSpeed, p.accel * dt);
  m.vx = Math.cos(m.heading) * m.speed;
  m.vy = Math.sin(m.heading) * m.speed;
  m.x += m.vx * dt;
  m.y += m.vy * dt;
  if (m.y < ctx.hardTop) m.y = ctx.hardTop;
  else if (m.y > ctx.hardBottom) m.y = ctx.hardBottom;
  return events;
}

function enter(m: PredatorMotion, state: PredatorState): void {
  m.state = state;
  m.stateTime = 0;
  if (state === 'patrol') m.wanderTimer = 0;
}

/** Slow horizontal cruising with occasional turns, like the prey wander. */
function wander(m: PredatorMotion, ctx: PredatorContext, dt: number): number {
  m.wanderTimer -= dt;
  if (m.wanderTimer <= 0) {
    const goingRight = Math.cos(m.heading) >= 0;
    const goRight = ctx.random() < 0.75 ? goingRight : !goingRight;
    const tilt = (ctx.random() - 0.5) * 0.5;
    m.targetHeading = goRight ? tilt : Math.PI - tilt;
    m.wanderTimer = 3 + ctx.random() * 4;
  }
  return m.targetHeading;
}

function bandSteer(m: PredatorMotion, ctx: PredatorContext, target: number): number {
  const right = Math.cos(target) >= 0;
  if (m.y < ctx.bandTop + BAND_MARGIN && Math.sin(target) < 0.3) {
    return right ? 0.4 : Math.PI - 0.4;
  }
  if (m.y > ctx.bandBottom - BAND_MARGIN && Math.sin(target) > -0.3) {
    return right ? -0.4 : -(Math.PI - 0.4);
  }
  return target;
}
