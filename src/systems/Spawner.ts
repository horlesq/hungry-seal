// Camera-relative, pooled creature spawning. Keeps roughly SPAWN.targetAlive creatures
// around the view: spawns just off-screen (biased ahead of the seal) using the zone at the
// spawn point, and recycles anything that falls far behind. The world is never pre-built.
import Phaser from 'phaser';
import { SPAWN } from '../config/balance';
import { CREATURE_LIST, type CreatureDef } from '../config/creatures';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/layout';
import { WORLD, zoneAt } from '../config/zones';
import { Creature, School } from '../entities/Creature';
import { stepCreatureMotion, type CreatureSteerContext } from '../entities/creatureAI';
import { canEat } from './feeding';

const POOL_SIZE = 120;
const WATER_TOP = WORLD.surfaceY + 16;
const WATER_BOTTOM = WORLD.floorY - 16;

export interface Threat {
  x: number;
  y: number;
  vx: number;
  vy: number;
  stage: number;
}

export class Spawner {
  readonly group: Phaser.GameObjects.Group;
  /** Active creatures, refreshed every update. */
  readonly alive: Creature[] = [];
  private timer = 0;
  private readonly ctx: CreatureSteerContext;

  constructor(
    scene: Phaser.Scene,
    private readonly random: () => number = Math.random,
  ) {
    this.group = scene.add.group({ classType: Creature, maxSize: POOL_SIZE });
    this.ctx = {
      threatX: 0,
      threatY: 0,
      threatActive: false,
      bandTop: 0,
      bandBottom: 0,
      hardTop: WATER_TOP,
      hardBottom: WATER_BOTTOM,
      leader: null,
      slotX: 0,
      slotY: 0,
      random,
    };
  }

  /**
   * Fills the area around (cx, cy) at the start of a run. Takes a point rather than the
   * camera because camera.worldView isn't updated until the first render.
   */
  populate(cx: number, cy: number, seal: Threat): void {
    let placed = 0;
    for (let attempt = 0; attempt < SPAWN.initialGroups * 5; attempt++) {
      if (placed >= SPAWN.initialGroups) break;
      const x = cx + (this.random() - 0.5) * GAME_WIDTH * 1.5;
      const y = Phaser.Math.Clamp(
        cy + (this.random() - 0.5) * GAME_HEIGHT,
        WATER_TOP + 30,
        WATER_BOTTOM - 30,
      );
      if (Math.hypot(x - seal.x, y - seal.y) < SPAWN.initialMinDistance) continue;
      const def = this.pickDef(y);
      if (!def) continue;
      this.spawnGroup(def, x, y, this.random() < 0.5 ? 0 : Math.PI);
      placed++;
    }
    this.refreshAlive();
  }

  update(dt: number, camera: Phaser.Cameras.Scene2D.Camera, seal: Threat): void {
    this.refreshAlive();
    const cx = camera.midPoint.x;
    const cy = camera.midPoint.y;
    const ctx = this.ctx;
    ctx.threatX = seal.x;
    ctx.threatY = seal.y;

    for (const c of this.alive) {
      const leader = c.school?.leader;
      ctx.leader = leader && leader !== c ? leader.motion : null;
      ctx.slotX = c.slotX;
      ctx.slotY = c.slotY;
      ctx.bandTop = c.band.top;
      ctx.bandBottom = c.band.bottom;
      ctx.threatActive = canEat(seal.stage, c.def.tier);
      stepCreatureMotion(c.motion, c.params, ctx, dt);
      c.syncVisual(dt);

      if (Math.hypot(c.x - cx, c.y - cy) > SPAWN.despawnDistance) c.despawn();
    }

    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = SPAWN.interval;
      if (this.countActive() < SPAWN.targetAlive) this.spawnOffscreen(camera, seal);
    }
  }

  countActive(): number {
    return this.group.countActive(true);
  }

  private refreshAlive(): void {
    this.alive.length = 0;
    for (const child of this.group.getChildren()) {
      if (child.active) this.alive.push(child as Creature);
    }
  }

  private spawnOffscreen(camera: Phaser.Cameras.Scene2D.Camera, seal: Threat): void {
    const view = camera.worldView;
    const halfW = GAME_WIDTH / 2;
    const halfH = GAME_HEIGHT / 2;
    const moving = Math.hypot(seal.vx, seal.vy) > 40;

    for (let attempt = 0; attempt < 5; attempt++) {
      const angle =
        moving && this.random() < SPAWN.aheadBias
          ? Math.atan2(seal.vy, seal.vx) + (this.random() - 0.5) * 2.1
          : this.random() * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      // Distance from the view centre to its edge along `angle`, plus a margin.
      const toEdge = Math.min(
        Math.abs(cos) > 1e-3 ? halfW / Math.abs(cos) : Infinity,
        Math.abs(sin) > 1e-3 ? halfH / Math.abs(sin) : Infinity,
      );
      const dist = toEdge + SPAWN.marginMin + this.random() * (SPAWN.marginMax - SPAWN.marginMin);
      const x = camera.midPoint.x + cos * dist;
      const y = Phaser.Math.Clamp(
        camera.midPoint.y + sin * dist,
        WATER_TOP + 30,
        WATER_BOTTOM - 30,
      );

      // Clamping to the water may have pulled the point into view; try another angle.
      if (view.contains(x, y)) continue;
      const def = this.pickDef(y);
      if (!def) continue;
      // Swim into the view so the player gets to see it.
      const heading = x < camera.midPoint.x ? 0 : Math.PI;
      this.spawnGroup(def, x, y, heading + (this.random() - 0.5) * 0.4);
      return;
    }
  }

  /** Weighted random creature allowed in the zone at world-y `y`, or null if none. */
  private pickDef(y: number): CreatureDef | null {
    const zone = zoneAt(y).id;
    const candidates = CREATURE_LIST.filter((d) => d.zones.includes(zone));
    const total = candidates.reduce((sum, d) => sum + d.weight, 0);
    if (total <= 0) return null;
    let roll = this.random() * total;
    for (const d of candidates) {
      roll -= d.weight;
      if (roll <= 0) return d;
    }
    return candidates[candidates.length - 1];
  }

  private spawnGroup(def: CreatureDef, x: number, y: number, heading: number): void {
    const s = def.school;
    const count = s ? s.min + Math.floor(this.random() * (s.max - s.min + 1)) : 1;
    const school = s && count > 1 ? new School() : null;

    for (let i = 0; i < count; i++) {
      const creature = this.group.get() as Creature | null;
      if (!creature) return; // pool exhausted
      const slotX = i === 0 || !s ? 0 : (this.random() - 0.5) * s.spread * 2.8;
      const slotY = i === 0 || !s ? 0 : (this.random() - 0.5) * s.spread * 1.4;
      creature.spawn(
        def,
        x + slotX,
        Phaser.Math.Clamp(y + slotY, WATER_TOP, WATER_BOTTOM),
        heading,
      );
      if (school) creature.joinSchool(school, slotX, slotY);
    }
  }
}
