// The player seal. Movement comes from the pure sealMotion model; this class owns the
// sprite, growth-stage scaling, the mouth hit circle, and the purely visual feel. Animated
// skins (a SEAL_SHEET sprite sheet) play swim, bite and turn frames; single-image skins get a
// belly-roll when changing direction and a swim wiggle. Both stretch at speed and pop on gulps.
import Phaser from 'phaser';
import { SEAL_SHEET, TextureKeys, type TextureKey } from '../config/assets';
import { FEEDING, GROWTH, SEAL_MOTION, SEAL_VISUAL } from '../config/balance';
import { WORLD } from '../config/zones';
import { textureScale } from '../services/Viewport';
import { currentMap } from '../world/GameMap';
import type { RunModifiers } from '../systems/UpgradeSystem';
import { damp } from '../utils/math';
import {
  applyKnockback,
  createSealMotionState,
  stepSealMotion,
  type SealMotionEnv,
  type SealMotionEvent,
  type SealMotionInput,
  type SealMotionParams,
  type SealMotionState,
} from './sealMotion';

const STAGE1_SCALE = GROWTH.stages[0].scale;

export class Seal extends Phaser.GameObjects.Sprite {
  readonly motion: SealMotionState;
  stage = 1;
  dead = false;
  private params: SealMotionParams = SEAL_MOTION;
  private baseScale: number = STAGE1_SCALE;
  /** 1 / pixel density of the seal texture (display size stays in design units). */
  private readonly texScale: number;
  /** -1 = facing left, 1 = facing right; animated through 0 for the roll effect. */
  private facing = 1;
  private wigglePhase = 0;
  /** The texture is a SEAL_SHEET (swim/bite/turn frames) rather than a single image. */
  private readonly animated: boolean;
  /** Swim cycle position (radians) and seconds of bite animation left (animated skins). */
  private swimPhase = 0;
  private biteLeft = 0;
  /** Extra scale that decays back to 0 (gulps, growing). */
  private pop = 0;
  /** Seconds of post-hit invulnerability left (seal flashes). */
  private invuln = 0;
  /** Seconds of stun left (no steering). */
  private stun = 0;
  /** Seconds of white hit flash left. */
  private flash = 0;

  /** Shop upgrades (speed, boost) for this run. */
  private readonly mods: RunModifiers;
  /** Temporary speed multiplier (frenzy). */
  private speedBonus = 1;
  private frenzy = false;
  private frenzyHue = 0;
  /** World limits and the map's rock. */
  private readonly env: SealMotionEnv = { ...WORLD, terrain: currentMap().terrain };

