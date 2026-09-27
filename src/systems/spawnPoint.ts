// Shared helper: pick a point just outside the camera view, biased ahead of the seal's
// movement, clamped to a vertical band. Used by every spawner (prey, hazards, predators, coins).
import type Phaser from 'phaser';
import { zoneAt, type ZoneId } from '../config/zones';
import { canEat } from './feeding';

/** Weighted random pick among entries allowed in the zone at world-y `y`, or null. */
export function pickForZone<T extends { zones: readonly ZoneId[]; weight: number }>(
  list: readonly T[],
  y: number,
  random: () => number,
): T | null {
  const zone = zoneAt(y).id;
  const candidates = list.filter((d) => d.zones.includes(zone));
  const total = candidates.reduce((sum, d) => sum + d.weight, 0);
  if (total <= 0) return null;
  let roll = random() * total;
  for (const d of candidates) {
    roll -= d.weight;
    if (roll <= 0) return d;
  }
  return candidates[candidates.length - 1];
}

export interface SpawnPointOptions {
  marginMin: number;
  marginMax: number;
  /** Chance to spawn in the seal's direction of travel (when it's moving). */
  aheadBias: number;
  /** Vertical band the point is clamped into. */
  top: number;
  bottom: number;
  attempts?: number;
}

export interface Mover {
  vx: number;
  vy: number;
}

export function pickOffscreenPoint(
  camera: Phaser.Cameras.Scene2D.Camera,
  seal: Mover,
  random: () => number,
  opts: SpawnPointOptions,
): { x: number; y: number } | null {
  if (opts.bottom <= opts.top) return null;
  const view = camera.worldView;
  const halfW = view.width / 2;
  const halfH = view.height / 2;
  const moving = Math.hypot(seal.vx, seal.vy) > 40;

  for (let attempt = 0; attempt < (opts.attempts ?? 5); attempt++) {
    const angle =
      moving && random() < opts.aheadBias
        ? Math.atan2(seal.vy, seal.vx) + (random() - 0.5) * 2.1
        : random() * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Distance from the view centre to its edge along `angle`, plus a margin.
    const toEdge = Math.min(
      Math.abs(cos) > 1e-3 ? halfW / Math.abs(cos) : Infinity,
      Math.abs(sin) > 1e-3 ? halfH / Math.abs(sin) : Infinity,
    );
    const dist = toEdge + opts.marginMin + random() * (opts.marginMax - opts.marginMin);
    const x = camera.midPoint.x + cos * dist;
    const y = Math.min(opts.bottom, Math.max(opts.top, camera.midPoint.y + sin * dist));
    // Clamping into the band may have pulled the point into view; try another angle.
    if (!view.contains(x, y)) return { x, y };
  }
  return null;
}

/**
 * Species to spawn at world-y `y`. While food is short (`foodForStage` set), only species a
 * seal of that stage can eat, if any live at that depth; otherwise any species of the zone.
 */
export function pickSpawn<T extends { zones: readonly ZoneId[]; weight: number; tier: number }>(
  list: readonly T[],
  y: number,
  random: () => number,
  foodForStage: number | null,
): T | null {
  if (foodForStage !== null) {
    const food = pickForZone(
      list.filter((d) => canEat(foodForStage, d.tier)),
      y,
      random,
    );
    if (food) return food;
  }
  return pickForZone(list, y, random);
}
