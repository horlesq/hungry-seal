// Predator spawning (by run-time schedule), AI stepping, and off-screen warning arrows that
// point at predators hunting the seal from outside the view.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { DANGER, SPAWN } from '../config/balance';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/layout';
import { PREDATORS, type PredatorDef, type PredatorId } from '../config/predators';
import { zoneBand } from '../config/zones';
import { Predator } from '../entities/Predator';
import { stepPredator, type PredatorContext, type PredatorEvent } from '../entities/predatorAI';
import { predatorsAllowed } from './danger';
import { canEat } from './feeding';
import { pickOffscreenPoint } from './spawnPoint';
import { WATER_BOTTOM, WATER_TOP, type Threat } from './Spawner';

const POOL_SIZE = 4;
/** Predators are big and slow to re-find; keep them around longer than prey. */
const DESPAWN_DISTANCE = SPAWN.despawnDistance * 1.6;
const ARROW_INSET = 42;

export interface SealInfo extends Threat {
  inWater: boolean;
}

export interface PredatorEventInfo {
  predator: Predator;
  event: PredatorEvent;
}

export class Predators {
  readonly group: Phaser.GameObjects.Group;
  readonly alive: Predator[] = [];
  private readonly arrows: Phaser.GameObjects.Image[] = [];
  private timer = 0;
  private readonly ctx: PredatorContext;
  private readonly events: PredatorEventInfo[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly random: () => number = Math.random,
  ) {
    this.group = scene.add.group({ classType: Predator, maxSize: POOL_SIZE });
    for (let i = 0; i < POOL_SIZE; i++) {
      this.arrows.push(
        scene.add.image(0, 0, TextureKeys.Arrow).setScrollFactor(0).setDepth(40).setVisible(false),
      );
    }
    this.ctx = {
      preyX: 0,
      preyY: 0,
      preyInWater: true,
      canEatPrey: true,
      bandTop: 0,
      bandBottom: 0,
      hardTop: WATER_TOP + 20,
      hardBottom: WATER_BOTTOM - 20,
      random,
    };
  }

  /** Steps all predators; returns AI events (notice/chase/...) that happened this frame. */
  update(
    dt: number,
    time: number,
    camera: Phaser.Cameras.Scene2D.Camera,
    seal: SealInfo,
    elapsed: number,
  ): readonly PredatorEventInfo[] {
    this.events.length = 0;
    this.alive.length = 0;
    const ctx = this.ctx;
    ctx.preyX = seal.x;
    ctx.preyY = seal.y;
    ctx.preyInWater = seal.inWater;
    const cx = camera.midPoint.x;
    const cy = camera.midPoint.y;

    for (const child of this.group.getChildren()) {
      const p = child as Predator;
      if (!p.active) continue;
      ctx.bandTop = p.band.top;
      ctx.bandBottom = p.band.bottom;
      // A dead seal (stage 0) can't be hunted; a big enough seal makes the predator flee.
      ctx.canEatPrey = seal.stage > 0 && !canEat(seal.stage, p.def.tier);
      for (const event of stepPredator(p.motion, p.def, ctx, dt)) {
        this.events.push({ predator: p, event });
      }
      p.syncVisual(dt, time);
      const far = Math.hypot(p.x - cx, p.y - cy) > DESPAWN_DISTANCE;
      if (far && !p.isHunting) p.despawn();
      else this.alive.push(p);
    }

    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = DANGER.predatorSpawnInterval;
      if (this.alive.length < predatorsAllowed(elapsed)) this.spawn(PREDATORS.shark, camera, seal);
    }

    this.updateArrows(camera);
    return this.events;
  }

  /** Places a predator at an exact spot (scripted events, playtests). */
  spawnAt(id: PredatorId, x: number, y: number, heading = 0): Predator | null {
    const predator = this.group.get() as Predator | null;
    return predator?.spawn(PREDATORS[id], x, y, heading) ?? null;
  }

  /** Spawns a predator just off-screen inside its depth band (the run-time schedule). */
  spawn(def: PredatorDef, camera: Phaser.Cameras.Scene2D.Camera, seal: Threat): Predator | null {
    // Spawn inside its own depth band, just off-screen.
    const band = zoneBand(def.zones);
    const p = pickOffscreenPoint(camera, seal, this.random, {
      marginMin: SPAWN.marginMin + 100,
      marginMax: SPAWN.marginMax + 200,
      aheadBias: 0.5,
      top: Math.max(WATER_TOP + 60, band.top),
      bottom: Math.min(WATER_BOTTOM - 60, band.bottom),
    });
    if (!p) return null;
    const predator = this.group.get() as Predator | null;
    return predator?.spawn(def, p.x, p.y, p.x < camera.midPoint.x ? 0 : Math.PI) ?? null;
  }

  /** Red arrows at the screen edge pointing at hunting predators that are off-screen. */
  private updateArrows(camera: Phaser.Cameras.Scene2D.Camera): void {
    const view = camera.worldView;
    let used = 0;
    for (const p of this.alive) {
      if (!p.isHunting || view.contains(p.x, p.y)) continue;
      const arrow = this.arrows[used++];
      const sx = p.x - view.x;
      const sy = p.y - view.y;
      const angle = Math.atan2(sy - GAME_HEIGHT / 2, sx - GAME_WIDTH / 2);
      arrow
        .setPosition(
          Phaser.Math.Clamp(sx, ARROW_INSET, GAME_WIDTH - ARROW_INSET),
          Phaser.Math.Clamp(sy, ARROW_INSET, GAME_HEIGHT - ARROW_INSET),
        )
        .setRotation(angle)
        .setVisible(true)
        .setAlpha(0.6 + 0.4 * Math.sin(camera.scene.time.now * 0.02));
    }
    for (let i = used; i < this.arrows.length; i++) this.arrows[i].setVisible(false);
  }
}
