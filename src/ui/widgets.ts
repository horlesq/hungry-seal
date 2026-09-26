// Small shared UI pieces: the ocean backdrop behind menu screens, the coin balance pill and
// segmented level bars.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { textureScale } from '../services/Viewport';
import type { Viewport } from '../utils/viewport';
import { COLORS, CSS, drawPanel, formatNumber, reducedMotion, uiText } from './theme';

export interface Backdrop {
  top: number;
  bottom: number;
  rays: number;
}

export const BACKDROPS = {
  /** Bright shallows just under the surface (title screen). */
  shallows: { top: 0x2ac6d8, bottom: 0x0c3f7a, rays: 0.3 },
  /** Deeper, calmer water (upgrades). */
  deep: { top: 0x145f96, bottom: 0x05203d, rays: 0.14 },
} as const satisfies Record<string, Backdrop>;

/** Water gradient, light rays from the surface and slowly rising bubbles. */
export function addBackdrop(scene: Phaser.Scene, v: Viewport, b: Backdrop): void {
  const bg = scene.add.graphics();
  bg.fillGradientStyle(b.top, b.top, b.bottom, b.bottom, 1);
  bg.fillRect(0, 0, v.viewWidth, v.viewHeight);
  // Rays fade out within one texture height; don't tile them vertically.
  const raysScale = textureScale(scene, TextureKeys.LightRays);
  const rays = scene.textures.getFrame(TextureKeys.LightRays);
  scene.add
    .tileSprite(v.viewWidth / 2, 0, v.viewWidth, rays.height * raysScale, TextureKeys.LightRays)
    .setTileScale(raysScale, raysScale)
    .setOrigin(0.5, 0)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(b.rays);
  if (reducedMotion()) return;
  const ts = textureScale(scene, TextureKeys.Bubble);
  const bubbles = scene.add.particles(0, 0, TextureKeys.Bubble, {
    x: { min: 0, max: v.viewWidth },
    y: v.viewHeight + 24,
    lifespan: { min: 7000, max: 12000 },
    speedY: { min: -100, max: -45 },
    speedX: { min: -10, max: 10 },
    scale: { min: 0.22 * ts, max: 0.6 * ts },
    alpha: { start: 0.5, end: 0 },
    frequency: 320,
    maxParticles: 50,
  });
  // Start with bubbles already on screen.
  bubbles.fastForward(9000);
}

/** Coin balance chip anchored by its right edge. */
export class CoinPill extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, right: number, y: number, coins: number) {
    super(scene, right, y);
    this.bg = scene.add.graphics();
    this.icon = scene.add
      .image(0, 0, TextureKeys.Coin)
      .setScale(1.05 * textureScale(scene, TextureKeys.Coin));
    this.text = uiText(scene, 0, 1, '', 'heading', { size: 28, color: CSS.gold }).setOrigin(1, 0.5);
    this.add([this.bg, this.icon, this.text]);
    scene.add.existing(this);
    this.setCoins(coins);
  }

  setCoins(coins: number): this {
    this.text.setText(formatNumber(coins));
    const h = 52;
    const w = 16 + 32 + 10 + this.text.width + 20;
    this.bg.clear();
    drawPanel(this.bg, -w, -h / 2, w, h, { radius: h / 2, alpha: 0.62, line: 0.18 });
    this.icon.setPosition(-w + 16 + 16, 0);
    this.text.setX(-20);
    return this;
  }
}

/**
 * Horizontal bar made of `count` segments; `filled` counts whole segments plus a fraction
 * (2.4 = two full, the third 40% full).
 */
export function drawSegments(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  count: number,
  filled: number,
  color: number,
  gap = 5,
): void {
  const segW = (w - gap * (count - 1)) / count;
  const r = Math.min(h / 2, segW / 2);
  for (let i = 0; i < count; i++) {
    const sx = x + i * (segW + gap);
    g.fillStyle(COLORS.trench, 0.75).fillRoundedRect(sx, y, segW, h, r);
    const f = Phaser.Math.Clamp(filled - i, 0, 1);
    if (f > 0) g.fillStyle(color, 1).fillRoundedRect(sx, y, Math.max(h, segW * f), h, r);
  }
}

/** A rounded progress bar with a track; `frac` in 0..1. */
export function drawBar(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  color: number,
  alpha = 1,
): void {
  const r = h / 2;
  g.fillStyle(COLORS.trench, 0.75).fillRoundedRect(x, y, w, h, r);
  const f = Phaser.Math.Clamp(frac, 0, 1);
  if (f <= 0) return;
  const fw = Math.max(h, w * f);
  g.fillStyle(color, alpha).fillRoundedRect(x, y, fw, h, r);
  // Soft top highlight so fills read as liquid rather than flat paint.
  if (h >= 14) {
    g.fillStyle(0xffffff, 0.22 * alpha).fillRoundedRect(
      x + r / 2,
      y + 3,
      fw - r,
      h * 0.28,
      h * 0.14,
    );
  }
}
