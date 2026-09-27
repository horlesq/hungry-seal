import { describe, expect, it } from 'vitest';
import { createRng } from '../utils/rng';
import {
  createCreatureMotion,
  PUFF_RECOVER,
  PUFF_TIME,
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
  walk: false,
  puff: false,
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

  it('walkers stay on the bottom of their band and move sideways', () => {
    const walker = { ...P, walk: true, flee: true };
    const m = createCreatureMotion(0, 5000, 0.8);
    const c = ctx({ bandTop: 6360, bandBottom: 6382, hardTop: 700, hardBottom: 6384 });
    for (let t = 0; t < 3; t += DT) stepCreatureMotion(m, walker, c, DT);
    expect(m.y).toBe(6382);
    expect(m.vy).toBe(0);
    // Flees sideways from a seal on its left.
    c.threatX = m.x - 80;
    c.threatY = m.y;
    c.threatActive = true;
    const x0 = m.x;
    for (let t = 0; t < 1; t += DT) stepCreatureMotion(m, walker, c, DT);
    expect(m.x).toBeGreaterThan(x0);
    expect(m.y).toBe(6382);
  });

  it('puffers inflate and slow down near the seal, then deflate', () => {
    const puffer = { ...P, puff: true, flee: false };
    const m = createCreatureMotion(0, 1500, 0);
    const c = ctx({ threatX: 100, threatY: 1500 });
    for (let t = 0; t < 1; t += DT) stepCreatureMotion(m, puffer, c, DT);
    expect(m.puffed).toBe(true);
    expect(m.speed).toBeLessThan(P.speed * 0.5);
    c.threatX = 5000;
    for (let t = 0; t < 3; t += DT) stepCreatureMotion(m, puffer, c, DT);
    expect(m.puffed).toBe(false);
  });

  it('puffers deflate after a while even with the seal close, then recover', () => {
    const puffer = { ...P, puff: true, flee: false };
    const m = createCreatureMotion(0, 1500, 0);
    const c = ctx({ threatX: 60, threatY: 1500 });
    // Keep the seal right next to it the whole time.
    const hold = (seconds: number) => {
      for (let t = 0; t < seconds; t += DT) {
        c.threatX = m.x + 60;
        stepCreatureMotion(m, puffer, c, DT);
      }
    };
    hold(0.1);
    expect(m.puffed).toBe(true);
    hold(PUFF_TIME);
    expect(m.puffed).toBe(false);
    // Catching its breath: safe to eat for a moment.
    hold(PUFF_RECOVER - 0.3);
    expect(m.puffed).toBe(false);
    hold(0.5);
    expect(m.puffed).toBe(true);
  });

  it('never leaves the water column', () => {
    const m = createCreatureMotion(0, 710, -Math.PI / 2);
    const c = ctx({ threatX: 0, threatY: 800, threatActive: true, bandTop: 700 });
    run(m, 3, c);
    expect(m.y).toBeGreaterThanOrEqual(c.hardTop);
  });
});
