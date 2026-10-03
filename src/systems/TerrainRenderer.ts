// Draws the map's rock from its distance field, in canvas chunks around the camera.
//
// Each chunk is filled with marching squares (one combined path, so no seams), then:
// a lit rim on top surfaces, the rock body color (sand-brown near the surface, dark in the
// depths, green/white above the water), a speckle texture, and a thick cartoon outline.
// Chunks that are all open water are skipped; far-away chunks are destroyed again.
import Phaser from 'phaser';
import { Depths } from '../config/depths';
import type { MapPalette } from '../config/maps';
import { WORLD } from '../config/zones';
import type { GameMap } from '../world/GameMap';
import type { TerrainField } from '../world/terrain';

const CHUNK = 512;
/** Width of the lit rim on top surfaces (world px). */
const RIM = 12;
const OUTLINE = 5;
/** Chunks built per frame once the first screen is up. */
const BUILDS_PER_FRAME = 2;

interface Chunk {
  key: string;
  image: Phaser.GameObjects.Image | null;
  /** Copy of the water-line strip drawn above the front water line (islands). */
  overWater: Phaser.GameObjects.Image | null;
}

/** Each chunk texture overlaps its neighbours by this much (world px) to hide seams. */
const PAD = 2;
/** Rock within this band around the water line is redrawn over the front water line. */
const WATERLINE_BAND = 70;

