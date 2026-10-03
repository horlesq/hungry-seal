// Pooled hazard sprite (jellyfish, sea mine). Drifts slowly and bobs; hurts on contact.
// Each hazard carries a glow drawn above the deep-water darkness so it stays visible.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import type { HazardDef } from '../config/hazards';
import { textureScale } from '../services/Viewport';
import { TAU } from '../utils/math';
import { Depths } from '../config/depths';
import { loopFrames } from './sheetAnim';
import { saves } from '../services/SaveService';

export class Hazard extends Phaser.GameObjects.Sprite {
  def!: HazardDef;
  private baseY = 0;
  private age = 0;
  private dir = 1;
  /** def.scale adjusted for the texture's pixel density. */
  private displayScale = 1;
  private glow: Phaser.GameObjects.Image | null = null;

  // Signature matches what Phaser.GameObjects.Group passes when creating pool members.
  constructor(scene: Phaser.Scene, x = 0, y = 0) {
    super(scene, x, y, TextureKeys.Jellyfish);
  }

  spawn(def: HazardDef, x: number, y: number, random: () => number): this {
    this.def = def;
    this.baseY = y;
    this.age = random() * 10;
    this.dir = random() < 0.5 ? -1 : 1;
    this.displayScale = def.scale * textureScale(this.scene, def.texture);
    this.setTexture(def.texture)
      .setScale(this.displayScale)
      .setRotation(0)
      .clearTint()
      .setAlpha(1)
      .setDepth(9)
      .setActive(true)
      .setVisible(true)
      .setPosition(x, y);
    this.glow ??= this.scene.add
      .image(0, 0, TextureKeys.Glow)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(Depths.Glow);
    this.glow
      .setTint(def.glow.color)
      .setScale(def.glow.size * textureScale(this.scene, TextureKeys.Glow))
      .setAlpha(0.7)
      .setVisible(true);
    return this;
  }

  get radius(): number {
    return this.def.radius;
  }

  step(dt: number): void {
    const d = this.def;
    this.age += dt;
    const phase = this.age * TAU * d.bobFreq;
    this.x += d.driftSpeed * this.dir * dt;
    this.y = this.baseY + Math.sin(phase) * d.bobAmp;
    const blinkOn = Math.floor(this.age * 2) % 2 === 0;

    if (d.explodes) {
      // Mines sway on their chain and blink their light.
      this.setRotation(Math.sin(phase) * 0.12);
      if (!blinkOn) this.clearTint();
      else if (saves.data.settings.highContrast) {
        this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      } else this.setTint(0xffc0b0).setTintMode(Phaser.TintModes.MULTIPLY);
    } else if (d.still) {
      // Urchins: no pulse.
    } else if (this.texture.frameTotal > 2) {
      // Animated sheet: the pulse is in the frames.
      loopFrames(this, this.age);
    } else {
      // Jellyfish pulse: squash on the upstroke.
      const pulse = Math.sin(phase * 2);
      const s = this.displayScale;
      this.setScale(s * (1 + pulse * 0.06), s * (1 - pulse * 0.08));
    }
    this.glow
      ?.setPosition(this.x, this.y - (d.explodes ? 8 : 6))
      .setAlpha(d.glow.blink ? (blinkOn ? 0.9 : 0.25) : 0.55 + 0.15 * Math.sin(phase * 2));
  }

  /** Reverses the drift (bumped into rock). */
  bounce(): void {
    this.dir = -this.dir;
    this.x += this.def.driftSpeed * this.dir * 0.1;
  }

  despawn(): void {
    this.glow?.setVisible(false);
    this.setActive(false).setVisible(false);
  }
}
