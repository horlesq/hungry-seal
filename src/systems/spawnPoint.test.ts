import { describe, expect, it } from 'vitest';
import type { ZoneId } from '../config/zones';
import { pickSpawn } from './spawnPoint';

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
});
