import { describe, expect, it } from 'vitest';
import {
  createSealMotionState,
  stepSealMotion,
  type SealMotionEvent,
  type SealMotionInput,
  type SealMotionParams,
  type SealMotionState,
} from './sealMotion';

const P: SealMotionParams = {
  maxSpeed: 400,
  accel: 1000,
  decel: 500,
  turnRateSlow: 8,
  turnRateFast: 4,
  levelOutRate: 1.5,
  floorDeflectRate: 7,
  steerDeadzone: 0.1,
  radius: 20,
  boost: {
    speedMult: 2,
    accelMult: 2,
    drainPerSec: 0.5,
    regenPerSec: 0.25,
    regenDelay: 0.5,
    minToStart: 0.2,
  },
  air: { gravity: 1000, control: 100, maxFallSpeed: 1200, noseTurnRate: 10 },
  surface: { minBreachSpeed: 200, entrySpeedKeep: 0.7 },
};

const ENV = { ceilingY: 0, surfaceY: 500, floorY: 3000 };
const DT = 1 / 60;
const NONE: SealMotionInput = { steerX: 0, steerY: 0, boost: false };

function run(
  s: SealMotionState,
  input: SealMotionInput,
  seconds: number,
  params: SealMotionParams = P,
): SealMotionEvent[] {
  const events: SealMotionEvent[] = [];
  for (let t = 0; t < seconds; t += DT) {
    events.push(...stepSealMotion(s, input, params, ENV, DT));
  }
  return events;
}

describe('seal motion: swimming', () => {
  it('stays put with no input', () => {
    const s = createSealMotionState(0, 1000);
    run(s, NONE, 1);
    expect(s.x).toBe(0);
    expect(s.y).toBe(1000);
  });

  it('accelerates to max speed in the steered direction', () => {
    const s = createSealMotionState(0, 1000);
    run(s, { steerX: 1, steerY: 0, boost: false }, 1);
    expect(s.speed).toBeCloseTo(P.maxSpeed);
    expect(s.vx).toBeCloseTo(P.maxSpeed);
    expect(s.x).toBeGreaterThan(0);
  });

  it('scales target speed by steer magnitude', () => {
    const s = createSealMotionState(0, 1000);
    run(s, { steerX: 0.5, steerY: 0, boost: false }, 1);
    expect(s.speed).toBeCloseTo(P.maxSpeed * 0.5);
  });

  it('limits the turn rate per step', () => {
    const s = createSealMotionState(0, 1000);
    stepSealMotion(s, { steerX: -1, steerY: 0.001, boost: false }, P, ENV, DT);
    expect(Math.abs(s.heading)).toBeLessThanOrEqual(P.turnRateSlow * DT + 1e-9);
  });

  it('decelerates to a stop when input is released', () => {
    const s = createSealMotionState(0, 1000);
    run(s, { steerX: 1, steerY: 0, boost: false }, 1);
    run(s, NONE, 2);
    expect(s.speed).toBe(0);
  });

  it('clamps to the seabed and levels out when swimming down into it', () => {
    const s = createSealMotionState(0, ENV.floorY - 100);
    run(s, { steerX: 0.2, steerY: 1, boost: false }, 2);
    expect(s.y).toBeLessThanOrEqual(ENV.floorY - P.radius);
  });
});

describe('seal motion: surface', () => {
  it('rides along the surface when swimming up slowly', () => {
    const s = createSealMotionState(0, ENV.surfaceY + 10);
    const events = run(s, { steerX: 1, steerY: -0.3, boost: false }, 1);
    expect(events.some((e) => e.type === 'breach')).toBe(false);
    expect(s.inWater).toBe(true);
    expect(s.y).toBeGreaterThanOrEqual(ENV.surfaceY);
  });

  it('breaches when fast enough, falls under gravity, then splashes down', () => {
    const s = createSealMotionState(0, ENV.surfaceY + 400);
    s.heading = -Math.PI / 2;
    s.speed = P.maxSpeed;
    const events = [...run(s, { steerX: 0, steerY: -1, boost: false }, 1.2), ...run(s, NONE, 2)];
    const types = events.map((e) => e.type);
    expect(types).toContain('breach');
    expect(types).toContain('splashdown');
    expect(types.indexOf('breach')).toBeLessThan(types.indexOf('splashdown'));
    expect(s.inWater).toBe(true);
  });

  it('can leap from rest at the surface by turning up and building speed', () => {
    const s = createSealMotionState(0, ENV.surfaceY);
    const events = run(s, { steerX: 0, steerY: -1, boost: false }, 1);
    expect(events.some((e) => e.type === 'breach')).toBe(true);
  });
});

describe('seal motion: boost', () => {
  it('raises top speed and drains stamina', () => {
    const s = createSealMotionState(0, 2000);
    const events = run(s, { steerX: 1, steerY: 0, boost: true }, 0.5);
    expect(events[0]).toEqual({ type: 'boostStart' });
    expect(s.speed).toBeGreaterThan(P.maxSpeed);
    expect(s.stamina).toBeCloseTo(1 - 0.5 * P.boost.drainPerSec, 1);
  });

  it('stops boosting when stamina runs out, then regenerates after a delay', () => {
    const s = createSealMotionState(0, 2000);
    const events = run(s, { steerX: 1, steerY: 0, boost: true }, 2.5);
    expect(s.stamina).toBe(0);
    expect(s.boosting).toBe(false);
    expect(events.map((e) => e.type)).toContain('boostEnd');

    // Holding boost with empty stamina must not restart it.
    run(s, { steerX: 1, steerY: 0, boost: true }, 0.1);
    expect(s.boosting).toBe(false);

    run(s, NONE, P.boost.regenDelay + 1);
    expect(s.stamina).toBeGreaterThan(0.2);
  });

  it('cannot boost in the air', () => {
    const s = createSealMotionState(0, ENV.surfaceY - 100);
    s.inWater = false;
    stepSealMotion(s, { steerX: 1, steerY: 0, boost: true }, P, ENV, DT);
    expect(s.boosting).toBe(false);
  });
});
