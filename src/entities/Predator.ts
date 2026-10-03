// Pooled predator sprite (shark, orca, anglerfish). Behavior lives in predatorAI (pure);
// this class owns the sprite, the "!" warning shown while it's about to charge, an optional
// glowing spot (the anglerfish lure, drawn above the deep-water darkness) and state visuals.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { Depths } from '../config/depths';
import { UI_FONT } from '../config/layout';
import type { PredatorDef } from '../config/predators';
import { zoneBand } from '../config/zones';
import { textureScale, uiTextResolution } from '../services/Viewport';
import { createPredatorMotion, type PredatorMotion } from './predatorAI';
import { loopFrames } from './sheetAnim';

export class Predator extends Phaser.GameObjects.Sprite {
  def!: PredatorDef;
  motion!: PredatorMotion;
  band = { top: 0, bottom: 0 };
  private readonly alert: Phaser.GameObjects.Text;
  private glow: Phaser.GameObjects.Image | null = null;
  private facing = 1;
  /** Seconds into the swim animation loop. */
  private animTime = 0;

  // Signature matches what Phaser.GameObjects.Group passes when creating pool members.
  constructor(scene: Phaser.Scene, x = 0, y = 0) {
    super(scene, x, y, TextureKeys.Shark);
    this.alert = scene.add
      .text(0, 0, '!', {
        fontFamily: UI_FONT,
        fontSize: '54px',
        fontStyle: 'bold',
        color: '#ff4d3d',
        stroke: '#ffffff',
        strokeThickness: 8,
        resolution: uiTextResolution(),
      })
      .setOrigin(0.5, 1)
      .setDepth(31)
      .setVisible(false);
  }

  spawn(def: PredatorDef, x: number, y: number, heading: number): this {
    this.def = def;
    this.motion = createPredatorMotion(x, y, heading);
    this.motion.speed = def.patrolSpeed;
    this.band = zoneBand(def.zones);
    this.facing = Math.cos(heading) >= 0 ? 1 : -1;
    this.animTime = Math.random() * 10;
    this.setTexture(def.texture)
      .clearTint()
      .setAlpha(1)
      .setDepth(11)
      .setActive(true)
      .setVisible(true);
    if (def.glow) {
      this.glow ??= this.scene.add
        .image(0, 0, TextureKeys.Glow)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(Depths.Glow);
      this.glow
        .setTint(def.glow.color)
        .setScale(def.glow.size * textureScale(this.scene, TextureKeys.Glow))
        .setVisible(true);
    } else {
      this.glow?.setVisible(false);
    }
    this.syncVisual(0, 0);
    return this;
  }

  get radius(): number {
    return this.def.radius;
  }

  /** Whether it's currently hunting (for warning indicators). */
  get isHunting(): boolean {
    return this.motion.state === 'notice' || this.motion.state === 'chase';
  }

  mouthPosition(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const m = this.motion;
    return out.set(
      m.x + Math.cos(m.heading) * this.def.mouthOffset,
      m.y + Math.sin(m.heading) * this.def.mouthOffset,
    );
  }

  syncVisual(dt: number, time: number): void {
    const m = this.motion;
    this.setPosition(m.x, m.y);
    const cos = Math.cos(m.heading);
    const target = cos > 0.1 ? 1 : cos < -0.1 ? -1 : this.facing >= 0 ? 1 : -1;
    this.facing += (target - this.facing) * Math.min(1, dt * 8);
    this.setRotation(m.heading);
    this.animTime += dt;
    loopFrames(this, this.animTime);
    const s = this.def.scale * textureScale(this.scene, this.def.texture);
    this.setScale(s, s * this.facing);

    // Telegraph: flash red and show "!" while winding up to charge.
    const warning = m.state === 'notice';
    if (warning && Math.floor(time / 90) % 2 === 0) this.setTint(0xff8080);
    else this.clearTint();
    this.alert
      .setVisible(warning || (m.state === 'chase' && m.stateTime < 0.4))
      .setPosition(m.x, m.y - 50);

    const g = this.def.glow;
    if (g && this.glow) {
      // Offset is authored facing right; mirror vertically when facing left, then rotate.
      const oy = g.y * (this.facing >= 0 ? 1 : -1);
      const sin = Math.sin(m.heading);
      this.glow
        .setPosition(m.x + g.x * cos - oy * sin, m.y + g.x * sin + oy * cos)
        // Pulse; flare while about to strike.
        .setAlpha(warning ? 1 : 0.65 + 0.25 * Math.sin(time * 0.004));
    }
  }

  despawn(): void {
    this.alert.setVisible(false);
    this.glow?.setVisible(false);
    this.setActive(false).setVisible(false);
  }
}