export class TerrainRenderer {
  private readonly chunks = new Map<string, Chunk>();
  private readonly field: TerrainField;
  private readonly palette: MapPalette;
  private readonly pattern: HTMLCanvasElement;
  private readonly res: number;
  private primed = false;
  private readonly depth: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: GameMap,
    depth: number = Depths.Terrain,
  ) {
    this.field = map.terrain;
    this.palette = map.def.palette;
    // Texture density: match the camera zoom so rock edges stay crisp (capped for memory).
    this.res = Phaser.Math.Clamp(scene.cameras.main.zoom, 1, 2);
    this.pattern = makeSpecklePattern(map.def.terrain.seed);
    this.depth = depth;
  }

  update(camera: Phaser.Cameras.Scene2D.Camera): void {
    const v = camera.worldView;
    const c0 = Math.floor((v.x - CHUNK / 2) / CHUNK);
    const c1 = Math.floor((v.right + CHUNK / 2) / CHUNK);
    const r0 = Math.floor((v.y - CHUNK / 2) / CHUNK);
    const r1 = Math.floor((v.bottom + CHUNK / 2) / CHUNK);

    // Build missing chunks, nearest to the view centre first.
    const missing: Array<[number, number, number]> = [];
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (!this.chunks.has(`${c},${r}`)) {
          const dx = (c + 0.5) * CHUNK - v.centerX;
          const dy = (r + 0.5) * CHUNK - v.centerY;
          missing.push([c, r, dx * dx + dy * dy]);
        }
      }
    }
    missing.sort((a, b) => a[2] - b[2]);
    const budget = this.primed ? BUILDS_PER_FRAME : Infinity;
    for (let i = 0; i < missing.length && i < budget; i++) this.build(missing[i][0], missing[i][1]);
    this.primed = true;

    // Drop chunks well outside the view.
    for (const [id, chunk] of this.chunks) {
      const [c, r] = id.split(',').map(Number);
      if (c < c0 - 2 || c > c1 + 2 || r < r0 - 2 || r > r1 + 2) {
        this.release(chunk);
        this.chunks.delete(id);
      }
    }
  }

  destroy(): void {
    for (const chunk of this.chunks.values()) this.release(chunk);
    this.chunks.clear();
  }

  /** Number of chunk textures alive (debug overlay / soak test). */
  get liveChunks(): number {
    let n = 0;
    for (const c of this.chunks.values()) if (c.image) n++;
    return n;
  }

  private release(chunk: Chunk): void {
    chunk.image?.destroy();
    chunk.overWater?.destroy();
    if (chunk.image) this.scene.textures.remove(chunk.key);
  }

  private build(c: number, r: number): void {
    const id = `${c},${r}`;
    const key = `terrain-${this.map.id}-${c}-${r}`;
    const x0 = c * CHUNK;
    const y0 = r * CHUNK;
    if (!this.hasRock(x0, y0)) {
      this.chunks.set(id, { key, image: null, overWater: null });
      return;
    }
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    const size = Math.round((CHUNK + PAD * 2) * this.res);
    const tex = this.scene.textures.createCanvas(key, size, size);
    if (!tex) return;
    this.draw(tex.context, x0 - PAD, y0 - PAD);
    tex.refresh();
    const image = this.scene.add
      .image(x0 - PAD, y0 - PAD, key)
      .setOrigin(0, 0)
      .setScale(1 / this.res)
      .setDepth(this.depth);
    let overWater: Phaser.GameObjects.Image | null = null;
    const bandTop = WORLD.surfaceY - WATERLINE_BAND;
    const bandBottom = WORLD.surfaceY + WATERLINE_BAND;
    if (y0 - PAD < bandBottom && y0 + CHUNK + PAD > bandTop) {
      const cropTop = Math.max(0, (bandTop - (y0 - PAD)) * this.res);
      const cropBottom = Math.min(size, (bandBottom - (y0 - PAD)) * this.res);
      overWater = this.scene.add
        .image(x0 - PAD, y0 - PAD, key)
        .setOrigin(0, 0)
        .setScale(1 / this.res)
        .setCrop(0, cropTop, size, cropBottom - cropTop)
        .setDepth(Depths.TerrainOverWater);
    }
    this.chunks.set(id, { key, image, overWater });
  }

  /** Any rock within (or just around) this chunk? */
  private hasRock(x0: number, y0: number): boolean {
    const f = this.field;
    const cell = f.cell;
    const ca = Math.floor(x0 / cell) - 1;
    const ra = Math.floor(y0 / cell) - 1;
    const n = CHUNK / cell + 2;
    for (let r = ra; r <= ra + n; r++) {
      for (let c = ca; c <= ca + n; c++) if (f.node(c, r) < OUTLINE) return true;
    }
    return false;
  }

  private draw(ctx: CanvasRenderingContext2D, x0: number, y0: number): void {
    const p = this.palette;
    const res = this.res;
    ctx.save();
    ctx.scale(res, res);
    ctx.translate(-x0, -y0);

    // Colors by world height: land above the water line, rock below (lighter near the top).
    const s = WORLD.surfaceY / WORLD.height;
    const body = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    body.addColorStop(0, p.land);
    body.addColorStop(s, p.land);
    body.addColorStop(Math.min(1, s + 0.002), p.rockTop);
    body.addColorStop(1, p.rockDeep);
    const rim = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    rim.addColorStop(0, p.landRim);
    rim.addColorStop(s, p.landRim);
    rim.addColorStop(Math.min(1, s + 0.002), p.rockRim);
    rim.addColorStop(1, mix(p.rockRim, p.rockDeep, 0.65));

    // 1. Everything solid in the rim color; 2. the body color, shifted down, leaves a lit
    // band along the top surfaces.
    ctx.fillStyle = rim;
    this.fillRegion(ctx, x0, y0, 0);
    ctx.save();
    ctx.translate(0, RIM * 0.7);
    ctx.fillStyle = body;
    this.fillRegion(ctx, x0, y0, -RIM);
    ctx.restore();

    // 3. Speckles, only on the rock.
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = p.speckle ?? 0.22;
    const pat = ctx.createPattern(this.pattern, 'repeat');
    if (pat) {
      ctx.fillStyle = pat;
      ctx.fillRect(x0, y0, CHUNK + PAD * 2, CHUNK + PAD * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // 4. Outline along the surface.
    ctx.strokeStyle = p.outline;
    ctx.lineWidth = OUTLINE;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    this.strokeContour(ctx, x0, y0);
    ctx.restore();
  }

  /** Fills the region where distance < level (one path for the whole chunk). */
  private fillRegion(ctx: CanvasRenderingContext2D, x0: number, y0: number, level: number): void {
    const f = this.field;
    const cell = f.cell;
    const ca = Math.floor(x0 / cell) - 2;
    const ra = Math.floor(y0 / cell) - 2;
    const n = CHUNK / cell + 4;
    const v = [0, 0, 0, 0];
    const px = [0, 0, 0, 0];
    const py = [0, 0, 0, 0];
    ctx.beginPath();
    for (let r = ra; r < ra + n; r++) {
      for (let c = ca; c < ca + n; c++) {
        v[0] = f.node(c, r) - level;
        v[1] = f.node(c + 1, r) - level;
        v[2] = f.node(c + 1, r + 1) - level;
        v[3] = f.node(c, r + 1) - level;
        const inside = (v[0] < 0 ? 1 : 0) + (v[1] < 0 ? 1 : 0) + (v[2] < 0 ? 1 : 0) + (v[3] < 0 ? 1 : 0);
        if (inside === 0) continue;
        const x = c * cell;
        const y = r * cell;
        if (inside === 4) {
          ctx.rect(x, y, cell, cell);
          continue;
        }
        px[0] = x;
        py[0] = y;
        px[1] = x + cell;
        py[1] = y;
        px[2] = x + cell;
        py[2] = y + cell;
        px[3] = x;
        py[3] = y + cell;
        let started = false;
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) & 3;
          if (v[i] < 0) {
            if (!started) ctx.moveTo(px[i], py[i]);
            else ctx.lineTo(px[i], py[i]);
            started = true;
          }
          if (v[i] < 0 !== v[j] < 0) {
            const t = v[i] / (v[i] - v[j]);
            const ex = px[i] + (px[j] - px[i]) * t;
            const ey = py[i] + (py[j] - py[i]) * t;
            if (!started) ctx.moveTo(ex, ey);
            else ctx.lineTo(ex, ey);
            started = true;
          }
        }
        ctx.closePath();
      }
    }
    ctx.fill();
  }

  /** Strokes the distance = 0 contour. */
  private strokeContour(ctx: CanvasRenderingContext2D, x0: number, y0: number): void {
    const f = this.field;
    const cell = f.cell;
    const ca = Math.floor(x0 / cell) - 1;
    const ra = Math.floor(y0 / cell) - 1;
    const n = CHUNK / cell + 2;
    const v = [0, 0, 0, 0];
    const pts: number[] = [];
    ctx.beginPath();
    for (let r = ra; r < ra + n; r++) {
      for (let c = ca; c < ca + n; c++) {
        v[0] = f.node(c, r);
        v[1] = f.node(c + 1, r);
        v[2] = f.node(c + 1, r + 1);
        v[3] = f.node(c, r + 1);
        pts.length = 0;
        const x = c * cell;
        const y = r * cell;
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) & 3;
          if (v[i] < 0 !== v[j] < 0) {
            const t = v[i] / (v[i] - v[j]);
            const xi = i === 1 || i === 2 ? x + cell : x;
            const yi = i >= 2 ? y + cell : y;
            const xj = j === 1 || j === 2 ? x + cell : x;
            const yj = j >= 2 ? y + cell : y;
            pts.push(xi + (xj - xi) * t, yi + (yj - yi) * t);
          }
        }
        for (let k = 0; k + 3 < pts.length; k += 4) {
          ctx.moveTo(pts[k], pts[k + 1]);
          ctx.lineTo(pts[k + 2], pts[k + 3]);
        }
      }
    }
    ctx.stroke();
  }
}

/** Repeating speckle texture: darker pits and lighter flecks. */
function makeSpecklePattern(seed: number): HTMLCanvasElement {
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  let s = seed * 9973 + 1;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < 70; i++) {
    const r = 2 + rand() * 9;
    const ry = r * (0.6 + rand() * 0.4);
    const rot = rand() * Math.PI;
    const x = rand() * size;
    const y = rand() * size;
    ctx.fillStyle = rand() < 0.65 ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)';
    for (const [ox, oy] of [
      [0, 0],
      [size, 0],
      [-size, 0],
      [0, size],
      [0, -size],
    ]) {
      ctx.beginPath();
      ctx.ellipse(x + ox, y + oy, r, ry, rot, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas;
}

/** Mixes two #rrggbb colors. */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) =>
    Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
