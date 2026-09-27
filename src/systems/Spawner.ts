// Camera-relative, pooled creature spawning. Keeps roughly SPAWN.targetAlive swimmers
// around the view: spawns just off-screen (biased ahead of the seal) using the zone at the
// spawn point, and recycles anything that falls far behind. Prey the seal eats disappear
// while bigger creatures linger, so when fewer than SPAWN.minFood edible swimmers are
// near the view it spawns only food (up to SPAWN.maxAlive) to keep a steady supply. Seabirds are spawned separately
// in the sky whenever the view is near the surface. The world is never pre-built.
import Phaser from 'phaser';
import { SPAWN } from '../config/balance';
import {
  CREATURES,
  FLYERS,
  hardLimits,
  SWIMMERS,
  type CreatureDef,
  type CreatureId,
} from '../config/creatures';
import { WORLD } from '../config/zones';
import { getViewport } from '../services/Viewport';
import { Creature, School } from '../entities/Creature';
import { stepCreatureMotion, type CreatureSteerContext } from '../entities/creatureAI';
import { canEat } from './feeding';
import { pickForZone, pickOffscreenPoint, pickSpawn } from './spawnPoint';

const POOL_SIZE = 120;
export const WATER_TOP = WORLD.surfaceY + 16;
export const WATER_BOTTOM = WORLD.floorY - 16;
/** Birds only spawn while the view is within this distance of the water line. */
const SKY_SPAWN_RANGE = 500;
const STARTERS = SWIMMERS.filter((d) => d.tier === 1);

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
  private skyTimer = 0;
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
    const view = getViewport();
    let placed = 0;
    for (let attempt = 0; attempt < SPAWN.initialGroups * 5; attempt++) {
      if (placed >= SPAWN.initialGroups) break;
      const x = cx + (this.random() - 0.5) * view.viewWidth * 1.5;
      const y = Phaser.Math.Clamp(
        cy + (this.random() - 0.5) * view.viewHeight,
        WATER_TOP + 30,
        WATER_BOTTOM - 30,
      );
      if (Math.hypot(x - seal.x, y - seal.y) < SPAWN.initialMinDistance) continue;
      // Friendly opening: only prey a brand-new seal can eat. Bigger creatures swim in later.
      const def = pickForZone(STARTERS, y, this.random);
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
    let swimmers = 0;
    let flyers = 0;
    let food = 0;

    for (const c of this.alive) {
      const leader = c.school?.leader;
      ctx.leader = leader && leader !== c ? leader.motion : null;
      ctx.slotX = c.slotX;
      ctx.slotY = c.slotY;
      ctx.bandTop = c.band.top;
      ctx.bandBottom = c.band.bottom;
      ctx.hardTop = c.hard.top;
      ctx.hardBottom = c.hard.bottom;
      ctx.threatActive = canEat(seal.stage, c.def.tier);
      stepCreatureMotion(c.motion, c.params, ctx, dt);
      c.syncVisual(dt);

      if (Math.hypot(c.x - cx, c.y - cy) > SPAWN.despawnDistance) c.despawn();
      else if (c.flies) flyers++;
      else {
        swimmers++;
        if (ctx.threatActive && Math.hypot(c.x - cx, c.y - cy) < SPAWN.foodRadius) food++;
      }
    }

    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = SPAWN.interval;
      const short = food < SPAWN.minFood;
      if (swimmers < SPAWN.targetAlive || (short && swimmers < SPAWN.maxAlive)) {
        this.spawnOffscreen(camera, seal, short);
      }
    }

    // Seabirds: only worth spawning when the sky is (nearly) in view.
    this.skyTimer -= dt;
    if (this.skyTimer <= 0) {
      this.skyTimer = SPAWN.skyInterval;
      const nearSurface = camera.worldView.y < WORLD.surfaceY + SKY_SPAWN_RANGE;
      if (nearSurface && flyers < SPAWN.maxFlyers) this.spawnInSky(camera, seal);
    }
  }

  countActive(): number {
    return this.group.countActive(true);
  }

  /** Places one creature at an exact spot (scripted events, playtests). */
  spawnAt(id: CreatureId, x: number, y: number, heading = 0): Creature | null {
    const creature = this.group.get() as Creature | null;
    return creature?.spawn(CREATURES[id], x, y, heading) ?? null;
  }

  private refreshAlive(): void {
    this.alive.length = 0;
    for (const child of this.group.getChildren()) {
      if (child.active) this.alive.push(child as Creature);
    }
  }

  private spawnOffscreen(
    camera: Phaser.Cameras.Scene2D.Camera,
    seal: Threat,
    foodOnly: boolean,
  ): void {
    for (let attempt = 0; attempt < 3; attempt++) {
      const p = pickOffscreenPoint(camera, seal, this.random, {
        marginMin: SPAWN.marginMin,
        marginMax: SPAWN.marginMax,
        aheadBias: SPAWN.aheadBias,
        top: WATER_TOP + 30,
        bottom: WATER_BOTTOM - 30,
      });
      if (!p) return;
      const def = pickSpawn(SWIMMERS, p.y, this.random, foodOnly ? seal.stage : null);
      if (!def) continue;
      // Swim into the view so the player gets to see it.
      const heading = p.x < camera.midPoint.x ? 0 : Math.PI;
      this.spawnGroup(def, p.x, p.y, heading + (this.random() - 0.5) * 0.4);
      return;
    }
  }

  private spawnInSky(camera: Phaser.Cameras.Scene2D.Camera, seal: Threat): void {
    const def = FLYERS[Math.floor(this.random() * FLYERS.length)];
    if (!def?.band) return;
    const p = pickOffscreenPoint(camera, seal, this.random, {
      marginMin: SPAWN.marginMin,
      marginMax: SPAWN.marginMax,
      aheadBias: SPAWN.aheadBias,
      top: def.band.top,
      bottom: def.band.bottom,
    });
    if (!p) return;
    this.spawnGroup(def, p.x, p.y, p.x < camera.midPoint.x ? 0 : Math.PI);
  }

  private spawnGroup(def: CreatureDef, x: number, y: number, heading: number): void {
    const s = def.school;
    const count = s ? s.min + Math.floor(this.random() * (s.max - s.min + 1)) : 1;
    const school = s && count > 1 ? new School() : null;
    // Start inside the creature's own band/medium (e.g. penguins near the surface).
    const hard = hardLimits(def);
    const top = Math.max(hard.top, def.band?.top ?? hard.top);
    const bottom = Math.min(hard.bottom, def.band?.bottom ?? hard.bottom);

    for (let i = 0; i < count; i++) {
      const creature = this.group.get() as Creature | null;
      if (!creature) return; // pool exhausted
      const slotX = i === 0 || !s ? 0 : (this.random() - 0.5) * s.spread * 2.8;
      const slotY = i === 0 || !s ? 0 : (this.random() - 0.5) * s.spread * 1.4;
      creature.spawn(def, x + slotX, Phaser.Math.Clamp(y + slotY, top, bottom), heading);
      if (school) creature.joinSchool(school, slotX, slotY);
    }
  }
}
