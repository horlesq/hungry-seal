// Map decorations: hand-placed landmarks (wrecks, lighthouses, palms, beach props) and decor
// scattered along the ground (coral, kelp, rocks), hanging from overhangs (icicles) or set
// into the terrain's edge at any angle (rock, coral and ice clusters that break up the smooth
// contour). Placed once per run from the map config; only sprites near the view are visible.
// Animated decor (kelp, seaweed, anemones, vents) loops its frames; variant sheets show one
// randomly picked look.
import Phaser from 'phaser';
import { VARIANT_SHEETS, type TextureKey } from '../config/assets';
import { Depths } from '../config/depths';
import { WORLD } from '../config/zones';
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
/** Edge props: this much open water must lie in front of a spot (keeps passages readable). */
const EDGE_CLEAR = 90;

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
    for (const rule of map.def.scatter) {
      if (rule.edge) this.scatterEdge(rule, t, rng);
      else this.scatter(rule, t, rng);
    }
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
    if (d.free) {
      // Exactly where it's placed (a pier over the water).
    } else if (d.hang) {
      const c = terrain.ceilingAbove(d.x, d.y, 800);
      if (c === null) return;
      y = c - SINK;
    } else {
      const g = terrain.groundBelow(d.x, d.y, 1200);
      if (g !== null) y = g + SINK;
    }
    const it = this.add(d.key, d.x, y, d.scale ?? 1, d.flip ?? false, d.hang ?? false, d.front ?? false, 0);
    if (it && d.frame !== undefined) it.sprite.setFrame(d.frame);
  }

  /**
   * Edge props along the contour: a jittered grid over the band, each sample snapped onto the
   * surface along the distance-field normal, kept apart from its neighbours, turned so its
   * base faces into the rock, and skipped where the water in front is too narrow.
   */
  private scatterEdge(rule: ScatterRule, terrain: TerrainField, rng: Rng): void {
    const n = { x: 0, y: 0 };
    const step = rule.spacing;
    const gap2 = (step * 0.7) ** 2;
    const taken = new Map<number, Array<[number, number]>>();
    const [s0, s1] = rule.scale ?? [0.85, 1.15];
    const x0 = Math.max(0, rule.minX ?? 0);
    const x1 = Math.min(terrain.width, rule.maxX ?? Infinity);
    const sink = rule.sink ?? 0.4;
    const crowded = (sx: number, sy: number): boolean => {
      const cx = Math.floor(sx / step);
      const cy = Math.floor(sy / step);
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          for (const [px, py] of taken.get((cx + i) * 4096 + cy + j) ?? []) {
            if ((px - sx) ** 2 + (py - sy) ** 2 < gap2) return true;
          }
        }
      }
      return false;
    };
    for (let gx = x0; gx < x1; gx += step) {
      for (let gy = rule.minY; gy < rule.maxY; gy += step) {
        const x = gx + rng() * step;
        const y = gy + rng() * step;
        if (Math.abs(terrain.distance(x, y)) > step * 0.75) continue;
        // The field is only roughly Euclidean: step onto the surface a few times, then check.
        let sx = x;
        let sy = y;
        for (let k = 0; k < 4; k++) {
          const d = terrain.distance(sx, sy);
          terrain.normal(sx, sy, n);
          sx -= n.x * d;
          sy -= n.y * d;
        }
        if (Math.abs(terrain.distance(sx, sy)) > 4) continue;
        terrain.normal(sx, sy, n);
        if (rule.facing === 'up' && n.y > -0.5) continue;
        if (sx < x0 || sx > x1 || sy < rule.minY || sy > rule.maxY) continue;
        if (terrain.distance(sx + n.x * EDGE_CLEAR, sy + n.y * EDGE_CLEAR) < EDGE_CLEAR * 0.55) continue;
        if (crowded(sx, sy)) continue;
        const cell = Math.floor(sx / step) * 4096 + Math.floor(sy / step);
        const list = taken.get(cell) ?? [];
        list.push([sx, sy]);
        taken.set(cell, list);
        const key = rule.keys[Math.floor(rng() * rule.keys.length)];
        const it = this.add(key, sx, sy, s0 + rng() * (s1 - s0), rng() < 0.5, false, false, 0, rng);
        if (!it) continue;
        const s = it.sprite;
        s.setOrigin(0.5, 1 - sink).setRotation(Math.atan2(n.x, -n.y)).setDepth(Depths.TerrainEdge);
        if (rule.tint) {
          const k = Phaser.Math.Clamp((sy - WORLD.surfaceY) / (WORLD.height - WORLD.surfaceY), 0, 1);
          const c = Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.IntegerToColor(rule.tint[0]),
            Phaser.Display.Color.IntegerToColor(rule.tint[1]),
            100,
            Math.round(k * 100),
          );
          s.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
        }
        // Rotated: cull by a box around the anchor.
        const r = Math.max(s.displayWidth, s.displayHeight);
        it.x0 = sx - r;
        it.x1 = sx + r;
        it.y0 = sy - r;
        it.y1 = sy + r;
      }
    }
  }

  private scatter(rule: ScatterRule, terrain: TerrainField, rng: Rng): void {
    const n = { x: 0, y: 0 };
    const [s0, s1] = rule.scale ?? [0.85, 1.15];
    const x0 = Math.max(220, rule.minX ?? 0);
    const x1 = Math.min(terrain.width - 220, rule.maxX ?? Infinity);
    for (let x = x0; x < x1; x += rule.spacing * (0.6 + rng() * 0.8)) {
      for (const y of rule.hang
        ? ceilings(terrain, x, rule.minY, rule.maxY)
        : grounds(terrain, x, rule.minY, rule.maxY)) {
        terrain.normal(x, rule.hang ? y + 4 : y - 4, n);
        if (rule.hang ? n.y < 0.75 : n.y > MAX_SLOPE_NORMAL_Y) continue;
        const key = rule.keys[Math.floor(rng() * rule.keys.length)];
        const front = rng() < (rule.front ?? 0);
        const scale = s0 + rng() * (s1 - s0);
        const yy = rule.hang ? y - SINK : y + SINK;
        this.add(key, x, yy, scale, rng() < 0.5, rule.hang ?? false, front, rng() * 10, rng);
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
    rng: Rng = Math.random,
  ): Item | null {
    if (!this.scene.textures.exists(key)) return null;
    const s = scale * textureScale(this.scene, key);
    const sprite = this.scene.add
      .sprite(x, y, key)
      .setOrigin(0.5, hang ? 0 : 1)
      .setScale(s)
      .setFlipX(flip)
      .setDepth(front ? Depths.DecorFront : Depths.DecorBack);
    const variants = VARIANT_SHEETS.has(key as TextureKey);
    if (variants) sprite.setFrame(Math.floor(rng() * (sprite.texture.frameTotal - 1)));
    const w = sprite.displayWidth;
    const h = sprite.displayHeight;
    const item: Item = {
      sprite,
      animated: !variants && sprite.texture.frameTotal > 2,
      phase,
      x0: x - w / 2,
      x1: x + w / 2,
      y0: hang ? y : y - h,
      y1: hang ? y + h : y,
    };
    this.items.push(item);
    return item;
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
