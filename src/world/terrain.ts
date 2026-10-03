// Solid terrain as a signed distance field. A map's terrain is a seabed profile plus a list
// of shapes added to (rock, islands, reefs) or cut out of (caves, tunnels, arches) the rock.
// The field is baked once per map into a grid; queries sample it bilinearly, so collision,
// spawning and steering stay cheap no matter how complex the map is.
//
// Sign convention: distance > 0 in open water/air, < 0 inside rock. Pure logic, no Phaser.

export type TerrainShape =
  | { type: 'circle'; x: number; y: number; r: number }
  | { type: 'ellipse'; x: number; y: number; rx: number; ry: number; rot?: number }
  /** Segment with a radius at each end (tunnels, ridges, pillars). */
  | { type: 'capsule'; x1: number; y1: number; x2: number; y2: number; r1: number; r2?: number }
  | { type: 'box'; x: number; y: number; w: number; h: number; round?: number; rot?: number }
  | { type: 'poly'; points: ReadonlyArray<readonly [number, number]> };

export interface TerrainOp {
  mode: 'add' | 'cut';
  shape: TerrainShape;
  /** Smooth blend radius with what's already there (px). */
  blend?: number;
  /** Rocky noise amplitude on this shape's surface (px). */
  rough?: number;
}

export interface TerrainDef {
  width: number;
  height: number;
  /** Seabed profile: (x, y) control points, left to right; y = seabed top. */
  floor: ReadonlyArray<readonly [number, number]>;
  floorRough?: number;
  ops: readonly TerrainOp[];
  seed: number;
}

/** Grid cell size (world px) of the baked field. */
export const TERRAIN_CELL = 16;
/** Distances are clamped to +-this; beyond it only the sign matters. */
export const TERRAIN_MAX_DIST = 200;
/** Thickness of the invisible wall at the map's left/right edges. */
const EDGE_WALL = 60;

// ---------------------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------------------

function hash(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth 2D value noise in [-1, 1]. */
export function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2 - 1;
}

/** Two octaves of value noise, for rocky edges. */
function rockNoise(x: number, y: number, seed: number): number {
  return valueNoise(x / 110, y / 110, seed) * 0.7 + valueNoise(x / 37, y / 37, seed + 7) * 0.3;
}

// ---------------------------------------------------------------------------------------
// Shape distance functions (negative inside)
// ---------------------------------------------------------------------------------------

function sdCircle(px: number, py: number, s: { x: number; y: number; r: number }): number {
  return Math.hypot(px - s.x, py - s.y) - s.r;
}

function rotateInto(px: number, py: number, cx: number, cy: number, rot = 0): [number, number] {
  const dx = px - cx;
  const dy = py - cy;
  if (!rot) return [dx, dy];
  const c = Math.cos(-rot);
  const s = Math.sin(-rot);
  return [dx * c - dy * s, dx * s + dy * c];
}

function sdEllipse(
  px: number,
  py: number,
  s: { x: number; y: number; rx: number; ry: number; rot?: number },
): number {
  // Cheap approximation, good enough near the surface (scaled by the smaller radius).
  const [dx, dy] = rotateInto(px, py, s.x, s.y, s.rot);
  const k = Math.hypot(dx / s.rx, dy / s.ry);
  return (k - 1) * Math.min(s.rx, s.ry);
}

function sdCapsule(
  px: number,
  py: number,
  s: { x1: number; y1: number; x2: number; y2: number; r1: number; r2?: number },
): number {
  const bx = s.x2 - s.x1;
  const by = s.y2 - s.y1;
  const len2 = bx * bx + by * by;
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((px - s.x1) * bx + (py - s.y1) * by) / len2)) : 0;
  const r = s.r1 + ((s.r2 ?? s.r1) - s.r1) * t;
  return Math.hypot(px - (s.x1 + bx * t), py - (s.y1 + by * t)) - r;
}