  /** `texture`: the equipped skin (cosmetic only). */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    mods: RunModifiers,
    texture: TextureKey = TextureKeys.Seal,
  ) {
    super(scene, x, y, texture);
    this.texScale = textureScale(scene, texture);
    // frameTotal counts the whole-texture __BASE frame too.
    this.animated = scene.textures.get(texture).frameTotal - 1 >= SEAL_SHEET.frameCount;
    this.mods = mods;
    this.motion = createSealMotionState(x, y);
    scene.add.existing(this);
    this.setDepth(10);
    this.setStage(1, false);
  }

  /** Frenzy glow on/off (visual only; the rules live in GameScene). */
  setFrenzy(on: boolean): void {
    this.frenzy = on;
  }

  /** Temporary speed multiplier on top of stage and upgrades (1 = none). */
  setSpeedBonus(mult: number): void {
    if (mult === this.speedBonus) return;
    this.speedBonus = mult;
    this.updateParams();
  }

  /** Advances movement and visuals. Returns motion events (breach, splashdown, boost). */
  step(input: SealMotionInput, dt: number): SealMotionEvent[] {
    this.invuln = Math.max(0, this.invuln - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.flash = Math.max(0, this.flash - dt);
    const events = stepSealMotion(this.motion, input, this.params, this.env, dt);
    this.setPosition(this.motion.x, this.motion.y);
    this.updateVisuals(dt);
    return events;
  }

  /** Applies a growth stage: size, speed and mouth all scale with it. */
  setStage(stage: number, animate = true): void {
    const index = Phaser.Math.Clamp(stage, 1, GROWTH.stages.length) - 1;
    const cfg = GROWTH.stages[index];
    this.stage = index + 1;
    this.baseScale = cfg.scale;
    this.updateParams();
    if (animate) this.pop = 0.35;
  }

  /** Motion params = base tuning x growth stage x upgrades x temporary bonus. */
  private updateParams(): void {
    const cfg = GROWTH.stages[this.stage - 1];
    const b = SEAL_MOTION.boost;
    this.params = {
      ...SEAL_MOTION,
      maxSpeed: SEAL_MOTION.maxSpeed * cfg.speedMult * this.mods.speedMult * this.speedBonus,
      radius: SEAL_MOTION.radius * (cfg.scale / STAGE1_SCALE),
      boost: {
        ...b,
        drainPerSec: b.drainPerSec * this.mods.boostDrainMult,
        regenPerSec: b.regenPerSec * this.mods.boostRegenMult,
      },
    };
  }

  get maxSpeed(): number {
    return this.params.maxSpeed;
  }

  get speedFraction(): number {
    return Math.min(1.5, this.motion.speed / this.params.maxSpeed);
  }

  /** Body radius for being hit and collecting coins. */
  get radius(): number {
    return this.params.radius;
  }

  get isInvulnerable(): boolean {
    return this.invuln > 0 || this.dead;
  }

  get isStunned(): boolean {
    return this.stun > 0;
  }

  /**
   * Took a hit from something at (fromX, fromY): knocked away, briefly stunned, then
   * invulnerable for a moment. Damage to hunger is applied by the caller.
   */
  hurt(fromX: number, fromY: number, knockback: number, stun: number, invuln: number): void {
    const a = Math.atan2(this.motion.y - fromY, this.motion.x - fromX);
    applyKnockback(this.motion, Math.cos(a) * knockback, Math.sin(a) * knockback);
    this.motion.speed *= 0.3;
    this.stun = Math.max(this.stun, stun);
    this.invuln = invuln;
    this.flash = 0.12;
  }

  get mouthRadius(): number {
    return FEEDING.mouthRadius * this.baseScale;
  }

  /** World position of the mouth hit circle (just behind the nose). */
  mouthPosition(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const d = FEEDING.mouthOffset * this.baseScale;
    return out.set(
      this.motion.x + Math.cos(this.motion.heading) * d,
      this.motion.y + Math.sin(this.motion.heading) * d,
    );
  }

  /** World position of the tail, for bubble trails. */
  tailPosition(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const back = 52 * this.baseScale;
    return out.set(
      this.x - Math.cos(this.motion.heading) * back,
      this.y - Math.sin(this.motion.heading) * back,
    );
  }

  /** Quick gulp squash when eating. */
  chomp(): void {
    this.pop = Math.max(this.pop, 0.16);
    this.biteLeft = SEAL_VISUAL.biteTime;
  }

  /** Bumped into something too big to eat: lose most of the speed. */
  bump(): void {
    this.motion.speed *= FEEDING.bumpSpeedKeep;
  }

  /** Starved: float belly-up and fade. Movement stops being simulated. */
  die(): void {
    if (this.dead) return;
    this.dead = true;
    this.motion.speed = 0;
    this.motion.boosting = false;
    this.clearTint().setAlpha(1);
    this.scene.tweens.add({
      targets: this,
      rotation: this.rotation + Math.PI * this.facing,
      y: this.y - 70,
      alpha: 0,
      duration: 1500,
      ease: 'Sine.InOut',
    });
  }

  private updateVisuals(dt: number): void {
    const m = this.motion;
    const cos = Math.cos(m.heading);
    // Hysteresis around vertical so swimming straight up/down doesn't flicker the facing.
    const targetFacing = cos > 0.15 ? 1 : cos < -0.15 ? -1 : Math.sign(this.facing) || 1;
    this.facing = damp(this.facing, targetFacing, SEAL_VISUAL.flipRate, dt);
    this.pop = damp(this.pop, 0, 9, dt);

    const speedFrac = Math.min(1, this.speedFraction);
    const stretch = 1 + SEAL_VISUAL.stretch * speedFrac;
    const base = this.baseScale * this.texScale * (1 + this.pop);
    if (this.animated) this.updateFrames(dt, speedFrac, stretch, base);
    else {
      this.wigglePhase += dt * Math.PI * 2 * SEAL_VISUAL.wiggleFreq * (0.35 + speedFrac);
      const wiggle = m.inWater
        ? Math.sin(this.wigglePhase) * SEAL_VISUAL.wiggleAmp * speedFrac
        : 0;
      // Rotation follows the heading; a negative Y scale keeps the seal belly-down when facing
      // left. Passing the scale through 0 reads as a quick barrel roll.
      this.setRotation(m.heading + wiggle * this.facing);
      this.setScale(base * stretch, base * (2 - stretch) * this.facing);
    }

    // Hit feedback: white flash, electric tint while stunned, blinking while invulnerable.
    if (this.flash > 0) this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else if (this.stun > 0) {
      this.setTint(Math.floor(this.stun * 20) % 2 ? 0x9ff6ff : 0xffffff);
      this.setTintMode(Phaser.TintModes.MULTIPLY);
    } else if (this.frenzy) {
      // Pulsing golden glow while in a frenzy (hue kept in the orange-yellow range).
      this.frenzyHue += dt * 7;
      const color = Phaser.Display.Color.HSVToRGB(
        0.1 + 0.05 * Math.sin(this.frenzyHue),
        0.35 + 0.15 * Math.sin(this.frenzyHue * 0.5),
        1,
      ) as Phaser.Types.Display.ColorObject;
      this.setTint(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
      this.setTintMode(Phaser.TintModes.MULTIPLY);
    } else this.clearTint();
    this.setAlpha(this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0 ? 0.35 : 1);
  }

  /**
   * Sprite-sheet seal: the turn plays the rendered yaw frames (mirrored past half way), the
   * body tilts with the climb/dive angle, and the swim cycle speeds up with speed.
   */
  private updateFrames(dt: number, speedFrac: number, stretch: number, base: number): void {
    const m = this.motion;
    if (m.inWater) {
      this.swimPhase += dt * Math.PI * 2 * SEAL_VISUAL.swimCycleHz * (0.35 + speedFrac);
      this.swimPhase %= Math.PI * 2;
    }
    this.biteLeft = Math.max(0, this.biteLeft - dt);

    // Turn progress 0 (facing right) -> 1 (facing left). A yaw of 180 - a looks like the
    // yaw-a frame mirrored, so the second half reuses the frames flipped.
    const turn = (1 - this.facing) / 2;
    const flipped = turn > 0.5;
    const step = Math.round(Math.min(turn, 1 - turn) * 8); // 22.5 degree steps, 0..4
    let frame: number;
    if (step > 0) frame = SEAL_SHEET.turn[Math.min(step, SEAL_SHEET.turn.length) - 1];
    else if (this.stun > 0 || this.flash > 0) frame = SEAL_SHEET.hurt;
    else if (this.biteLeft > 0) {
      const open = Math.sin(Math.PI * (1 - this.biteLeft / SEAL_VISUAL.biteTime));
      const n = SEAL_SHEET.bite.length;
      frame = SEAL_SHEET.bite[Math.min(n - 1, Math.floor(open * n))];
    } else {
      const n = SEAL_SHEET.swim.length;
      frame = SEAL_SHEET.swim[Math.floor((this.swimPhase / (Math.PI * 2)) * n) % n];
    }
    if (this.frame.name !== String(frame)) this.setFrame(frame);

    // Tilt by the climb/dive angle only; the facing comes from the frames and the flip.
    const pitch = Math.atan2(Math.sin(m.heading), Math.abs(Math.cos(m.heading)));
    this.setFlipX(flipped);
    this.setRotation(flipped ? -pitch : pitch);
    this.setScale(base * stretch, base * (2 - stretch));
  }
}
