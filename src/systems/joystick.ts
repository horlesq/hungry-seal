// Floating virtual joystick math (touch steering). Pure logic, no Phaser.
//
// The stick's base appears where the finger lands; dragging away from it steers, with speed
// growing up to `radius`. Dragging further pulls the base along behind the finger, so
// reversing direction never needs a long swipe back.

export interface StickParams {
  /** Drag distance for full speed (design units). */
  radius: number;
  /** Fraction of the radius that counts as "centred" (no steering). */
  deadzone: number;
}

export interface Stick {
  /** Base position (design units); moves when the finger drags past the radius. */
  originX: number;
  originY: number;
  /** Steering vector, length 0..1. */
  x: number;
  y: number;
}

export function createStick(x: number, y: number): Stick {
  return { originX: x, originY: y, x: 0, y: 0 };
}

/** Updates the stick for a finger at (fx, fy). */
export function stepStick(s: Stick, fx: number, fy: number, p: StickParams): Stick {
  let dx = fx - s.originX;
  let dy = fy - s.originY;
  let dist = Math.hypot(dx, dy);
  if (dist > p.radius) {
    // The base follows the finger, staying one radius behind it.
    s.originX = fx - (dx / dist) * p.radius;
    s.originY = fy - (dy / dist) * p.radius;
    dx = fx - s.originX;
    dy = fy - s.originY;
    dist = p.radius;
  }
  const dead = p.deadzone * p.radius;
  if (dist <= dead) {
    s.x = 0;
    s.y = 0;
    return s;
  }
  const mag = Math.min(1, (dist - dead) / (p.radius - dead));
  s.x = (dx / dist) * mag;
  s.y = (dy / dist) * mag;
  return s;
}
