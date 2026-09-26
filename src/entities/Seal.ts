// The player seal. Movement comes from the pure sealMotion model; this class owns the
// sprite, the physics body (used for overlaps only) and the purely visual feel:
// belly-roll when changing direction, swim wiggle, stretch at speed.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { SEAL_MOTION, SEAL_VISUAL } from '../config/balance';
import { WORLD } from '../config/zones';
import { damp } from '../utils/math';
import {
  createSealMotionState,
  stepSealMotion,
  type SealMotionEvent,
  type SealMotionInput,
  type SealMotionState,
} from './sealMotion';

export class Seal extends Phaser.Physics.Arcade.Sprite {
  readonly motion: SealMotionState;
  /** -1 = facing left, 1 = facing right; animated through 0 for the roll effect. */
  private facing = 1;
  private wigglePhase = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TextureKeys.Seal);
    this.motion = createSealMotionState(x, y);

    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    // Kinematic: we integrate position ourselves; the body just follows for overlap checks.
    body.moves = false;
    const r = SEAL_MOTION.radius / SEAL_VISUAL.scale;
    body.setCircle(r, this.width / 2 - r, this.height / 2 - r);

    this.setScale(SEAL_VISUAL.scale);
    this.setDepth(10);
  }

  /** Advances movement and visuals. Returns motion events (breach, splashdown, boost). */
  step(input: SealMotionInput, dt: number): SealMotionEvent[] {
    const events = stepSealMotion(this.motion, input, SEAL_MOTION, WORLD, dt);
    this.setPosition(this.motion.x, this.motion.y);
    this.updateVisuals(dt);
    return events;
  }

  get speedFraction(): number {
    return Math.min(1.5, this.motion.speed / SEAL_MOTION.maxSpeed);
  }

  /** World position of the tail, for bubble trails. */
  tailPosition(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const back = 52 * SEAL_VISUAL.scale;
    return out.set(
      this.x - Math.cos(this.motion.heading) * back,
      this.y - Math.sin(this.motion.heading) * back,
    );
  }

  private updateVisuals(dt: number): void {
    const m = this.motion;
    const cos = Math.cos(m.heading);
    // Hysteresis around vertical so swimming straight up/down doesn't flicker the facing.
    const targetFacing = cos > 0.15 ? 1 : cos < -0.15 ? -1 : Math.sign(this.facing) || 1;
    this.facing = damp(this.facing, targetFacing, SEAL_VISUAL.flipRate, dt);

    const speedFrac = Math.min(1, this.speedFraction);
    this.wigglePhase += dt * Math.PI * 2 * SEAL_VISUAL.wiggleFreq * (0.35 + speedFrac);
    const wiggle = m.inWater ? Math.sin(this.wigglePhase) * SEAL_VISUAL.wiggleAmp * speedFrac : 0;

    // Rotation follows the heading; a negative Y scale keeps the seal belly-down when facing
    // left. Passing the scale through 0 reads as a quick barrel roll.
    this.setRotation(m.heading + wiggle * this.facing);
    const stretch = 1 + SEAL_VISUAL.stretch * speedFrac;
    const base = SEAL_VISUAL.scale;
    this.setScale(base * stretch, base * (2 - stretch) * this.facing);
  }
}
