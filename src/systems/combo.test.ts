import { describe, expect, it } from 'vitest';
import { ComboSystem } from './ComboSystem';

describe('ComboSystem', () => {
  it('starts at x1 and climbs through the thresholds', () => {
    const c = new ComboSystem(2, [2, 5]);
    expect(c.hit()).toBe(1);
    expect(c.hit()).toBe(2);
    c.hit();
    c.hit();
    expect(c.hit()).toBe(3);
    expect(c.count).toBe(5);
  });

  it('ends after the window and reports the final count', () => {
    const c = new ComboSystem(2, [2, 5]);
    c.hit();
    c.hit();
    c.hit();
    expect(c.update(1.5)).toBe(0);
    expect(c.remaining).toBeCloseTo(0.25);
    expect(c.update(1)).toBe(3);
    expect(c.active).toBe(false);
    expect(c.hit()).toBe(1);
  });

  it('keeps going while meals land inside the window', () => {
    const c = new ComboSystem(2, [2, 5]);
    for (let i = 0; i < 6; i++) {
      c.hit();
      c.update(1.9);
    }
    expect(c.count).toBe(6);
    expect(c.multiplier).toBe(3);
  });

  it('reset breaks the combo', () => {
    const c = new ComboSystem(2, [2]);
    c.hit();
    c.hit();
    c.reset();
    expect(c.active).toBe(false);
    expect(c.multiplier).toBe(1);
  });
});
