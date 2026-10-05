// Pooled hazards (jellyfish, mines) spawned off-screen once the run is under way. The number
// allowed grows with run time (DANGER config) so the start of a run stays safe.
import Phaser from 'phaser';
import { DANGER, SPAWN } from '../config/balance';
import { HAZARD_LIST, HAZARDS, type HazardId } from '../config/hazards';
import { Hazard } from '../entities/Hazard';
import { hazardsAllowed } from './danger';
import { despawnRange, pickForZone, pickOffscreenPoint, type Mover } from './spawnPoint';
import { openSpot, WATER_BOTTOM, WATER_TOP } from './Spawner';
import { currentMap } from '../world/GameMap';

const POOL_SIZE = 16;

export class HazardField {
  readonly group: Phaser.GameObjects.Group;
  readonly alive: Hazard[] = [];
  private timer = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly random: () => number = Math.random,
  ) {
    this.group = scene.add.group({ classType: Hazard, maxSize: POOL_SIZE });
  }

  private get terrain() {
    return currentMap().terrain;
  }

  /** Places a hazard at an exact spot (scripted events, playtests). */
  spawnAt(id: HazardId, x: number, y: number): Hazard | null {
    const hazard = this.group.get() as Hazard | null;
    return hazard?.spawn(HAZARDS[id], x, y, this.random) ?? null;
  }

  update(dt: number, camera: Phaser.Cameras.Scene2D.Camera, seal: Mover, elapsed: number): void {
    this.alive.length = 0;
    const cx = camera.midPoint.x;
    const cy = camera.midPoint.y;
    for (const child of this.group.getChildren()) {
      const h = child as Hazard;
      if (!h.active) continue;
      h.step(dt);
      // Drifting into rock: drift back the other way.
      if (this.terrain.distance(h.x, h.y) < h.radius + 10) h.bounce();
      if (Math.hypot(h.x - cx, h.y - cy) > despawnRange(camera.worldView)) h.despawn();
      else this.alive.push(h);
    }

    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = DANGER.hazardSpawnInterval;
    const bloom = currentMap().regionAt(cx, cy).jellyBloom ?? 1;
    if (this.alive.length >= Math.round(hazardsAllowed(elapsed) * bloom)) return;

    const p = pickOffscreenPoint(camera, seal, this.random, {
      marginMin: SPAWN.marginMin,
      marginMax: SPAWN.marginMax,
      aheadBias: SPAWN.aheadBias,
      top: WATER_TOP + 60,
      bottom: WATER_BOTTOM - 60,
      accept: (x, y) => openSpot(this.terrain, x, y, 110),
    });
    if (!p) return;
    const def = pickForZone(HAZARD_LIST, p.y, this.random);
    const hazard = def ? (this.group.get() as Hazard | null) : null;
    if (def && hazard) hazard.spawn(def, p.x, p.y, this.random);
  }
}
