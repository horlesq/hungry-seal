// Pooled hazard sprite (jellyfish, sea mine). Drifts slowly and bobs; hurts on contact.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import type { HazardDef } from '../config/hazards';
import { textureScale } from '../services/Viewport';
import { TAU } from '../utils/math';

export class Hazard extends Phaser.GameObjects.Sprite {
  def!: HazardDef;
  private baseY = 0;
  private age = 0;
  private dir = 1;
  /** def.scale adjusted for the texture's pixel density. */
  private displayScale = 1;

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

    if (d.explodes) {
      // Mines sway on their chain and blink their light.
      this.setRotation(Math.sin(phase) * 0.12);
      if (Math.floor(this.age * 2) % 2 === 0) this.setTint(0xffc0b0);
      else this.clearTint();
    } else {
      // Jellyfish pulse: squash on the upstroke.
      const pulse = Math.sin(phase * 2);
      const s = this.displayScale;
      this.setScale(s * (1 + pulse * 0.06), s * (1 - pulse * 0.08));
    }
  }

  despawn(): void {
    this.setActive(false).setVisible(false);
  }
}
