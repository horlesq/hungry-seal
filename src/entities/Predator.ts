// Pooled predator sprite (shark). Behavior lives in predatorAI (pure); this class owns the
// sprite, the "!" warning shown while it's about to charge, and state-driven visuals.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { UI_FONT } from '../config/layout';
import type { PredatorDef } from '../config/predators';
import { zoneBand } from '../config/zones';
import { createPredatorMotion, type PredatorMotion } from './predatorAI';

export class Predator extends Phaser.GameObjects.Sprite {
  def!: PredatorDef;
  motion!: PredatorMotion;
  band = { top: 0, bottom: 0 };
  private readonly alert: Phaser.GameObjects.Text;
  private facing = 1;

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
    this.setTexture(def.texture)
      .clearTint()
      .setAlpha(1)
      .setDepth(11)
      .setActive(true)
      .setVisible(true);
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
    this.setScale(this.def.scale, this.def.scale * this.facing);

    // Telegraph: flash red and show "!" while winding up to charge.
    const warning = m.state === 'notice';
    if (warning && Math.floor(time / 90) % 2 === 0) this.setTint(0xff8080);
    else this.clearTint();
    this.alert
      .setVisible(warning || (m.state === 'chase' && m.stateTime < 0.4))
      .setPosition(m.x, m.y - 50);
  }

  despawn(): void {
    this.alert.setVisible(false);
    this.setActive(false).setVisible(false);
  }
}
