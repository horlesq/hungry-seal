// Small picture of a whole map (water gradient, rock and land in the map's colors), drawn
// from its terrain field. Used on the map cards and the pause screen's map.
import type Phaser from 'phaser';
import type { MapId } from '../config/maps';
import { WORLD } from '../config/zones';
import { GameMap } from '../world/GameMap';

/** Texture key of the map's thumbnail, `width` px wide (made on first use). */
export function mapThumbnail(scene: Phaser.Scene, id: MapId, width: number): string {
  const key = `map-thumb-${id}-${width}`;
  if (scene.textures.exists(key)) return key;
  const map = GameMap.get(id);
  const t = map.terrain;
  const p = map.def.palette;
  const scale = width / map.width;
  const height = Math.round(WORLD.height * scale);
  const tex = scene.textures.createCanvas(key, width, height);
  if (!tex) return key;
  const ctx = tex.context;

  const at = (y: number) => y / WORLD.height;
  const water = ctx.createLinearGradient(0, 0, 0, height);
  water.addColorStop(0, p.sky);
  water.addColorStop(at(WORLD.surfaceY), p.horizon);
  water.addColorStop(at(WORLD.surfaceY) + 0.001, p.water.reef);
  water.addColorStop(at(1900), p.water.ocean);
  water.addColorStop(at(3400), p.water.deep);
  water.addColorStop(at(5000), p.water.abyss);
  water.addColorStop(1, p.floor);
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, width, height);

  // Rock: one sample per thumbnail pixel.
  const img = ctx.getImageData(0, 0, width, height);
  const rock = hex(p.rockTop);
  const deep = hex(p.rockDeep);
  const land = hex(p.land);
  const edge = hex(p.outline);
  for (let py = 0; py < height; py++) {
    const y = (py + 0.5) / scale;
    for (let px = 0; px < width; px++) {
      const d = t.distance((px + 0.5) / scale, y);
      if (d > 0) continue;
      const i = (py * width + px) * 4;
      let c: number[];
      if (d > -1.2 / scale) c = edge;
      else if (y < WORLD.surfaceY) c = land;
      else {
        const k = Math.min(1, (y - WORLD.surfaceY) / (WORLD.height - WORLD.surfaceY));
        c = [0, 1, 2].map((j) => rock[j] + (deep[j] - rock[j]) * k);
      }
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  return key;
}

function hex(c: string): number[] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
