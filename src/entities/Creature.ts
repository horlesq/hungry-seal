// Pooled prey sprite. Behavior lives in creatureAI (pure); this class owns the sprite,
// its definition, school membership and visuals. Reused via the Spawner's Group.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import type { CreatureDef } from '../config/creatures';
import { zoneBand } from '../config/zones';
import { textureScale } from '../services/Viewport';
import {
  createCreatureMotion,
  motionParamsFor,
  type CreatureMotion,
  type CreatureMotionParams,
} from './creatureAI';

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
  school: School | null = null;
  slotX = 0;
  slotY = 0;
  /** Seconds until this creature can bump the seal again. */
  bumpCooldown = 0;
  private facing = 1;
  /** def.scale adjusted for the texture's pixel density. */
  private displayScale = 1;

  // Signature matches what Phaser.GameObjects.Group passes when creating pool members.
  constructor(scene: Phaser.Scene, x = 0, y = 0) {
    super(scene, x, y, TextureKeys.Minnow);
  }

  spawn(def: CreatureDef, x: number, y: number, heading: number): this {
    this.def = def;
    this.params = motionParamsFor(def);
    this.motion = createCreatureMotion(x, y, heading);
    this.motion.speed = def.speed;
    this.band = zoneBand(def.zones);
    this.school = null;
    this.slotX = 0;
    this.slotY = 0;
    this.bumpCooldown = 0;
    this.facing = Math.cos(heading) >= 0 ? 1 : -1;
    this.displayScale = def.scale * textureScale(this.scene, def.texture);
    this.setTexture(def.texture)
      .setActive(true)
      .setVisible(true)
      .setAlpha(1)
      .setDepth(8)
      .setPosition(x, y);
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
    this.setActive(false).setVisible(false);
  }

  get radius(): number {
    return this.def.radius;
  }

  syncVisual(dt: number): void {
    const m = this.motion;
    this.setPosition(m.x, m.y);
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    // Flip belly-down when swimming left (with a quick squash through zero).
    const cos = Math.cos(m.heading);
    const target = cos > 0.1 ? 1 : cos < -0.1 ? -1 : this.facing >= 0 ? 1 : -1;
    this.facing += (target - this.facing) * Math.min(1, dt * 14);
    this.setRotation(m.heading);
    this.setScale(this.displayScale, this.displayScale * this.facing);
  }
}
