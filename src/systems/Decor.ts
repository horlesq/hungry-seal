// Map decorations: hand-placed landmarks (wrecks, lighthouses, palms) and decor scattered
// along the ground (coral, kelp, rocks) or hanging from overhangs (icicles). Placed once per
// run from the map config; only sprites near the view are visible. Animated decor (kelp,
// seaweed, anemones, vents) loops its frames.
import Phaser from 'phaser';
import { Depths } from '../config/depths';
import type { DecorPlacement, ScatterRule } from '../config/maps';
import { textureScale } from '../services/Viewport';
import { loopFrames } from '../entities/sheetAnim';
import { createRng, type Rng } from '../utils/rng';
import type { GameMap } from '../world/GameMap';
import type { TerrainField } from '../world/terrain';

/** Decor bases sink this far into the ground so they look planted. */
const SINK = 8;
/** Ground steeper than this (normal y > -cos) gets no scattered decor. */
const MAX_SLOPE_NORMAL_Y = -0.75;
const CULL_MARGIN = 400;

interface Item {
  sprite: Phaser.GameObjects.Sprite;
  animated: boolean;
  phase: number;
  /** Bounds for culling. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export class Decor {
  private readonly items: Item[] = [];
  private time = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    map: GameMap,
  ) {
    const rng = createRng(map.def.terrain.seed * 7 + 3);
    const t = map.terrain;
    for (const d of map.def.decor) this.place(d, t);
    for (const rule of map.def.scatter) this.scatter(rule, t, rng);
  }

  /** Number of decor sprites (debug / soak). */
  get count(): number {
    return this.items.length;
  }

  update(dt: number, camera: Phaser.Cameras.Scene2D.Camera): void {
    this.time += dt;
    const v = camera.worldView;
    const left = v.x - CULL_MARGIN;
    const right = v.right + CULL_MARGIN;
    const top = v.y - CULL_MARGIN;
    const bottom = v.bottom + CULL_MARGIN;
    for (const it of this.items) {
      const on = it.x1 > left && it.x0 < right && it.y1 > top && it.y0 < bottom;
      if (it.sprite.visible !== on) it.sprite.setVisible(on);
      if (on && it.animated) loopFrames(it.sprite, this.time + it.phase);
    }
  }

  destroy(): void {
    for (const it of this.items) it.sprite.destroy();
    this.items.length = 0;
  }

  private place(d: DecorPlacement, terrain: TerrainField): void {
    let y = d.y;
    if (d.hang) {
      const c = terrain.ceilingAbove(d.x, d.y, 800);
      if (c === null) return;
      y = c - SINK;
    } else {
      const g = terrain.groundBelow(d.x, d.y, 1200);
      if (g !== null) y = g + SINK;
    }
    this.add(d.key, d.x, y, d.scale ?? 1, d.flip ?? false, d.hang ?? false, d.front ?? false, 0);
  }

  private scatter(rule: ScatterRule, terrain: TerrainField, rng: Rng): void {
    const n = { x: 0, y: 0 };
    const [s0, s1] = rule.scale ?? [0.85, 1.15];
    for (let x = 220; x < terrain.width - 220; x += rule.spacing * (0.6 + rng() * 0.8)) {
      for (const y of rule.hang
        ? ceilings(terrain, x, rule.minY, rule.maxY)
        : grounds(terrain, x, rule.minY, rule.maxY)) {
        terrain.normal(x, rule.hang ? y + 4 : y - 4, n);
        if (rule.hang ? n.y < 0.75 : n.y > MAX_SLOPE_NORMAL_Y) continue;
        const key = rule.keys[Math.floor(rng() * rule.keys.length)];
        const front = rng() < (rule.front ?? 0);
        const scale = s0 + rng() * (s1 - s0);
        const yy = rule.hang ? y - SINK : y + SINK;
        this.add(key, x, yy, scale, rng() < 0.5, rule.hang ?? false, front, rng() * 10);
      }
    }
  }

  private add(
    key: string,
    x: number,
    y: number,
    scale: number,
    flip: boolean,
    hang: boolean,
    front: boolean,
    phase: number,
  ): void {
    if (!this.scene.textures.exists(key)) return;
    const s = scale * textureScale(this.scene, key);
    const sprite = this.scene.add
      .sprite(x, y, key)
      .setOrigin(0.5, hang ? 0 : 1)
      .setScale(s)
      .setFlipX(flip)
      .setDepth(front ? Depths.DecorFront : Depths.DecorBack);
    const w = sprite.displayWidth;
    const h = sprite.displayHeight;
    this.items.push({
      sprite,
      animated: sprite.texture.frameTotal > 2,
      phase,
      x0: x - w / 2,
      x1: x + w / 2,
      y0: hang ? y : y - h,
      y1: hang ? y + h : y,
    });
  }
}

/** Every ground surface (rock below open water) along x within [minY, maxY]. */
function grounds(t: TerrainField, x: number, minY: number, maxY: number): number[] {
  const out: number[] = [];
  let y = minY;
  while (y < maxY) {
    if (t.distance(x, y) <= 0) {
      // Inside rock: skip down to open water again.
      while (y < maxY && t.distance(x, y) <= 0) y += 12;
      continue;
    }
    const g = t.groundBelow(x, y, maxY - y);
    if (g === null) break;
    out.push(g);
    y = g + 12;
  }
  return out;
}

/** Every ceiling (rock above open water) along x within [minY, maxY]. */
function ceilings(t: TerrainField, x: number, minY: number, maxY: number): number[] {
  const out: number[] = [];
  let wasRock = t.distance(x, minY) <= 0;
  for (let y = minY + 6; y < maxY; y += 6) {
    const rock = t.distance(x, y) <= 0;
    if (wasRock && !rock) out.push(y - 3);
    wasRock = rock;
  }
  return out;
}
