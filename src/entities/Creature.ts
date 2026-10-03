// Pooled prey sprite. Behavior lives in creatureAI (pure); this class owns the sprite,
// its definition, school membership and visuals. Reused via the Spawner's Group.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { hardLimits, PUFFED_SCALE, type CreatureDef } from '../config/creatures';
import { zoneBand } from '../config/zones';
import { textureScale } from '../services/Viewport';
import {
  createCreatureMotion,
  motionParamsFor,
  type CreatureMotion,
  type CreatureMotionParams,
} from './creatureAI';
import { Depths } from '../config/depths';
import { loopFrames } from './sheetAnim';

/** A group of creatures that follow the first living member. */
export class School {
  readonly members: Creature[] = [];

  get leader(): Creature | null {
    return this.members[0] ?? null;
  }

  remove(creature: Creature): void {
    const i = this.members.indexOf(creature);
    if (i >= 0) this.members.splice(i, 1);
  }
}

export class Creature extends Phaser.GameObjects.Sprite {
  def!: CreatureDef;
  motion!: CreatureMotion;
  params!: CreatureMotionParams;
  band = { top: 0, bottom: 0 };
  /** Absolute vertical limits (water, or air for flyers). */
  hard = { top: 0, bottom: 0 };
  school: School | null = null;
  slotX = 0;
  slotY = 0;
  /** Seconds until this creature can bump the seal again. */
  bumpCooldown = 0;
  private facing = 1;
  /** Seconds into the swim/flap animation loop. */
  private animTime = 0;
  /** def.scale adjusted for the texture's pixel density. */
  private displayScale = 1;
  /** Soft light for glowing species, drawn above the deep-water darkness. */
  private glow: Phaser.GameObjects.Image | null = null;
  private shownPuffed = false;

  // Signature matches what Phaser.GameObjects.Group passes when creating pool members.
  constructor(scene: Phaser.Scene, x = 0, y = 0) {
    super(scene, x, y, TextureKeys.Minnow);
  }

  spawn(def: CreatureDef, x: number, y: number, heading: number): this {
    this.def = def;
    this.params = motionParamsFor(def);
    this.motion = createCreatureMotion(x, y, heading);
    this.motion.speed = def.speed;
    this.band = def.band ?? zoneBand(def.zones);
    this.hard = hardLimits(def);
    this.school = null;
    this.slotX = 0;
    this.slotY = 0;
    this.bumpCooldown = 0;
    this.facing = Math.cos(heading) >= 0 ? 1 : -1;
    this.displayScale = def.scale * textureScale(this.scene, def.texture);
    this.shownPuffed = false;
    // Random start so schools don't flap in lockstep.
    this.animTime = Math.random() * 10;
    this.setTexture(def.texture)
      .setActive(true)
      .setVisible(true)
      .setAlpha(1)
      .setDepth(8)
      .setPosition(x, y);
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
    this.syncVisual(0);
    return this;
  }

  joinSchool(school: School, slotX: number, slotY: number): void {
    this.school = school;
    this.slotX = slotX;
    this.slotY = slotY;
    school.members.push(this);
  }

  /** Returns the creature to the pool. */
  despawn(): void {
    this.school?.remove(this);
    this.school = null;
    this.glow?.setVisible(false);
    this.setActive(false).setVisible(false);
  }

  get radius(): number {
    return this.def.radius * (this.puffed ? PUFFED_SCALE : 1);
  }

  get flies(): boolean {
    return this.def.behaviors.includes('fly');
  }

  /** Pufferfish currently blown up (eating it now hurts). */
  get puffed(): boolean {
    return this.motion.puffed;
  }

  syncVisual(dt: number): void {
    const m = this.motion;
    this.setPosition(m.x, m.y);
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    this.animTime += dt;
    const cos = Math.cos(m.heading);
    const target = cos > 0.1 ? 1 : cos < -0.1 ? -1 : this.facing >= 0 ? 1 : -1;

    if (this.params.puff && this.shownPuffed !== m.puffed) {
      this.shownPuffed = m.puffed;
      this.setTexture(m.puffed ? TextureKeys.PufferfishPuffed : this.def.texture);
    }
    const s = this.displayScale * (m.puffed ? PUFFED_SCALE : 1);

    if (this.params.walk) {
      // Walkers stay upright and just face their direction.
      this.facing = target;
      this.setRotation(0);
      this.setScale(s * this.facing, s);
    } else {
      // Flip belly-down when swimming left (with a quick squash through zero).
      this.facing += (target - this.facing) * Math.min(1, dt * 14);
      this.setRotation(m.heading);
      this.setScale(s, s * this.facing);
    }
    loopFrames(this, this.animTime);
    this.glow?.setPosition(m.x, m.y);
  }
}
