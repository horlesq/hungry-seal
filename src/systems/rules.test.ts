import { describe, expect, it } from 'vitest';
import { DAMAGE, FEEDING } from '../config/balance';
import { canEat, circlesOverlap, mealValue, stingFactor } from './feeding';
import { GrowthSystem } from './GrowthSystem';
import { HungerSystem, type HungerParams } from './HungerSystem';

const HUNGER: HungerParams = {
  max: 100,
  baseDrainPerSec: 2,
  rampSeconds: 100,
  zoneMultiplier: { surface: 1, reef: 1, ocean: 1.5, deep: 2, abyss: 3 },
  lowFraction: 0.25,
};

describe('HungerSystem', () => {
  it('starts full and drains at the base rate', () => {
    const h = new HungerSystem(HUNGER);
    expect(h.value).toBe(100);
    h.update(1, 0, 'reef');
    expect(h.value).toBeCloseTo(98);
  });

  it('drains faster over time and in deeper zones', () => {
    const h = new HungerSystem(HUNGER);
    expect(h.drainRate(100, 'reef')).toBeCloseTo(4);
    expect(h.drainRate(0, 'abyss')).toBeCloseTo(6);
    expect(h.drainRate(0, 'ocean')).toBeGreaterThan(h.drainRate(0, 'reef'));
  });

  it('bigger seals drain faster', () => {
    const h = new HungerSystem({ ...HUNGER, sizeMultiplier: [1, 1.5, 2] });
    expect(h.drainRate(0, 'reef', 1)).toBeCloseTo(2);
    expect(h.drainRate(0, 'reef', 3)).toBeCloseTo(4);
    // Past the table: the last entry.
    expect(h.drainRate(0, 'reef', 8)).toBeCloseTo(4);
    h.update(1, 0, 'reef', 1, 2);
    expect(h.value).toBeCloseTo(97);
  });

  it('feeding clamps to max and reports the real gain', () => {
    const h = new HungerSystem(HUNGER);
    h.damage(10);
    expect(h.feed(25)).toBeCloseTo(10);
    expect(h.value).toBe(100);
  });

  it('starves at zero and never goes negative', () => {
    const h = new HungerSystem(HUNGER);
    h.update(1000, 0, 'reef');
    expect(h.value).toBe(0);
    expect(h.isStarved).toBe(true);
  });

  it('flags low hunger', () => {
    const h = new HungerSystem(HUNGER);
    h.damage(76);
    expect(h.isLow).toBe(true);
  });

  it('flags low hunger early when the bar empties fast', () => {
    const h = new HungerSystem({ ...HUNGER, lowSeconds: 6 });
    h.damage(50);
    h.update(0.01, 0, 'reef'); // 2/s: 50 left is 25 s of food
    expect(h.isLow).toBe(false);
    h.update(0.01, 400, 'abyss'); // 2 x 5 x 3 = 30/s: under 2 s of food
    expect(h.isLow).toBe(true);
  });
});

describe('stingFactor', () => {
  it('leaves small seals nearly full damage and softens it for a full-grown seal', () => {
    expect(stingFactor(1)).toBe(1);
    expect(stingFactor(2)).toBeGreaterThan(0.9);
    // Softer at size 8, but never below the floor.
    expect(stingFactor(8)).toBeGreaterThanOrEqual(DAMAGE.stingMinFactor);
    expect(stingFactor(8)).toBeLessThan(0.75);
    expect(stingFactor(99)).toBe(DAMAGE.stingMinFactor); // a frenzy stage never goes lower
    expect(stingFactor(0)).toBe(1);
  });
});

describe('mealValue', () => {
  it('is full for prey near the seal size and drops for long-outgrown prey', () => {
    expect(mealValue(3, 3)).toBe(1);
    expect(mealValue(3, 3 - FEEDING.outgrownFree)).toBe(1);
    const a = mealValue(8, 4);
    const b = mealValue(8, 1);
    expect(a).toBeLessThan(1);
    expect(b).toBeLessThan(a);
    expect(b).toBeGreaterThan(0.2);
  });

  it('is full for a frenzy meal above the seal size', () => {
    expect(mealValue(2, 6)).toBe(1);
  });
});

describe('GrowthSystem', () => {
  it('advances a stage when the meter fills, carrying leftover points', () => {
    const g = new GrowthSystem([10, 20]);
    expect(g.add(9)).toBe(0);
    expect(g.progress).toBeCloseTo(0.9);
    expect(g.pointsToNext).toBe(1);
    expect(g.add(3)).toBe(1);
    expect(g.stage).toBe(2);
    expect(g.points).toBe(2);
  });

  it('can gain several stages at once and stops at the max stage', () => {
    const g = new GrowthSystem([10, 20]);
    expect(g.add(1000)).toBe(2);
    expect(g.stage).toBe(3);
    expect(g.isMaxStage).toBe(true);
    expect(g.progress).toBe(1);
    expect(g.add(50)).toBe(0);
  });
});

describe('feeding rules', () => {
  it('eats prey at or below its stage', () => {
    expect(canEat(1, 1)).toBe(true);
    expect(canEat(1, 2)).toBe(false);
    expect(canEat(3, 2)).toBe(true);
  });

  it('detects circle overlap including touching', () => {
    expect(circlesOverlap(0, 0, 5, 10, 0, 5)).toBe(true);
    expect(circlesOverlap(0, 0, 5, 10.1, 0, 5)).toBe(false);
  });
});
