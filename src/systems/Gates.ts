// Size gates: strong currents across the entrances of the deep, dangerous parts of a map.
// A seal smaller than the gate's size is shoved back (harder than it can swim, even
// boosting); a big enough seal pushes through a gentle flow. Drawn as streaming water with a
// size badge (lock while too small, check once big enough).
import Phaser from 'phaser';
import type { GateDef } from '../config/maps';
import { UiTextures } from '../ui/uiTextures';
import { COLORS, uiText } from '../ui/theme';
import type { GameMap } from '../world/GameMap';

/** Push (px/s) on a seal that's too small: more than its boosted top speed. */
const BLOCK_FLOW = 1300;
/** Drift (px/s) on a seal big enough to swim through. */
const PASS_FLOW = 90;
const STREAKS_KEY = 'fx-current';

interface GateView {
  def: GateDef;
  streaks: Phaser.GameObjects.TileSprite;
  badge: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Image;
}

export class Gates {
  private readonly views: GateView[] = [];
  private stage = 1;
  private time = 0;
  /** Flow function for the seal's motion model (reads the seal's current size). */
  readonly flow = (x: number, y: number, out: { x: number; y: number }): boolean => {
    const g = this.gateAt(x, y);
    if (!g) return false;
    const push = this.stage < g.minStage ? BLOCK_FLOW : PASS_FLOW;
    out.x = g.dir[0] * push;
    out.y = g.dir[1] * push;
    return true;
  };

  constructor(scene: Phaser.Scene, map: GameMap) {
    createStreaksTexture(scene);
    for (const def of map.def.gates) {
      const vertical = def.dir[1] !== 0;
      // The streak texture runs vertically; sideways currents rotate it.
      const streaks = scene.add
        .tileSprite(def.x, def.y, vertical ? def.w : def.h, vertical ? def.h : def.w, STREAKS_KEY)
        .setRotation(vertical ? 0 : Math.PI / 2)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.5)
        .setDepth(6);
      const bg = scene.add.circle(0, 0, 34, COLORS.ink, 0.85).setStrokeStyle(3, COLORS.gold);
      const icon = scene.add.image(0, -8, UiTextures.Lock);
      icon.setScale(26 / icon.width);
      const label = uiText(scene, 0, 16, `SIZE ${def.minStage}`, 'caption', {
        size: 13,
        weight: 800,
      }).setOrigin(0.5);
      // Badge just above a vertical current, or on a sideways one.
      const by = def.y - (vertical ? def.h / 2 + 46 : 0);
      const badge = scene.add.container(def.x, by, [bg, icon, label]).setDepth(30);
      this.views.push({ def, streaks, badge, icon });
    }
  }

  /** The gate whose current is at (x, y), if any. */
  gateAt(x: number, y: number): GateDef | null {
    for (const v of this.views) {
      const g = v.def;
      if (Math.abs(x - g.x) <= g.w / 2 && Math.abs(y - g.y) <= g.h / 2) return g;
    }
    return null;
  }

  /** Is the seal being held back by a gate it's too small for? */
  blocking(x: number, y: number): GateDef | null {
    const g = this.gateAt(x, y);
    return g && this.stage < g.minStage ? g : null;
  }

  update(dt: number, stage: number, camera: Phaser.Cameras.Scene2D.Camera): void {
    this.time += dt;
    if (stage !== this.stage) {
      this.stage = stage;
      for (const v of this.views) {
        const open = stage >= v.def.minStage;
        v.icon.setTexture(open ? UiTextures.Check : UiTextures.Lock).setTint(open ? COLORS.kelp : 0xffffff);
      }
    }
    const view = camera.worldView;
    for (const v of this.views) {
      const g = v.def;
      const on =
        g.x + g.w / 2 > view.x - 200 &&
        g.x - g.w / 2 < view.right + 200 &&
        g.y + g.h / 2 > view.y - 200 &&
        g.y - g.h / 2 < view.bottom + 200;
      v.streaks.setVisible(on);
      v.badge.setVisible(on);
      if (!on) continue;
      // Streaks race along the flow; weaker once the seal is big enough.
      const speed = this.stage < g.minStage ? 420 : 140;
      // Vertical: scrolling the texture up moves streaks up (-y). Sideways sprites are
      // rotated 90 degrees, so their texture's +y points along world -x.
      const along = g.dir[1] !== 0 ? -g.dir[1] : g.dir[0];
      v.streaks.tilePositionY = this.time * speed * along;
      v.streaks.setAlpha(this.stage < g.minStage ? 0.55 : 0.25);
      // Keep the badge over the visible part of a wide gate (near the view's centre).
      if (g.dir[1] !== 0 && g.w > view.width) {
        v.badge.x = Phaser.Math.Clamp(view.centerX, g.x - g.w / 2 + 60, g.x + g.w / 2 - 60);
      }
    }
  }

  destroy(): void {
    for (const v of this.views) {
      v.streaks.destroy();
      v.badge.destroy();
    }
    this.views.length = 0;
  }
}

/** Vertical streaks of fast water (tileable). */
function createStreaksTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(STREAKS_KEY)) return;
  const tex = scene.textures.createCanvas(STREAKS_KEY, 128, 256);
  if (!tex) return;
  const ctx = tex.context;
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = rand() * 128;
    const y = rand() * 256;
    const len = 30 + rand() * 70;
    const grad = ctx.createLinearGradient(x, y, x, y + len);
    grad.addColorStop(0, 'rgba(220,250,255,0)');
    grad.addColorStop(0.5, 'rgba(220,250,255,0.9)');
    grad.addColorStop(1, 'rgba(220,250,255,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2 + rand() * 3;
    for (const oy of [0, -256, 256]) {
      ctx.beginPath();
      ctx.moveTo(x, y + oy);
      ctx.lineTo(x, y + len + oy);
      ctx.stroke();
    }
  }
  tex.refresh();
}
