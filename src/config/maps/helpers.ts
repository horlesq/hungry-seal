// Building blocks for authoring maps: terrain shape helpers and level pieces (grottos,
// lairs, islands, spires) sized from the passage metrics in docs/LEVEL_DESIGN.md.
import type { TerrainOp, TerrainShape } from '../../world/terrain';
import { WORLD } from '../zones';

/** Passage widths (px): who fits through. */
export const PASSAGE = {
  /** Sizes 1-3 only (secret grottos): 2 x size-3 radius (28) + a little room. */
  TIGHT: 70,
  /** Up to size 5: 2 x size-5 radius (41) + room. */
  SNUG: 100,
  /** Every size, including the biggest seal. Critical-path routes are at least this wide. */
  OPEN: 260,
} as const;

export const S = WORLD.surfaceY;
export const MAP_WIDTH = 40000;

export type Opts = { blend?: number; rough?: number };
export const add = (shape: TerrainShape, o: Opts = {}): TerrainOp => ({ mode: 'add', shape, ...o });
export const cut = (shape: TerrainShape, o: Opts = {}): TerrainOp => ({ mode: 'cut', shape, ...o });
export const circle = (x: number, y: number, r: number): TerrainShape => ({ type: 'circle', x, y, r });
export const ellipse = (x: number, y: number, rx: number, ry: number, rot = 0): TerrainShape => ({
  type: 'ellipse',
  x,
  y,
  rx,
  ry,
  rot,
});
export const box = (x: number, y: number, w: number, h: number, round = 20, rot = 0): TerrainShape => ({
  type: 'box',
  x,
  y,
  w,
  h,
  round,
  rot,
});
export const poly = (...points: Array<[number, number]>): TerrainShape => ({ type: 'poly', points });
export const capsule = (x1: number, y1: number, x2: number, y2: number, r1: number, r2 = r1) =>
  ({ type: 'capsule', x1, y1, x2, y2, r1, r2 }) as TerrainShape;

/** A winding tunnel of the given width (px) along a path, cut out of the rock. */
export function tunnel(points: Array<[number, number]>, width: number, o: Opts = {}): TerrainOp[] {
  const ops: TerrainOp[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    ops.push(cut(capsule(x1, y1, x2, y2, width / 2), { blend: 24, ...o }));
  }
  return ops;
}

/** A rock ring you can swim through (inner diameter = hole). */
export function ring(x: number, y: number, outer: number, hole: number): TerrainOp[] {
  return [add(circle(x, y, outer), { rough: 18 }), cut(circle(x, y, hole / 2), { blend: 20 })];
}

/** A rock spire rising from the seabed at `baseY` up to `topY`. */
export function spire(x: number, baseY: number, topY: number, r: number, lean = 0): TerrainOp {
  return add(capsule(x, baseY + r, x + lean, topY + r * 0.6, r * 1.25, r), { rough: 18, blend: 90 });
}

/**
 * A rock mound with a hidden chamber: an entrance tunnel of `width` from the side or top
 * into a round chamber. Returns the ops and the chamber centre (where a pearl/chest goes).
 */
export function grotto(
  x: number,
  y: number,
  o: {
    rx: number;
    ry: number;
    width: number;
    chamber: number;
    entrance: 'left' | 'right' | 'top';
    /** Bends the entrance tunnel (px up/down at its middle). */
    bend?: number;
  },
): { ops: TerrainOp[]; chamber: { x: number; y: number } } {
  const ops: TerrainOp[] = [add(ellipse(x, y, o.rx, o.ry), { rough: 20, blend: 120 })];
  const cy = y + o.ry * 0.15;
  ops.push(cut(circle(x, cy, o.chamber), { blend: 30, rough: 8 }));
  const bend = o.bend ?? 0;
  const end: [number, number] =
    o.entrance === 'left'
      ? [x - o.rx - 80, cy - 30]
      : o.entrance === 'right'
        ? [x + o.rx + 80, cy - 30]
        : [x + 40, y - o.ry - 80];
  const mid: [number, number] = [(x + end[0]) / 2, (cy + end[1]) / 2 + bend];
  ops.push(...tunnel([[x, cy], mid, end], o.width));
  return { ops, chamber: { x, y: cy + o.chamber * 0.35 } };
}

/**
 * An island: rock from `baseY` (on the seabed) up to `topY` above the water, with sloping
 * sandy sides so a seal can slide up onto it.
 */
export function island(xc: number, halfWidth: number, topY: number, baseY: number): TerrainOp {
  const w = halfWidth;
  return add(
    poly(
      [xc - w - 500, baseY],
      [xc - w, S + 120],
      [xc - w * 0.6, S - 40],
      [xc - w * 0.25, topY + 20],
      [xc, topY],
      [xc + w * 0.25, topY + 20],
      [xc + w * 0.6, S - 40],
      [xc + w, S + 120],
      [xc + w + 500, baseY],
    ),
    { rough: 12, blend: 160 },
  );
}

/** The seabed profile's points for a beach climbing out of the water at a map edge. */
export function beachProfile(side: 'west' | 'east', width = MAP_WIDTH): Array<[number, number]> {
  // Land plateau ~300 px above the water, a long sandy slope, then the shallows.
  const west: Array<[number, number]> = [
    [0, S - 320],
    [600, S - 300],
    [1200, S - 120],
    [1600, S + 60],
    [2100, S + 260],
    [2600, S + 520],
  ];
  return side === 'west' ? west : west.map(([x, y]) => [width - x, y] as [number, number]).reverse();
}
