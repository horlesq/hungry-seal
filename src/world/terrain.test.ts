import { describe, expect, it } from 'vitest';
import { floorAt, TerrainField, type TerrainDef } from './terrain';

const base: TerrainDef = {
  width: 2000,
  height: 1200,
  floor: [
    [0, 1000],
    [2000, 1000],
  ],
  ops: [],
  seed: 1,
};

describe('terrain field', () => {
  it('is open water above a flat seabed and rock below it', () => {
    const t = new TerrainField(base);
    expect(t.distance(1000, 900)).toBeCloseTo(100, 0);
    expect(t.distance(1000, 1050)).toBeLessThan(0);
    expect(t.isOpen(1000, 900, 50)).toBe(true);
    expect(t.isOpen(1000, 980, 50)).toBe(false);
  });

  it('walls off the map edges and the outside', () => {
    const t = new TerrainField(base);
    expect(t.distance(20, 500)).toBeLessThan(0);
    expect(t.distance(1990, 500)).toBeLessThan(0);
    expect(t.distance(-50, 500)).toBeLessThan(0);
    expect(t.distance(1000, 500)).toBeGreaterThan(0);
  });

  it('adds rock shapes and cuts tunnels through them', () => {
    const t = new TerrainField({
      ...base,
      ops: [
        { mode: 'add', shape: { type: 'circle', x: 1000, y: 500, r: 200 } },
        { mode: 'cut', shape: { type: 'capsule', x1: 700, y1: 500, x2: 1300, y2: 500, r1: 50 } },
      ],
    });
    expect(t.distance(1000, 380)).toBeLessThan(0); // rock above the tunnel
    expect(t.distance(1000, 500)).toBeGreaterThan(30); // tunnel is open
    expect(t.distance(1000, 620)).toBeLessThan(0); // rock below the tunnel
  });

  it('points normals out of the rock', () => {
    const t = new TerrainField(base);
    const n = t.normal(1000, 990, { x: 0, y: 0 });
    expect(n.y).toBeLessThan(-0.9);
  });

  it('finds the ground below a point', () => {
    const t = new TerrainField({
      ...base,
      floor: [
        [0, 1000],
        [1000, 1000],
        [2000, 600],
      ],
    });
    expect(t.groundBelow(500, 200)).toBeCloseTo(1000, -1);
    expect(t.groundBelow(1900, 200)).toBeCloseTo(floorAt(t.def.floor, 1900), -1);
    expect(t.groundBelow(500, 1100)).toBeNull(); // inside rock
  });

  it('pushes a circle out of the rock along the normal', () => {
    const t = new TerrainField(base);
    const pos = { x: 1000, y: 990 };
    const n = t.pushOut(pos, 30, { x: 0, y: 0 });
    expect(n).not.toBeNull();
    expect(t.distance(pos.x, pos.y)).toBeGreaterThan(28);
    expect(t.pushOut({ x: 1000, y: 500 }, 30, { x: 0, y: 0 })).toBeNull();
  });
});
