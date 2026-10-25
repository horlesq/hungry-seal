import { describe, expect, it } from 'vitest';
import type { ZoneId } from '../config/zones';
import { isWorthwhileFood, pickSpawn } from './spawnPoint';

const REEF_Y = 1000;
const defs = [
  { id: 'minnow', tier: 1, weight: 1, zones: ['reef'] as ZoneId[] },
  { id: 'turtle', tier: 4, weight: 100, zones: ['reef'] as ZoneId[] },
  { id: 'lantern', tier: 1, weight: 1, zones: ['deep'] as ZoneId[] },
];

describe('pickSpawn', () => {
  it('picks by zone weight when food is plentiful', () => {
    const seq = [0.5];
    const def = pickSpawn(defs, REEF_Y, () => seq[0], null);
    expect(def?.id).toBe('turtle');
  });

  it('only picks what the seal can eat while food is short', () => {
    for (const roll of [0, 0.3, 0.6, 0.99]) {
      expect(pickSpawn(defs, REEF_Y, () => roll, 1)?.id).toBe('minnow');
    }
  });

  it('falls back to any species when nothing edible lives at that depth', () => {
    const noSmallFish = defs.filter((d) => d.id !== 'minnow');
    expect(pickSpawn(noSmallFish, REEF_Y, () => 0.5, 1)?.id).toBe('turtle');
  });

  it('feeds a big seal prey worth eating, not minnows', () => {
    // Even with minnows weighted far higher, a size-8 seal gets the turtle.
    const heavyMinnows = defs.map((d) => (d.id === 'minnow' ? { ...d, weight: 1000 } : d));
    for (const roll of [0, 0.5, 0.99]) {
      expect(pickSpawn(heavyMinnows, REEF_Y, () => roll, 8)?.id).toBe('turtle');
    }
  });

  it('falls back to small prey when nothing worthwhile lives at that depth', () => {
    expect(pickSpawn(defs, 4000, () => 0.5, 8)?.id).toBe('lantern');
  });
});

describe('isWorthwhileFood', () => {
  it('counts prey near the seal size, not prey it has long outgrown', () => {
    expect(isWorthwhileFood(1, 1)).toBe(true);
    expect(isWorthwhileFood(8, 4)).toBe(true);
    expect(isWorthwhileFood(8, 1)).toBe(false);
    expect(isWorthwhileFood(2, 4)).toBe(false); // too big to eat
    // A frenzy's oversized bite stage counts as full size.
    expect(isWorthwhileFood(99, 4)).toBe(true);
  });
});
