import { describe, expect, it } from 'vitest';
import { createRng } from '../utils/rng';
import {
  createCreatureMotion,
  startle,
  stepCreatureMotion,
  type CreatureMotion,
  type CreatureMotionParams,
  type CreatureSteerContext,
} from './creatureAI';

const P: CreatureMotionParams = {
  speed: 100,
  fleeSpeed: 300,
  turnRate: 5,
  accel: 600,
  fleeRadius: 200,
  flee: true,
  drift: false,
  jet: false,
};

const DT = 1 / 60;

function ctx(overrides: Partial<CreatureSteerContext> = {}): CreatureSteerContext {
  return {
    threatX: -10000,
    threatY: -10000,
    threatActive: false,
    bandTop: 1000,
    bandBottom: 2000,
    hardTop: 700,
    hardBottom: 6000,
    leader: null,
    slotX: 0,
    slotY: 0,
    random: createRng(1),
    ...overrides,
  };
}

function run(
  m: CreatureMotion,
  seconds: number,
  c: CreatureSteerContext,
  p: CreatureMotionParams = P,
): void {
  for (let t = 0; t < seconds; t += DT) stepCreatureMotion(m, p, c, DT);
}

describe('creature AI', () => {
  it('wanders at cruise speed and stays in its depth band', () => {
    const m = createCreatureMotion(0, 1500, 0);
    const c = ctx();
    let minY = Infinity;
    let maxY = -Infinity;
    for (let t = 0; t < 60; t += DT) {
      stepCreatureMotion(m, P, c, DT);
      minY = Math.min(minY, m.y);
      maxY = Math.max(maxY, m.y);
    }
    expect(minY).toBeGreaterThan(c.bandTop - 40);
    expect(maxY).toBeLessThan(c.bandBottom + 40);
    expect(m.speed).toBeCloseTo(P.speed);
  });

  it('returns to its band when spawned outside it', () => {
    const m = createCreatureMotion(0, 800, 0);
    run(m, 6, ctx());
    expect(m.y).toBeGreaterThan(1000);
  });

  it('flees a threat that can eat it', () => {
    const m = createCreatureMotion(0, 1500, 0);
    const c = ctx({ threatX: -100, threatY: 1500, threatActive: true });
    run(m, 1, c);
    expect(m.x).toBeGreaterThan(100);
    expect(m.speed).toBeGreaterThan(P.speed);
  });

  it('ignores a threat that cannot eat it', () => {
    const m = createCreatureMotion(0, 1500, Math.PI);
    const c = ctx({ threatX: -100, threatY: 1500, threatActive: false });
    run(m, 0.5, c);
    expect(m.fleeTimer).toBe(0);
    expect(m.speed).toBeLessThanOrEqual(P.speed + 1e-6);
  });

  it('bolts after being startled even without an active threat', () => {
    const m = createCreatureMotion(0, 1500, 0);
    startle(m, createRng(2));
    run(m, 0.3, ctx({ threatX: -50, threatY: 1500 }));
    expect(m.speed).toBeGreaterThan(P.speed);
  });

  it('school members converge on their slot next to the leader', () => {
    const leader = createCreatureMotion(0, 1500, 0);
    const member = createCreatureMotion(-300, 1400, 0);
    const leaderCtx = ctx();
    const memberCtx = ctx({ leader, slotX: -40, slotY: 20 });
    for (let t = 0; t < 5; t += DT) {
      stepCreatureMotion(leader, P, leaderCtx, DT);
      stepCreatureMotion(member, P, memberCtx, DT);
    }
    const dist = Math.hypot(member.x - (leader.x - 40), member.y - (leader.y + 20));
    expect(dist).toBeLessThan(40);
  });

  it('jetters move in bursts: speed spikes then decays', () => {
    const jetter = { ...P, jet: true, accel: 300 };
    const m = createCreatureMotion(0, 1500, 0);
    const speeds: number[] = [];
    const c = ctx();
    for (let t = 0; t < 6; t += DT) {
      stepCreatureMotion(m, jetter, c, DT);
      speeds.push(m.speed);
    }
    const peak = Math.max(...speeds);
    expect(peak).toBeGreaterThan(jetter.speed * 1.5);
    // Most of the time it is back near cruising speed.
    const cruising = speeds.filter((s) => s < jetter.speed * 1.2).length / speeds.length;
    expect(cruising).toBeGreaterThan(0.4);
  });

  it('flyers stay in the air when given air limits', () => {
    const m = createCreatureMotion(0, 500, Math.PI / 2);
    const c = ctx({ bandTop: 360, bandBottom: 615, hardTop: 40, hardBottom: 628 });
    let maxY = -Infinity;
    for (let t = 0; t < 20; t += DT) {
      stepCreatureMotion(m, P, c, DT);
      maxY = Math.max(maxY, m.y);
    }
    expect(maxY).toBeLessThanOrEqual(628);
  });

  it('never leaves the water column', () => {
    const m = createCreatureMotion(0, 710, -Math.PI / 2);
    const c = ctx({ threatX: 0, threatY: 800, threatActive: true, bandTop: 700 });
    run(m, 3, c);
    expect(m.y).toBeGreaterThanOrEqual(c.hardTop);
  });
});
