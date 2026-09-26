// Visual effects: surface splashes, bubble trails, chomp bursts and floating text.
// All emitters are capped (maxParticles) and texts/rings are pooled and reused.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { EFFECTS } from '../config/balance';
import { UI_FONT } from '../config/layout';
import { WORLD } from '../config/zones';
import { textureScale } from '../services/Viewport';
import { clamp } from '../utils/math';

const SPLASH_RINGS = 4;
const FLOAT_TEXTS = 16;

export class Effects {
  private readonly bubbles: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly droplets: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly blast: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly zaps: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly rings: Phaser.GameObjects.Image[] = [];
  private readonly texts: Phaser.GameObjects.Text[] = [];
  private readonly ringScale: number;
  private nextRing = 0;
  private nextText = 0;
  private trailTimer = 0;
  private ambientTimer = 0;

  constructor(private readonly scene: Phaser.Scene) {
    // Particle scales are in design units; divide out each texture's pixel density.
    const tsBubble = textureScale(scene, TextureKeys.Bubble);
    const tsDrop = textureScale(scene, TextureKeys.Droplet);
    const tsSpark = textureScale(scene, TextureKeys.Spark);
    this.ringScale = textureScale(scene, TextureKeys.Ring);

    // Bubbles die when they reach the air.
    const inAir = { contains: (_x: number, y: number) => y < WORLD.surfaceY + 4 };

    this.bubbles = scene.add.particles(0, 0, TextureKeys.Bubble, {
      emitting: false,
      lifespan: { min: 1400, max: 2600 },
      speedX: { min: -18, max: 18 },
      speedY: { min: -130, max: -70 },
      scale: { start: 0.32 * tsBubble, end: 0.6 * tsBubble },
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
      scale: { start: 1.1 * tsDrop, end: 0.4 * tsDrop },
      alpha: { start: 1, end: 0.6 },
      maxParticles: 160,
      deathZone: { type: 'onEnter', source: inWater },
    });
    this.droplets.setDepth(15);

    this.sparks = scene.add.particles(0, 0, TextureKeys.Spark, {
      emitting: false,
      lifespan: { min: 250, max: 480 },
      speed: { min: 90, max: 260 },
      scale: { start: 0.9 * tsSpark, end: 0 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: [0xfff27a, 0xffffff, 0xffc36b],
      maxParticles: 120,
    });
    this.sparks.setDepth(16);

    this.blast = scene.add.particles(0, 0, TextureKeys.Spark, {
      emitting: false,
      lifespan: { min: 450, max: 800 },
      speed: { min: 160, max: 520 },
      scale: { start: 1.6 * tsSpark, end: 0 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: [0xff9a3c, 0xffd23c, 0xff5a2a, 0xffffff],
      maxParticles: 80,
    });
    this.blast.setDepth(17);

    this.zaps = scene.add.particles(0, 0, TextureKeys.Spark, {
      emitting: false,
      lifespan: { min: 200, max: 420 },
      speed: { min: 100, max: 320 },
      scale: { start: 0.9 * tsSpark, end: 0 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: [0x9ff6ff, 0xffffff, 0xd48cff],
      maxParticles: 60,
    });
    this.zaps.setDepth(17);

    for (let i = 0; i < SPLASH_RINGS; i++) {
      const ring = scene.add.image(0, 0, TextureKeys.Ring).setVisible(false).setDepth(14);
      this.rings.push(ring);
    }

    for (let i = 0; i < FLOAT_TEXTS; i++) {
      const text = scene.add
        .text(0, 0, '', {
          fontFamily: UI_FONT,
          fontSize: '26px',
          fontStyle: 'bold',
          color: '#fff27a',
          stroke: '#0b3a66',
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setDepth(30)
        .setVisible(false);
      this.texts.push(text);
    }
  }

  /** Burst of stars and bubbles where something got eaten. */
  chomp(x: number, y: number, big = false): void {
    this.sparks.emitParticleAt(x, y, big ? 12 : 7);
    this.bubbles.emitParticleAt(x, y, big ? 5 : 3);
  }

  /** Sea mine going off. */
  explosion(x: number, y: number): void {
    this.blast.emitParticleAt(x, y, 40);
    this.bubbles.emitParticleAt(x, y, 20);
  }

  /** Jellyfish sting. */
  zap(x: number, y: number): void {
    this.zaps.emitParticleAt(x, y, 16);
  }

  /** Predator bite landing on the seal. */
  bite(x: number, y: number): void {
    this.sparks.emitParticleAt(x, y, 10);
    this.bubbles.emitParticleAt(x, y, 8);
  }

  coinPickup(x: number, y: number): void {
    this.sparks.emitParticleAt(x, y, 4);
  }

  /** Celebration burst when the seal grows a stage. */
  growBurst(x: number, y: number): void {
    this.sparks.emitParticleAt(x, y, 24);
    this.bubbles.emitParticleAt(x, y, 16);
  }

  /** Text that pops up and floats away, e.g. "+10". */
  floatText(x: number, y: number, message: string, color = '#fff27a', size = 26): void {
    const text = this.texts[this.nextText];
    this.nextText = (this.nextText + 1) % this.texts.length;
    this.scene.tweens.killTweensOf(text);
    text
      .setText(message)
      .setColor(color)
      .setFontSize(size)
      .setPosition(x, y)
      .setAlpha(1)
      .setScale(0.6)
      .setVisible(true);
    this.scene.tweens.add({
      targets: text,
      scale: 1,
      duration: 140,
      ease: 'Back.Out',
    });
    this.scene.tweens.add({
      targets: text,
      y: y - 60,
      alpha: 0,
      delay: 250,
      duration: 700,
      ease: 'Quad.In',
      onComplete: () => text.setVisible(false),
    });
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
      .setScale((0.4 * intensity + 0.3) * this.ringScale, 0.5 * this.ringScale);
    this.scene.tweens.add({
      targets: ring,
      scaleX: (1.4 * intensity + 0.6) * this.ringScale,
      scaleY: 0.9 * this.ringScale,
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

    const v = camera.worldView;
    const x = v.x + Phaser.Math.FloatBetween(-100, v.width + 100);
    const y = v.y + Phaser.Math.FloatBetween(v.height * 0.4, v.height + 60);
    if (y > WORLD.surfaceY + 40 && y < WORLD.floorY) {
      this.bubbles.emitParticleAt(x, y, Phaser.Math.Between(1, 3));
    }
  }

  get particleCount(): number {
    return (
      this.bubbles.getAliveParticleCount() +
      this.droplets.getAliveParticleCount() +
      this.sparks.getAliveParticleCount() +
      this.blast.getAliveParticleCount() +
      this.zaps.getAliveParticleCount()
    );
  }
}
