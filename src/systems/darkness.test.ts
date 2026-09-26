import { describe, expect, it } from 'vitest';
import { darknessAt, WORLD, ZONES } from '../config/zones';

const top = (id: string) => ZONES.find((z) => z.id === id)!.top;

describe('darkness by depth', () => {
  it('is clear near the surface and in the open ocean', () => {
    expect(darknessAt(WORLD.surfaceY + 100)).toBe(0);
    expect(darknessAt(top('ocean') + 200)).toBe(0);
  });

  it('gets darker the deeper you go, never fully black', () => {
    const samples = [top('deep') - 300, top('deep'), top('abyss'), WORLD.floorY];
    const values = samples.map(darknessAt);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
    expect(values[values.length - 1]).toBeLessThan(1);
    expect(values[values.length - 1]).toBeGreaterThan(0.8);
  });
});
