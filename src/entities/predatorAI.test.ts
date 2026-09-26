import { describe, expect, it } from 'vitest';
import { createRng } from '../utils/rng';
import {
  createPredatorMotion,
  predatorBit,
  stepPredator,
  type PredatorContext,
  type PredatorEvent,
  type PredatorMotion,
  type PredatorParams,
} from './predatorAI';

const P: PredatorParams = {
  patrolSpeed: 100,
  chaseSpeed: 350,
  fleeSpeed: 400,
  turnRate: 2.5,
  chaseTurnRate: 2,
  accel: 500,
  noticeRadius: 400,
  loseRadius: 800,
  telegraphTime: 0.8,
  maxChaseTime: 5,
  recoverTime: 1.5,
  cooldown: 4,
};
const DT = 1 / 60;

function ctx(overrides: Partial<PredatorContext> = {}): PredatorContext {
  return {
    preyX: 10000,
    preyY: 2500,
    preyInWater: true,
    canEatPrey: true,
    bandTop: 1900,
    bandBottom: 5000,
    hardTop: 660,
    hardBottom: 6380,
    random: createRng(3),
    ...overrides,
  };
}

function run(m: PredatorMotion, seconds: number, c: PredatorContext): PredatorEvent[] {
  const events: PredatorEvent[] = [];
  for (let t = 0; t < seconds; t += DT) events.push(...stepPredator(m, P, c, DT));
  return events;
}

describe('predator AI', () => {
  it('patrols when the seal is far away', () => {
    const m = createPredatorMotion(0, 2500, 0);
    run(m, 5, ctx());
    expect(m.state).toBe('patrol');
    expect(m.speed).toBeCloseTo(P.patrolSpeed);
  });

  it('telegraphs before charging a nearby seal', () => {
    const m = createPredatorMotion(0, 2500, 0);
    const c = ctx({ preyX: 300, preyY: 2500 });
    const early = run(m, 0.3, c);
    expect(early).toContain('notice');
    expect(m.state).toBe('notice');
    expect(m.speed).toBeLessThan(P.patrolSpeed);
    const later = run(m, 0.7, c);
    expect(later).toContain('chase');
    expect(m.state).toBe('chase');
  });

  it('closes in on a stationary seal while chasing', () => {
    const m = createPredatorMotion(0, 2500, 0);
    const c = ctx({ preyX: 350, preyY: 2600 });
    run(m, 1, c);
    const before = Math.hypot(c.preyX - m.x, c.preyY - m.y);
    run(m, 0.6, c);
    expect(Math.hypot(c.preyX - m.x, c.preyY - m.y)).toBeLessThan(before);
  });

  it('ignores a seal that is out of the water', () => {
    const m = createPredatorMotion(0, 2500, 0);
    run(m, 1, ctx({ preyX: 200, preyY: 2500, preyInWater: false }));
    expect(m.state).toBe('patrol');
  });

  it('gives up after chasing too long and then waits out a cooldown', () => {
    const m = createPredatorMotion(0, 2500, 0);
    // A prey that keeps running away just ahead of it.
    const c = ctx({ preyX: 300, preyY: 2500 });
    const events: PredatorEvent[] = [];
    for (let t = 0; t < 8; t += DT) {
      c.preyX = m.x + 300;
      events.push(...stepPredator(m, P, c, DT));
    }
    expect(events).toContain('giveUp');
    expect(m.state).toBe('patrol');
    expect(m.cooldown).toBeGreaterThan(0);
  });

  it('swims off after biting, then goes back to patrol', () => {
    const m = createPredatorMotion(0, 2500, 0);
    const c = ctx({ preyX: 100, preyY: 2500 });
    run(m, 1, c);
    predatorBit(m, P);
    expect(m.state).toBe('recover');
    run(m, P.recoverTime + 0.1, c);
    expect(m.state).toBe('patrol');
    // Still on cooldown, so it doesn't immediately re-notice.
    run(m, 0.5, c);
    expect(m.state).toBe('patrol');
  });

  it('flees from a seal that has outgrown it', () => {
    const m = createPredatorMotion(0, 2500, 0);
    const c = ctx({ preyX: -150, preyY: 2500, canEatPrey: false });
    const events = run(m, 1.5, c);
    expect(events).toContain('flee');
    expect(m.x).toBeGreaterThan(100);
  });

  it('never leaves the water', () => {
    const m = createPredatorMotion(0, 700, -Math.PI / 2);
    run(m, 3, ctx({ preyX: 0, preyY: 500, preyInWater: true }));
    expect(m.y).toBeGreaterThanOrEqual(660);
  });
});
