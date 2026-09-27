import { describe, expect, it } from 'vitest';
import { createStick, stepStick } from './joystick';

const P = { radius: 100, deadzone: 0.1 };

describe('floating joystick', () => {
  it('does nothing while the finger rests where it landed', () => {
    const s = stepStick(createStick(50, 50), 55, 52, P);
    expect(s.x).toBe(0);
    expect(s.y).toBe(0);
  });

  it('steers toward the drag direction, faster the further it goes', () => {
    const half = stepStick(createStick(0, 0), 55, 0, P);
    expect(half.x).toBeCloseTo(0.5);
    expect(half.y).toBe(0);
    const full = stepStick(createStick(0, 0), 0, -100, P);
    expect(full.y).toBeCloseTo(-1);
  });

  it('drags the base along past the radius, so reversing is quick', () => {
    const s = stepStick(createStick(0, 0), 300, 0, P);
    expect(s.x).toBeCloseTo(1);
    expect(s.originX).toBeCloseTo(200);
    // Moving back a little from there already steers the other way.
    stepStick(s, 150, 0, P);
    expect(s.x).toBeLessThan(0);
  });
});
