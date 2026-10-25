import { describe, expect, it } from 'vitest';
import { FrenzySystem } from './FrenzySystem';

const P = { perMeal: 0.25, decayDelay: 2, decayPerSec: 0.1, duration: 5 };

describe('FrenzySystem', () => {
  it('fills from meals, faster with a combo multiplier', () => {
    const f = new FrenzySystem(P);
    expect(f.feed(1)).toBe(false);
    expect(f.meter).toBeCloseTo(0.25);
    f.feed(2);
    expect(f.meter).toBeCloseTo(0.75);
  });

  it('starts a frenzy when full, then runs out', () => {
    const f = new FrenzySystem(P);
    for (let i = 0; i < 3; i++) f.feed();
    expect(f.feed()).toBe(true);
    expect(f.active).toBe(true);
    expect(f.feed()).toBe(false); // meals during a frenzy don't restart it
    expect(f.update(2.5)).toBe(false);
    expect(f.meter).toBeCloseTo(0.5);
    expect(f.update(3)).toBe(true);
    expect(f.active).toBe(false);
    expect(f.meter).toBe(0);
  });

  it('rests after a frenzy: meals do not charge the meter until the cooldown is over', () => {
    const f = new FrenzySystem({ ...P, cooldown: 10 });
    for (let i = 0; i < 4; i++) f.feed();
    expect(f.active).toBe(true);
    expect(f.update(P.duration + 0.1)).toBe(true);
    expect(f.resting).toBe(true);
    f.feed(4);
    expect(f.meter).toBe(0);
    f.update(9);
    f.feed();
    expect(f.meter).toBe(0);
    f.update(1.1);
    expect(f.resting).toBe(false);
    f.feed();
    expect(f.meter).toBeCloseTo(0.25);
  });

  it('drains only after a pause in eating', () => {
    const f = new FrenzySystem(P);
    f.feed();
    f.feed();
    f.update(1.5);
    expect(f.meter).toBeCloseTo(0.5);
    f.update(1.5); // 3 s idle: 1 s past the delay
    expect(f.meter).toBeLessThan(0.5);
    f.update(100);
    expect(f.meter).toBe(0);
  });
});
