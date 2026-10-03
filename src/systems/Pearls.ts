// Pearls: six hidden collectibles per map (docs/LEVEL_DESIGN.md). Unfound pearls glow in
// place; touching one saves it right away (quitting a run doesn't lose it), and finding
// enough opens the next map.
import Phaser from 'phaser';
import { SoundKeys } from '../audio/sounds';
import { Depths } from '../config/depths';
import { TextureKeys } from '../config/assets';
import { MAPS } from '../config/maps';
import { audio } from '../services/AudioManager';
import { EventBus } from '../services/EventBus';
import { saves } from '../services/SaveService';
import { textureScale } from '../services/Viewport';
import type { GameMap } from '../world/GameMap';
import type { Effects } from './Effects';
import { circlesOverlap } from './feeding';

export const PEARL_KEY = 'item-pearl';
const PEARL_RADIUS = 22;

interface Pearl {
  index: number;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  age: number;
}

export class Pearls {
  private readonly items: Pearl[] = [];
  readonly total: number;

  constructor(
    scene: Phaser.Scene,
    private readonly map: GameMap,
    private readonly effects: Effects,
  ) {
    createPearlTexture(scene);
    const found = saves.data.maps.pearls[map.id] ?? [];
    this.total = map.def.pearls.length;
    map.def.pearls.forEach((p, index) => {
      if (found.includes(index)) return;
      const glow = scene.add
        .image(p.x, p.y, TextureKeys.Glow)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffc8f0)
        .setScale(0.32 * textureScale(scene, TextureKeys.Glow))
        .setDepth(Depths.Glow);
      const sprite = scene.add.image(p.x, p.y, PEARL_KEY).setScale(textureScale(scene, PEARL_KEY)).setDepth(9);
      this.items.push({ index, x: p.x, y: p.y, sprite, glow, age: index * 0.7 });
    });
  }

  get found(): number {
    return (saves.data.maps.pearls[this.map.id] ?? []).length;
  }

  /** Bobs the pearls and collects any the seal touches. Returns true if one was collected. */
  update(dt: number, seal: { x: number; y: number; radius: number }, collecting: boolean): boolean {
    let got = false;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.age += dt;
      const y = p.y + Math.sin(p.age * 2.2) * 6;
      p.sprite.setY(y);
      p.glow.setPosition(p.x, y).setAlpha(0.55 + 0.25 * Math.sin(p.age * 3));
      if (!collecting || !circlesOverlap(seal.x, seal.y, seal.radius, p.x, y, PEARL_RADIUS)) continue;
      this.collect(p);
      this.items.splice(i, 1);
      got = true;
    }
    return got;
  }

  private collect(p: Pearl): void {
    const result = saves.collectPearl(this.map.id, p.index);
    p.sprite.destroy();
    p.glow.destroy();
    this.effects.growBurst(p.x, p.y);
    audio.play(SoundKeys.Gem);
    const found = this.found;
    this.effects.floatText(p.x, p.y - 50, `PEARL ${found}/${this.total}!`, '#ffd6f5', 40);
    EventBus.emit('run:pearls', { found, total: this.total });
    for (const id of result?.unlocked ?? []) {
      this.effects.floatText(p.x, p.y - 100, `${MAPS[id].name} unlocked!`, '#7fe8f5', 34);
      audio.play(SoundKeys.Unlock);
    }
  }

  /** Unfound pearl positions (pause map). */
  get remaining(): ReadonlyArray<{ x: number; y: number }> {
    return this.items;
  }

  destroy(): void {
    for (const p of this.items) {
      p.sprite.destroy();
      p.glow.destroy();
    }
    this.items.length = 0;
  }
}

/** A shiny pink-white pearl (2x for crisp scaling). */
function createPearlTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(PEARL_KEY)) return;
  const r = 22;
  const res = 2;
  const tex = scene.textures.createCanvas(PEARL_KEY, r * 2 * res + 8, r * 2 * res + 8);
  if (!tex) return;
  const ctx = tex.context;
  ctx.scale(res, res);
  const c = r + 2;
  const g = ctx.createRadialGradient(c - 6, c - 7, 2, c, c, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, '#fde8f6');
  g.addColorStop(1, '#d9a6d4');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, r - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = '#5a2f5c';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.ellipse(c - 7, c - 8, 5, 3.5, -0.6, 0, Math.PI * 2);
  ctx.fill();
  tex.refresh();
  (tex.customData as { resolution?: number }).resolution = res;
}
