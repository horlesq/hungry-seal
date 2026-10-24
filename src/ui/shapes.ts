// Rounded rectangles, circles and arcs for Graphics, built as polygons with only as many points
// as the radius needs. Phaser's WebGL renderer cuts every arc into 100 points and triangulates
// the result again on every frame, so the stock fillRoundedRect (4 arcs = 400 points) and
// fillCircle made the HUD ~40% of a phone's frame (scripts/perf.mjs). Use these instead.
import type Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;
type Point = { x: number; y: number };

/** Graphics only reads x and y of the points it is given. */
const vec = (points: Point[]) => points as unknown as Phaser.Math.Vector2[];

/** Segments per quarter circle: about one per 2.5 design units of radius (smooth when zoomed). */
function quarterSegments(r: number): number {
  return Math.max(3, Math.min(12, Math.ceil(r / 2.5)));
}

/** Points along an arc from a0 to a1 (radians, clockwise on screen), including both ends. */
function arcPoints(out: Point[], cx: number, cy: number, r: number, a0: number, a1: number) {
  const steps = Math.max(1, Math.ceil((quarterSegments(r) * Math.abs(a1 - a0)) / (Math.PI / 2)));
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
}

function roundRectPoints(x: number, y: number, w: number, h: number, radius: number): Point[] {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  const out: Point[] = [];
  if (r <= 0.5) {
    out.push({ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h });
    return out;
  }
  const P = Math.PI;
  arcPoints(out, x + r, y + r, r, P, P * 1.5);
  arcPoints(out, x + w - r, y + r, r, P * 1.5, P * 2);
  arcPoints(out, x + w - r, y + h - r, r, 0, P * 0.5);
  arcPoints(out, x + r, y + h - r, r, P * 0.5, P);
  return out;
}

/** Fills a rounded rectangle in the current fill style. */
export function fillRoundRect(g: G, x: number, y: number, w: number, h: number, r: number): G {
  return g.fillPoints(vec(roundRectPoints(x, y, w, h, r)), true, true);
}

/** Strokes a rounded rectangle in the current line style. */
export function strokeRoundRect(g: G, x: number, y: number, w: number, h: number, r: number): G {
  return g.strokePoints(vec(roundRectPoints(x, y, w, h, r)), true, true);
}

/** Fills a circle in the current fill style. */
export function fillDisc(g: G, x: number, y: number, r: number): G {
  return g.fillPoints(vec(arcPoints([], x, y, r, 0, Math.PI * 2).slice(1)), true, true);
}

/** Strokes a circle in the current line style. */
export function strokeRing(g: G, x: number, y: number, r: number): G {
  return g.strokePoints(vec(arcPoints([], x, y, r, 0, Math.PI * 2).slice(1)), true, true);
}

/** Strokes an open arc (a progress ring) from a0 to a1 in the current line style. */
export function strokeArc(g: G, x: number, y: number, r: number, a0: number, a1: number): G {
  if (Math.abs(a1 - a0) < 1e-3) return g;
  return g.strokePoints(vec(arcPoints([], x, y, r, a0, a1)), false, false);
}
