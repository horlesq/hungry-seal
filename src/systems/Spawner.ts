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
import { currentMap } from '../world/GameMap';
import type { TerrainField } from '../world/terrain';
import { getViewport } from '../services/Viewport';
import { Creature, School } from '../entities/Creature';
import { stepCreatureMotion, type CreatureSteerContext } from '../entities/creatureAI';
import { canEat, extraReach } from './feeding';
import { despawnRange, pickForZone, pickOffscreenPoint, pickSpawn, viewScale } from './spawnPoint';

const POOL_SIZE = 150;
export const WATER_TOP = WORLD.surfaceY + 16;
export const WATER_BOTTOM = WORLD.floorY - 16;
/** Birds only spawn while the view is within this distance of the water line. */
const SKY_SPAWN_RANGE = 500;
/** Spawn points keep this much open water around them. */
const SPAWN_CLEARANCE = 70;
/** ...and stay this far from the map's left/right edges. */
const EDGE_MARGIN = 160;

/** Spawn weight of a creature at (x, y): its base weight x the map's and the region's mix. */
function weightAt(x: number, y: number) {
  const map = currentMap();
  return (d: CreatureDef) => d.weight * map.creatureMult(d.id, x, y);
}

/** Open water (or sky) with room for a group, inside the map. */
export function openSpot(terrain: TerrainField, x: number, y: number, clearance = SPAWN_CLEARANCE) {
  return x > EDGE_MARGIN && x < terrain.width - EDGE_MARGIN && terrain.distance(x, y) > clearance;
}

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
  private readonly terrain: TerrainField;
  private readonly swimmers: CreatureDef[];
  private readonly flyers: CreatureDef[];
  private readonly starters: CreatureDef[];
  private readonly accept: (x: number, y: number) => boolean;

  constructor(
    scene: Phaser.Scene,
    private readonly random: () => number = Math.random,
  ) {
    this.group = scene.add.group({ classType: Creature, maxSize: POOL_SIZE });
    this.terrain = currentMap().terrain;
    this.swimmers = [...SWIMMERS];
    this.flyers = [...FLYERS];
    this.starters = this.swimmers.filter((d) => d.tier === 1);
    this.accept = (x, y) => openSpot(this.terrain, x, y);
    this.ctx = {
      threatX: 0,
      threatY: 0,
      threatActive: false,
      threatReach: 0,
      bandTop: 0,
      bandBottom: 0,
      hardTop: WATER_TOP,
      hardBottom: WATER_BOTTOM,
      leader: null,
      slotX: 0,
      slotY: 0,
      random,
      terrain: this.terrain,
    };
  }

  /**
   * Fills the area around (cx, cy) at the start of a run. Takes a point rather than the
   * camera because camera.worldView isn't updated until the first render.
   */
  populate(cx: number, cy: number, seal: Threat): void {
    const view = getViewport();
    // The world view, which is bigger than the UI view on phones.
    const worldW = view.width / view.worldZoom;
    const worldH = view.height / view.worldZoom;
    let placed = 0;
    for (let attempt = 0; attempt < SPAWN.initialGroups * 5; attempt++) {
      if (placed >= SPAWN.initialGroups) break;
      const x = cx + (this.random() - 0.5) * worldW * 1.5;
      const y = Phaser.Math.Clamp(
        cy + (this.random() - 0.5) * worldH,
        WATER_TOP + 30,
        WATER_BOTTOM - 30,
      );
      if (Math.hypot(x - seal.x, y - seal.y) < SPAWN.initialMinDistance) continue;
      if (!this.accept(x, y)) continue;
      // Friendly opening: only prey a brand-new seal can eat. Bigger creatures swim in later.
      const def = pickForZone(this.starters, y, this.random, weightAt(x, y));
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
    ctx.threatReach = extraReach(seal.stage);
    let swimmers = 0;
    let flyers = 0;
    let food = 0;
    const k = viewScale(camera.worldView);
    const range = despawnRange(camera.worldView);
    const foodRadius = SPAWN.foodRadius * k;

    for (const c of this.alive) {
      const leader = c.school?.leader;
      ctx.leader = leader && leader !== c ? leader.motion : null;
      ctx.slotX = c.slotX;
      ctx.slotY = c.slotY;
      ctx.bandTop = c.band.top;
      ctx.bandBottom = c.band.bottom;
      ctx.hardTop = c.hard.top;
      ctx.hardBottom = c.hard.bottom;
      ctx.radius = c.def.radius;
      ctx.threatActive = canEat(seal.stage, c.def.tier);
      stepCreatureMotion(c.motion, c.params, ctx, dt);
      c.syncVisual(dt);

      if (Math.hypot(c.x - cx, c.y - cy) > range) c.despawn();
      else if (c.flies) flyers++;
      else {
        swimmers++;
        if (ctx.threatActive && Math.hypot(c.x - cx, c.y - cy) < foodRadius) food++;
      }
    }

    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = SPAWN.interval;
      const short = food < SPAWN.minFood * k;
      const maxAlive = Math.min(POOL_SIZE - SPAWN.maxFlyers, SPAWN.maxAlive * k);
      if (swimmers < SPAWN.targetAlive * k || (short && swimmers < maxAlive)) {
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
        accept: this.accept,
      });
      if (!p) return;
      const def = pickSpawn(
        this.swimmers,
        p.y,
        this.random,
        foodOnly ? seal.stage : null,
        weightAt(p.x, p.y),
      );
      if (!def) continue;
      // Swim into the view so the player gets to see it.
      const heading = p.x < camera.midPoint.x ? 0 : Math.PI;
      this.spawnGroup(def, p.x, p.y, heading + (this.random() - 0.5) * 0.4);
      return;
    }
  }

  private spawnInSky(camera: Phaser.Cameras.Scene2D.Camera, seal: Threat): void {
    const mid = camera.midPoint;
    const flyers = this.flyers.filter((d) => weightAt(mid.x, mid.y)(d) > 0);
    const def = flyers[Math.floor(this.random() * flyers.length)];
    if (!def?.band) return;
    const p = pickOffscreenPoint(camera, seal, this.random, {
      marginMin: SPAWN.marginMin,
      marginMax: SPAWN.marginMax,
      aheadBias: SPAWN.aheadBias,
      top: def.band.top,
      bottom: def.band.bottom,
      accept: this.accept,
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
      const slotX = i === 0 || !s ? 0 : (this.random() - 0.5) * s.spread * 2.8;
      const slotY = i === 0 || !s ? 0 : (this.random() - 0.5) * s.spread * 1.4;
      const px = x + slotX;
      let py = Phaser.Math.Clamp(y + slotY, top, bottom);
      if (def.behaviors.includes('walk')) {
        // Walkers start on the ground below the spot.
        const ground = this.terrain.groundBelow(px, py, 2500);
        if (ground === null) continue;
        py = ground - def.radius * 0.8;
      } else if (this.terrain.distance(px, py) < def.radius + 8) {
        continue; // this school member would be inside rock
      }
      const creature = this.group.get() as Creature | null;
      if (!creature) return; // pool exhausted
      creature.spawn(def, px, py, heading);
      if (school) creature.joinSchool(school, slotX, slotY);
    }
  }
}
