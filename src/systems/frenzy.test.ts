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
