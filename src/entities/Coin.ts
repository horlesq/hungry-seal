// Pooled coin. Floats in place (clusters) or pops out of eaten prey and fades after a while;
// flies to the seal when it's close.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { COINS } from '../config/balance';
import { textureScale } from '../services/Viewport';

export class Coin extends Phaser.GameObjects.Image {
  /** True for coins floating in the world (clusters), false for coins dropped by prey. */
  world = false;
  private vx = 0;
  private vy = 0;
  private baseY = 0;
  private age = 0;
  /** Seconds left before it disappears (Infinity for world coins). */
  private life = Infinity;
  private magnetized = false;

  // Signature matches what Phaser.GameObjects.Group passes when creating pool members.
  constructor(scene: Phaser.Scene, x = 0, y = 0) {
    super(scene, x, y, TextureKeys.Coin);
  }

  /** `pop` = dropped from prey: bursts outward, then drifts, and expires. */
  spawn(x: number, y: number, pop: boolean, random: () => number): this {
    this.age = random() * 6;
    this.baseY = y;
    this.magnetized = false;
    this.world = !pop;
    if (pop) {
      const a = -Math.PI / 2 + (random() - 0.5) * 2;
      const speed = 120 + random() * 120;
      this.vx = Math.cos(a) * speed;
      this.vy = Math.sin(a) * speed;
      this.life = COINS.dropLifetime;
    } else {
      this.vx = 0;
      this.vy = 0;
      this.life = Infinity;
    }
    this.setPosition(x, y).setAlpha(1).setDepth(12).setActive(true).setVisible(true);
    return this;
  }

  /** Returns false when the coin expired this frame. */
  step(
    dt: number,
    sealX: number,
    sealY: number,
    magnetRadius: number = COINS.magnetRadius,
  ): boolean {
    this.age += dt;
    this.life -= dt;
    if (this.life <= 0) {
      this.despawn();
      return false;
    }

    const dx = sealX - this.x;
    const dy = sealY - this.y;
    const dist = Math.hypot(dx, dy);
    if (this.magnetized || dist < magnetRadius) {
      this.magnetized = true;
      const step = Math.min(dist, COINS.magnetSpeed * dt);
      if (dist > 0) {
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
      }
    } else if (this.vx !== 0 || this.vy !== 0) {
      // Popped coin: slows down in the water.
      const drag = Math.exp(-3 * dt);
      this.vx *= drag;
      this.vy *= drag;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.baseY = this.y;
    } else {
      this.y = this.baseY + Math.sin(this.age * 2.2) * 5;
    }

    // Spin (fake 3D) and blink before expiring.
    const ts = textureScale(this.scene, TextureKeys.Coin);
    this.setScale(Math.max(0.15, Math.abs(Math.cos(this.age * 3))) * ts, ts);
    this.setAlpha(this.life < 2.5 && Math.floor(this.life * 8) % 2 === 0 ? 0.3 : 1);
    return true;
  }

  despawn(): void {
    this.setActive(false).setVisible(false);
  }
}
