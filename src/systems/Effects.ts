// Visual effects: surface splashes, the seal's bubble trail and ambient bubbles.
// All emitters are capped (maxParticles) and particles are recycled by Phaser.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { EFFECTS } from '../config/balance';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/layout';
import { WORLD } from '../config/zones';
import { clamp } from '../utils/math';

const SPLASH_RINGS = 4;

export class Effects {
  private readonly bubbles: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly droplets: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly rings: Phaser.GameObjects.Image[] = [];
  private nextRing = 0;
  private trailTimer = 0;
  private ambientTimer = 0;

  constructor(private readonly scene: Phaser.Scene) {
    // Bubbles die when they reach the air.
    const inAir = { contains: (_x: number, y: number) => y < WORLD.surfaceY + 4 };

    this.bubbles = scene.add.particles(0, 0, TextureKeys.Bubble, {
      emitting: false,
      lifespan: { min: 1400, max: 2600 },
      speedX: { min: -18, max: 18 },
      speedY: { min: -130, max: -70 },
      scale: { start: 0.32, end: 0.6 },
      alpha: { start: 0.85, end: 0 },
      maxParticles: 220,
      deathZone: { type: 'onEnter', source: inAir },
    });
    this.bubbles.setDepth(5);

    const inWater = { contains: (_x: number, y: number) => y > WORLD.surfaceY + 6 };
    this.droplets = scene.add.particles(0, 0, TextureKeys.Droplet, {
      emitting: false,
      lifespan: { min: 500, max: 900 },
      angle: { min: -150, max: -30 },
      speed: { min: 120, max: 420 },
      gravityY: 1100,
      scale: { start: 1.1, end: 0.4 },
      alpha: { start: 1, end: 0.6 },
      maxParticles: 160,
      deathZone: { type: 'onEnter', source: inWater },
    });
    this.droplets.setDepth(15);

    for (let i = 0; i < SPLASH_RINGS; i++) {
      const ring = scene.add.image(0, 0, TextureKeys.Ring).setVisible(false).setDepth(14);
      this.rings.push(ring);
    }
  }

  /** Splash at the water line. `vy` is the crossing vertical speed (sign ignored). */
  splash(x: number, vy: number): void {
    const speed = Math.abs(vy);
    if (speed < EFFECTS.splashMinSpeed) return;
    const intensity = clamp(speed / 900, 0.2, 1);

    this.droplets.emitParticleAt(x, WORLD.surfaceY - 8, Math.round(10 + 26 * intensity));
    this.bubbles.emitParticleAt(x, WORLD.surfaceY + 24, Math.round(4 + 10 * intensity));

    const ring = this.rings[this.nextRing];
    this.nextRing = (this.nextRing + 1) % this.rings.length;
    this.scene.tweens.killTweensOf(ring);
    ring
      .setPosition(x, WORLD.surfaceY)
      .setVisible(true)
      .setAlpha(0.9)
      .setScale(0.4 * intensity + 0.3, 0.5);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 1.4 * intensity + 0.6,
      scaleY: 0.9,
      alpha: 0,
      duration: 650,
      ease: 'Quad.Out',
      onComplete: () => ring.setVisible(false),
    });
  }

  /** Bubble trail behind the seal; `rate` 0..1 scales how often bubbles appear. */
  trail(x: number, y: number, rate: number, dt: number): void {
    if (rate <= 0 || y < WORLD.surfaceY + 10) return;
    this.trailTimer -= dt * rate;
    if (this.trailTimer > 0) return;
    this.trailTimer = EFFECTS.trailInterval;
    this.bubbles.emitParticleAt(x, y, 1);
  }

  /** Ambient bubbles drifting up from below the view. */
  update(dt: number, camera: Phaser.Cameras.Scene2D.Camera): void {
    this.ambientTimer -= dt;
    if (this.ambientTimer > 0) return;
    this.ambientTimer = 1 / EFFECTS.ambientBubblesPerSec;

    const x = camera.scrollX + Phaser.Math.Between(-100, GAME_WIDTH + 100);
    const y = camera.scrollY + Phaser.Math.Between(GAME_HEIGHT * 0.4, GAME_HEIGHT + 60);
    if (y > WORLD.surfaceY + 40 && y < WORLD.floorY) {
      this.bubbles.emitParticleAt(x, y, Phaser.Math.Between(1, 3));
    }
  }

  get particleCount(): number {
    return this.bubbles.getAliveParticleCount() + this.droplets.getAliveParticleCount();
  }
}