function sdBox(
  px: number,
  py: number,
  s: { x: number; y: number; w: number; h: number; round?: number; rot?: number },
): number {
  const [dx, dy] = rotateInto(px, py, s.x, s.y, s.rot);
  const r = s.round ?? 0;
  const qx = Math.abs(dx) - s.w / 2 + r;
  const qy = Math.abs(dy) - s.h / 2 + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdPoly(px: number, py: number, pts: ReadonlyArray<readonly [number, number]>): number {
  let d = Infinity;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    const ex = xj - xi;
    const ey = yj - yi;
    const len2 = ex * ex + ey * ey;
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((px - xi) * ex + (py - yi) * ey) / len2)) : 0;
    d = Math.min(d, Math.hypot(px - (xi + ex * t), py - (yi + ey * t)));
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside ? -d : d;
}

export function shapeDistance(px: number, py: number, s: TerrainShape): number {
  switch (s.type) {
    case 'circle':
      return sdCircle(px, py, s);
    case 'ellipse':
      return sdEllipse(px, py, s);
    case 'capsule':
      return sdCapsule(px, py, s);
    case 'box':
      return sdBox(px, py, s);
    case 'poly':
      return sdPoly(px, py, s.points);
  }
}

/** Axis-aligned bounds of a shape: [minX, minY, maxX, maxY]. */
export function shapeBounds(s: TerrainShape): [number, number, number, number] {
  switch (s.type) {
    case 'circle':
      return [s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r];
    case 'ellipse': {
      const r = Math.max(s.rx, s.ry);
      return [s.x - r, s.y - r, s.x + r, s.y + r];
    }
    case 'capsule': {
      const r = Math.max(s.r1, s.r2 ?? s.r1);
      return [
        Math.min(s.x1, s.x2) - r,
        Math.min(s.y1, s.y2) - r,
        Math.max(s.x1, s.x2) + r,
        Math.max(s.y1, s.y2) + r,
      ];
    }
    case 'box': {
      const r = Math.hypot(s.w, s.h) / 2;
      return [s.x - r, s.y - r, s.x + r, s.y + r];
    }
    case 'poly': {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const [x, y] of s.points) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
      return [x0, y0, x1, y1];
    }
  }
}

/** Polynomial smooth minimum (k = blend radius). */
function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
}

function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
}

// ---------------------------------------------------------------------------------------
// Seabed profile
// ---------------------------------------------------------------------------------------

/** Seabed height at x: monotone cubic through the profile points (flat beyond the ends). */
export function floorAt(floor: TerrainDef['floor'], x: number): number {
  if (x <= floor[0][0]) return floor[0][1];
  const last = floor[floor.length - 1];
  if (x >= last[0]) return last[1];
  let i = 0;
  while (i < floor.length - 2 && x > floor[i + 1][0]) i++;
  const [x0, y0] = floor[i];
  const [x1, y1] = floor[i + 1];
  const t = (x - x0) / (x1 - x0);
  const s = t * t * (3 - 2 * t); // smooth step between points: no overshoot
  return y0 + (y1 - y0) * s;
}

// ---------------------------------------------------------------------------------------
// Baked field
// ---------------------------------------------------------------------------------------

interface PreparedOp extends TerrainOp {
  bounds: [number, number, number, number];
}

export class TerrainField {
  readonly cols: number;
  readonly rows: number;
  readonly cell = TERRAIN_CELL;
  readonly data: Float32Array;

  constructor(
    readonly def: TerrainDef,
    data?: Float32Array,
  ) {
    this.cols = Math.ceil(def.width / TERRAIN_CELL) + 1;
    this.rows = Math.ceil(def.height / TERRAIN_CELL) + 1;
    this.data = data ?? bake(def, this.cols, this.rows);
  }

  get width(): number {
    return this.def.width;
  }

  /** Signed distance at a grid node. */
  node(c: number, r: number): number {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -TERRAIN_MAX_DIST;
    return this.data[r * this.cols + c];
  }

