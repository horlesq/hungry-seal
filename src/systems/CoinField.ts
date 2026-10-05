// Coins: floating clusters spawned off-screen, plus coins popped out of eaten prey.
// Collected by touching them (with a short magnet pull).
import Phaser from 'phaser';
import { COINS, SPAWN } from '../config/balance';
import { Coin } from '../entities/Coin';
import { despawnRange, pickOffscreenPoint, type Mover } from './spawnPoint';
import { currentMap } from '../world/GameMap';
import { openSpot, WATER_BOTTOM, WATER_TOP } from './Spawner';

const POOL_SIZE = 60;
/** World coins spawned in an arc; how far apart. */
const CLUSTER_SPACING = 34;

export class CoinField {
  readonly group: Phaser.GameObjects.Group;
  private clusterTimer = 0;
  /** Coins that belong to a floating cluster (not dropped), for the cluster budget. */
  private worldCoins = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly random: () => number = Math.random,
  ) {
    this.group = scene.add.group({ classType: Coin, maxSize: POOL_SIZE });
  }

  /** Pops `count` coins out at (x, y) (e.g. from eaten prey). */
  drop(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const coin = this.group.get() as Coin | null;
      if (!coin) return;
      coin.spawn(x, y, true, this.random);
    }
  }

  /** Steps coins and returns how many the seal collected this frame. */
  update(
    dt: number,
    camera: Phaser.Cameras.Scene2D.Camera,
    seal: Mover & { x: number; y: number; radius: number },
    collecting: boolean,
    magnetRadius: number = COINS.magnetRadius,
  ): number {
    let collected = 0;
    this.worldCoins = 0;
    const reach = seal.radius + COINS.pickupRadius;
    const cx = camera.midPoint.x;
    const cy = camera.midPoint.y;

    for (const child of this.group.getChildren()) {
      const coin = child as Coin;
      if (!coin.active) continue;
      // A dead seal doesn't attract coins: step them as if the seal were far away.
      const alive = collecting
        ? coin.step(dt, seal.x, seal.y, magnetRadius)
        : coin.step(dt, 1e9, 1e9);
      if (!alive) continue;
      if (collecting && Math.hypot(coin.x - seal.x, coin.y - seal.y) <= reach) {
        coin.despawn();
        collected++;
        continue;
      }
      if (Math.hypot(coin.x - cx, coin.y - cy) > despawnRange(camera.worldView)) {
        coin.despawn();
        continue;
      }
      if (coin.world) this.worldCoins++;
    }

    this.clusterTimer -= dt;
    if (this.clusterTimer <= 0) {
      this.clusterTimer = COINS.clusterInterval;
      const [min, max] = COINS.clusterSize;
      if (this.worldCoins < COINS.clustersAlive * max) this.spawnCluster(camera, seal, min, max);
    }
    return collected;
  }

  countActive(): number {
    return this.group.countActive(true);
  }

  /** A gentle arc of coins just off-screen, ahead of the seal. */
  private spawnCluster(
    camera: Phaser.Cameras.Scene2D.Camera,
    seal: Mover,
    min: number,
    max: number,
  ): void {
    const p = pickOffscreenPoint(camera, seal, this.random, {
      marginMin: SPAWN.marginMin,
      marginMax: SPAWN.marginMax,
      aheadBias: 0.85,
      top: WATER_TOP + 80,
      bottom: WATER_BOTTOM - 80,
      accept: (x, y) => openSpot(currentMap().terrain, x, y, 90),
    });
    if (!p) return;
    const count = min + Math.floor(this.random() * (max - min + 1));
    const arc = (this.random() - 0.5) * 0.02;
    for (let i = 0; i < count; i++) {
      const coin = this.group.get() as Coin | null;
      if (!coin) return;
      const t = i - (count - 1) / 2;
      const x = p.x + t * CLUSTER_SPACING;
      const y = p.y + t * t * arc * 400 - 10;
      if (!openSpot(currentMap().terrain, x, y, 20)) continue;
      coin.spawn(x, y, false, this.random);
    }
  }
}
