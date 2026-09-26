import { describe, expect, it } from 'vitest';
import { angleDelta, clamp, damp, moveTowards, rotateTowards, wrapAngle } from './math';
import { createRng } from './rng';

describe('math', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('wraps angles into (-PI, PI]', () => {
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(Math.PI / 2 + Math.PI * 4)).toBeCloseTo(Math.PI / 2);
  });

  it('takes the shortest arc between angles', () => {
    expect(angleDelta(Math.PI * 0.9, -Math.PI * 0.9)).toBeCloseTo(Math.PI * 0.2);
    expect(angleDelta(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
  });

  it('rotates toward a target by at most maxStep', () => {
    expect(rotateTowards(0, Math.PI / 2, 0.1)).toBeCloseTo(0.1);
    expect(rotateTowards(0, 0.05, 0.1)).toBeCloseTo(0.05);
    // Crosses the +/-PI seam the short way (increasing angle, wrapped to negative).
    expect(rotateTowards(Math.PI * 0.98, -Math.PI * 0.95, 0.2)).toBeCloseTo(
      Math.PI * 0.98 + 0.2 - Math.PI * 2,
    );
  });

  it('moves toward a target by at most maxStep', () => {
    expect(moveTowards(0, 10, 3)).toBe(3);
    expect(moveTowards(9, 10, 3)).toBe(10);
    expect(moveTowards(10, 0, 4)).toBe(6);
  });

  it('damps frame-rate independently', () => {
    // One 1/30s step should equal two 1/60s steps.
    const once = damp(0, 100, 5, 1 / 30);
    const twice = damp(damp(0, 100, 5, 1 / 60), 100, 5, 1 / 60);
    expect(once).toBeCloseTo(twice);
  });
});

describe('rng', () => {
  it('is deterministic for a seed and stays in [0, 1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