  /** Signed distance to the nearest rock (bilinear). Outside the map counts as rock. */
  distance(x: number, y: number): number {
    const gx = x / TERRAIN_CELL;
    const gy = y / TERRAIN_CELL;
    const c = Math.floor(gx);
    const r = Math.floor(gy);
    if (c < 0 || c >= this.cols - 1 || r >= this.rows - 1) return -TERRAIN_MAX_DIST;
    if (r < 0) return this.node(c, 0); // the sky above the map is open
    const fx = gx - c;
    const fy = gy - r;
    const i = r * this.cols + c;
    const d = this.data;
    const top = d[i] + (d[i + 1] - d[i]) * fx;
    const bottom = d[i + this.cols] + (d[i + this.cols + 1] - d[i + this.cols]) * fx;
    return top + (bottom - top) * fy;
  }

  /** Unit normal pointing out of the rock (toward open water) at (x, y). */
  normal(x: number, y: number, out: { x: number; y: number }): { x: number; y: number } {
    const h = TERRAIN_CELL * 0.75;
    const nx = this.distance(x + h, y) - this.distance(x - h, y);
    const ny = this.distance(x, y + h) - this.distance(x, y - h);
    const len = Math.hypot(nx, ny);
    if (len < 1e-6) {
      out.x = 0;
      out.y = -1;
    } else {
      out.x = nx / len;
      out.y = ny / len;
    }
    return out;
  }

  /** True if a circle of radius r at (x, y) is clear of rock. */
  isOpen(x: number, y: number, r = 0): boolean {
    return this.distance(x, y) > r;
  }

  /**
   * World-y of the first rock surface straight below (x, y), scanning at most `maxScan` px,
   * or null if there's none (or (x, y) is inside rock).
   */
  groundBelow(x: number, y: number, maxScan = 2000): number | null {
    let prev = this.distance(x, y);
    if (prev <= 0) return null;
    let yy = y;
    const end = Math.min(this.def.height, y + maxScan);
    while (yy < end) {
      const step = Math.max(4, Math.min(prev * 0.9, TERRAIN_CELL * 2));
      const ny = yy + step;
      const d = this.distance(x, ny);
      if (d <= 0) {
        // Refine between yy (open) and ny (rock).
        let lo = yy;
        let hi = ny;
        for (let k = 0; k < 6; k++) {
          const mid = (lo + hi) / 2;
          if (this.distance(x, mid) > 0) lo = mid;
          else hi = mid;
        }
        return (lo + hi) / 2;
      }
      yy = ny;
      prev = d;
    }
    return null;
  }

  /** World-y of the first rock surface straight above (x, y), or null. */
  ceilingAbove(x: number, y: number, maxScan = 1500): number | null {
    if (this.distance(x, y) <= 0) return null;
    const end = Math.max(0, y - maxScan);
    for (let yy = y; yy > end; yy -= 4) {
      if (this.distance(x, yy) <= 0) return yy + 2;
    }
    return null;
  }

  /** Pushes a circle out of the rock. Returns the push normal if it moved, else null. */
  pushOut(
    pos: { x: number; y: number },
    radius: number,
    n: { x: number; y: number },
  ): { x: number; y: number } | null {
    const d = this.distance(pos.x, pos.y);
    if (d >= radius) return null;
    this.normal(pos.x, pos.y, n);
    pos.x += n.x * (radius - d);
    pos.y += n.y * (radius - d);
    return n;
  }
}

/** Evaluates the field at one point (unclamped where shapes are in range). */
/** Seabed heights sampled every FLOOR_STEP px, for exact distances to the profile. */
const FLOOR_STEP = 8;

export interface FloorSamples {
  step: number;
  heights: Float32Array;
  /** Lowest/highest seabed within reach (TERRAIN_MAX_DIST) of each sample, for early outs. */
  minNear: Float32Array;
  maxNear: Float32Array;
}

