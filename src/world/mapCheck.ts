// Map validation (level-design "prove the critical path"): flood-fills a map's open water
// with a seal of each size and reports what it can reach. Gates (currents) are closed to
// seals below their size. Pure: used by mapCheck.test.ts and the map overview tool.
import type { MapDef } from '../config/maps';
import { WORLD } from '../config/zones';
import { TERRAIN_CELL, type TerrainField } from './terrain';

/**
 * Body radius per size (index 0 = size 1): the planned 8-size growth ladder in
 * docs/LEVEL_DESIGN.md. Passages are sized from these.
 */
export const SIZE_RADIUS = [18, 23, 28, 34, 41, 50, 60, 73] as const;
export const MAX_SIZE = SIZE_RADIUS.length;

/** A boosted leap clears this much above the water line (px). */
export const LEAP_HEIGHT = 280;

export interface Reach {
  stage: number;
  cols: number;
  rows: number;
  /** 1 = reachable water cell (grid node), 0 = not. */
  cells: Uint8Array;
}

/** Grid nodes a seal of `stage` can reach from the map's start (water only). */
export function reachable(map: MapDef, field: TerrainField, stage: number): Reach {
  const radius = SIZE_RADIUS[stage - 1];
  const { cols, rows } = field;
  const cell = TERRAIN_CELL;
  const cells = new Uint8Array(cols * rows);
  const closedGates = map.gates.filter((g) => stage < g.minStage);
  const top = Math.ceil(WORLD.surfaceY / cell);
  const open = (c: number, r: number) => {
    if (c < 0 || r < top || c >= cols || r >= rows) return false;
    if (field.node(c, r) < radius) return false;
    const x = c * cell;
    const y = r * cell;
    for (const g of closedGates) {
      if (Math.abs(x - g.x) <= g.w / 2 && Math.abs(y - g.y) <= g.h / 2) return false;
    }
    return true;
  };
  let sc = Math.round(map.start.x / cell);
  let sr = Math.max(top, Math.round(map.start.y / cell));
  // A big seal may not fit exactly at the start point: look around it.
  if (!open(sc, sr)) {
    let found = false;
    for (let d = 1; d < 40 && !found; d++) {
      for (let dc = -d; dc <= d && !found; dc++) {
        for (const dr of [-d, d]) {
          if (open(sc + dc, sr + dr)) {
            sc += dc;
            sr += dr;
            found = true;
            break;
          }
        }
      }
    }
    if (!found) return { stage, cols, rows, cells };
  }
  const queue = new Int32Array(cols * rows);
  let head = 0;
  let tail = 0;
  cells[sr * cols + sc] = 1;
  queue[tail++] = sr * cols + sc;
  while (head < tail) {
    const i = queue[head++];
    const c = i % cols;
    const r = (i - c) / cols;
    for (const [nc, nr] of [
      [c + 1, r],
      [c - 1, r],
      [c, r + 1],
      [c, r - 1],
    ]) {
      const j = nr * cols + nc;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows || cells[j]) continue;
      if (!open(nc, nr)) continue;
      cells[j] = 1;
      queue[tail++] = j;
    }
  }
  return { stage, cols, rows, cells };
}

/** Is any reachable cell within `dist` of (x, y)? */
export function reaches(reach: Reach, x: number, y: number, dist: number): boolean {
  const cell = TERRAIN_CELL;
  const c0 = Math.floor((x - dist) / cell);
  const c1 = Math.ceil((x + dist) / cell);
  const r0 = Math.floor((y - dist) / cell);
  const r1 = Math.ceil((y + dist) / cell);
  for (let r = Math.max(0, r0); r <= Math.min(reach.rows - 1, r1); r++) {
    for (let c = Math.max(0, c0); c <= Math.min(reach.cols - 1, c1); c++) {
      if (!reach.cells[r * reach.cols + c]) continue;
      if (Math.hypot(c * cell - x, r * cell - y) <= dist) return true;
    }
  }
  return false;
}

/** Can a seal of this reach touch a pearl/point? Points above the water need a leap. */
export function canCollect(reach: Reach, field: TerrainField, x: number, y: number): boolean {
  const radius = SIZE_RADIUS[reach.stage - 1];
  if (y >= WORLD.surfaceY) return reaches(reach, x, y, radius + 24);
  // Above water: a leap from nearby water must clear the height, through open air.
  if (WORLD.surfaceY - y > LEAP_HEIGHT || field.distance(x, y) < 20) return false;
  return reaches(reach, x, WORLD.surfaceY + radius, radius + 220);
}

/** Smallest size that can reach a region (any of its water), or null. */
export function regionStage(
  map: MapDef,
  reaches: Reach[],
  region: { x0: number; x1: number; y0?: number; y1?: number },
): number | null {
  for (const reach of reaches) {
    const cell = TERRAIN_CELL;
    const c0 = Math.ceil(region.x0 / cell);
    const c1 = Math.floor(region.x1 / cell);
    const r0 = Math.ceil((region.y0 ?? 0) / cell);
    const r1 = Math.floor((region.y1 ?? WORLD.height) / cell);
    let n = 0;
    for (let r = Math.max(0, r0); r <= Math.min(reach.rows - 1, r1); r++) {
      for (let c = Math.max(0, c0); c <= Math.min(reach.cols - 1, c1); c++) {
        if (reach.cells[r * reach.cols + c]) n++;
      }
    }
    // A region counts as reached when there's real room in it, not a sliver.
    if (n >= 40) return reach.stage;
  }
  void map;
  return null;
}