export function sampleFloor(def: TerrainDef): FloorSamples {
  const n = Math.ceil(def.width / FLOOR_STEP) + 1;
  const heights = new Float32Array(n);
  for (let i = 0; i < n; i++) heights[i] = floorAt(def.floor, i * FLOOR_STEP);
  const reach = Math.ceil(TERRAIN_MAX_DIST / FLOOR_STEP);
  const minNear = new Float32Array(n);
  const maxNear = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let lo = Infinity;
    let hi = -Infinity;
    for (let k = Math.max(0, i - reach); k <= Math.min(n - 1, i + reach); k++) {
      lo = Math.min(lo, heights[k]);
      hi = Math.max(hi, heights[k]);
    }
    minNear[i] = lo;
    maxNear[i] = hi;
  }
  return { step: FLOOR_STEP, heights, minNear, maxNear };
}

/**
 * Signed distance to the seabed: to the nearest point of the sampled profile within reach
 * (exact enough for sheer cliffs, where a slope-corrected vertical distance badly
 * underestimates the open water above a drop).
 */
function floorDistance(f: FloorSamples, x: number, y: number): number {
  const { step, heights } = f;
  const ic0 = Math.min(heights.length - 1, Math.max(0, Math.round(x / step)));
  // Far above or below every nearby bit of seabed: the distance is clamped anyway.
  if (y < f.minNear[ic0] - TERRAIN_MAX_DIST) return TERRAIN_MAX_DIST;
  if (y > f.maxNear[ic0] + TERRAIN_MAX_DIST) return -TERRAIN_MAX_DIST;
  const i0 = Math.max(0, Math.floor((x - TERRAIN_MAX_DIST) / step));
  const i1 = Math.min(heights.length - 1, Math.ceil((x + TERRAIN_MAX_DIST) / step));
  const ic = Math.min(heights.length - 1, Math.max(0, Math.round(x / step)));
  const below = y < heights[ic];
  let best = Math.abs(heights[ic] - y);
  for (let i = i0; i <= i1; i++) {
    const dx = i * step - x;
    const dy = heights[i] - y;
    // Only profile points on the other side of the surface count.
    if (below ? dy < 0 : dy > 0) continue;
    const d = Math.hypot(dx, dy);
    if (d < best) best = d;
  }
  // Steps between samples: the vertical distance at x bounds it too.
  return below ? best : -best;
}

export function evaluate(
  def: TerrainDef,
  ops: readonly PreparedOp[],
  x: number,
  y: number,
  floor: FloorSamples = sampleFloor(def),
): number {
  let d = floorDistance(floor, x, y);
  if (def.floorRough) d += def.floorRough * rockNoise(x, y, def.seed);
  // Edge walls (open above the map is still bounded by them).
  d = Math.min(d, x - EDGE_WALL, def.width - EDGE_WALL - x);

  const m = TERRAIN_MAX_DIST;
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const b = op.bounds;
    if (x < b[0] - m || x > b[2] + m || y < b[1] - m || y > b[3] + m) continue;
    let s = shapeDistance(x, y, op.shape);
    if (op.rough) s += op.rough * rockNoise(x, y, def.seed + i * 31);
    d = op.mode === 'add' ? smin(d, s, op.blend ?? 0) : smax(d, -s, op.blend ?? 0);
  }
  return d;
}

export function prepareOps(def: TerrainDef): PreparedOp[] {
  return def.ops.map((op) => ({ ...op, bounds: shapeBounds(op.shape) }));
}

function bake(def: TerrainDef, cols: number, rows: number): Float32Array {
  const ops = prepareOps(def);
  const floor = sampleFloor(def);
  const data = new Float32Array(cols * rows);
  const m = TERRAIN_MAX_DIST;
  for (let r = 0; r < rows; r++) {
    const y = r * TERRAIN_CELL;
    for (let c = 0; c < cols; c++) {
      const d = evaluate(def, ops, c * TERRAIN_CELL, y, floor);
      data[r * cols + c] = d > m ? m : d < -m ? -m : d;
    }
  }
  return data;
}
