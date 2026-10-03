// Pickups: treasure chests on the seabed (touch to burst them open for coins) and rare
// floating magnet orbs (temporary long-range coin magnet). Both glow so they can be found
// in the dark. Rewards are applied by GameScene from the events this returns.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { PICKUPS, SPAWN } from '../config/balance';
import { Depths } from '../config/depths';
import { zoneAt } from '../config/zones';
import { currentMap } from '../world/GameMap';
import { textureScale } from '../services/Viewport';
import { circlesOverlap } from './feeding';
import { pickOffscreenPoint, type Mover } from './spawnPoint';
import { openSpot, WATER_BOTTOM, WATER_TOP } from './Spawner';

export type PickupKind = 'chest' | 'magnet';

export interface PickupEvent {
  kind: PickupKind;
  x: number;
  y: number;
}

interface Pickup {
  kind: PickupKind;
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  baseY: number;
  age: number;
  /** Seconds left before it disappears (chests: after opening). */
  life: number;
  opened: boolean;
  /** Index of the map treasure spot it sits on, if any. */
  spot: number | null;
}

/** Chests sit this far above the ground (sprite centre). */
const CHEST_LIFT = 24;
/** A map treasure spot comes back this long after its chest is opened. */
const SPOT_RESPAWN = 150;
/** Treasure spots get their chest when the view comes this close. */
const SPOT_RANGE = 1700;

export class Pickups {
  private readonly items: Pickup[] = [];
  private chestTimer = 0;
  private magnetTimer: number = PICKUPS.magnetInterval * 0.6;
  private readonly events: PickupEvent[] = [];
  /** Seconds until each map treasure spot can hold a chest again. */
  private readonly spotCooldown: number[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly random: () => number = Math.random,
  ) {}

  /** Places a pickup at an exact spot (scripted events, playtests). */
  spawnAt(kind: PickupKind, x: number, y: number, spot: number | null = null): void {
    const texture = kind === 'chest' ? TextureKeys.Chest : TextureKeys.MagnetOrb;
    const ts = textureScale(this.scene, texture);
    const sprite = this.scene.add.image(x, y, texture).setScale(ts).setDepth(9);
    const glow = this.scene.add
      .image(x, y, TextureKeys.Glow)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(Depths.Glow)
      .setTint(kind === 'chest' ? 0xffd23c : 0xff6a5a)
      .setScale((kind === 'chest' ? 0.5 : 0.35) * textureScale(this.scene, TextureKeys.Glow))
      .setAlpha(0.6);
    this.items.push({
      kind,
      sprite,
      glow,
      baseY: y,
      age: this.random() * 5,
      life: kind === 'chest' ? Infinity : PICKUPS.magnetLifetime,
      opened: false,
      spot,
    });
  }

  /** Steps pickups, spawns new ones, and returns what the seal touched this frame. */
  update(
    dt: number,
    camera: Phaser.Cameras.Scene2D.Camera,
    seal: Mover & { x: number; y: number; radius: number },
    collecting: boolean,
  ): readonly PickupEvent[] {
    this.events.length = 0;
    const cx = camera.midPoint.x;
    const cy = camera.midPoint.y;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.age += dt;
      p.life -= dt;
      if (p.kind === 'magnet') p.sprite.y = p.baseY + Math.sin(p.age * 2) * 8;
      p.glow.setPosition(p.sprite.x, p.sprite.y).setAlpha(0.45 + 0.2 * Math.sin(p.age * 3));

      const far = Math.hypot(p.sprite.x - cx, p.sprite.y - cy) > SPAWN.despawnDistance * 1.5;
      if (p.life <= 0 || far) {
        this.remove(i);
        continue;
      }
      if (p.opened) {
        p.sprite.setAlpha(Math.min(1, p.life));
        continue;
      }
      const radius = p.kind === 'chest' ? PICKUPS.chestRadius : PICKUPS.orbRadius;
      if (
        collecting &&
        circlesOverlap(seal.x, seal.y, seal.radius, p.sprite.x, p.sprite.y, radius)
      ) {
        this.events.push({ kind: p.kind, x: p.sprite.x, y: p.sprite.y });
        if (p.kind === 'chest') {
          // Chests stay open for a moment, then fade.
          p.opened = true;
          p.life = 3;
          if (p.spot !== null) this.spotCooldown[p.spot] = SPOT_RESPAWN;
          p.sprite.setTexture(TextureKeys.ChestOpen);
          p.glow.setVisible(false);
        } else {
          this.remove(i);
        }
      }
    }

    this.spawnChest(dt, camera, seal);
    this.spawnMagnet(dt, camera, seal);
    return this.events;
  }

  count(kind: PickupKind): number {
    return this.items.filter((p) => p.kind === kind && !p.opened).length;
  }

  private remove(index: number): void {
    const [p] = this.items.splice(index, 1);
    p.sprite.destroy();
    p.glow.destroy();
  }

  private spawnChest(dt: number, camera: Phaser.Cameras.Scene2D.Camera, seal: Mover): void {
    for (let i = 0; i < this.spotCooldown.length; i++) {
      this.spotCooldown[i] = Math.max(0, (this.spotCooldown[i] ?? 0) - dt);
    }
    this.chestTimer -= dt;
    if (this.chestTimer > 0) return;
    this.chestTimer = PICKUPS.chestCheckInterval;
    const terrain = currentMap().terrain;
    const cx = camera.midPoint.x;
    const cy = camera.midPoint.y;

    // The map's treasure spots (caves, wrecks) fill up as the seal comes near.
    currentMap().def.treasure.forEach((s, i) => {
      if ((this.spotCooldown[i] ?? 0) > 0) return;
      if (this.items.some((p) => p.spot === i)) return;
      if (Math.hypot(s.x - cx, s.y - cy) > SPOT_RANGE) return;
      const ground = terrain.groundBelow(s.x, s.y - 120, 600);
      this.spawnAt('chest', s.x, (ground ?? s.y) - CHEST_LIFT, i);
    });

    // Plus the odd chest on the abyss seabed, just off-screen ahead.
    const randomChests = this.items.filter((p) => p.kind === 'chest' && p.spot === null).length;
    if (randomChests > 0 || zoneAt(cy).id !== 'abyss') return;
    const dir = seal.vx >= 0 ? 1 : -1;
    const x = cx + dir * (camera.worldView.width / 2 + 150 + this.random() * 300);
    const ground = terrain.groundBelow(x, cy - 300, PICKUPS.chestNearFloor + 600);
    if (ground === null || zoneAt(ground).id !== 'abyss' || !openSpot(terrain, x, ground - 60, 30)) {
      return;
    }
    this.spawnAt('chest', x, ground - CHEST_LIFT);
  }

  private spawnMagnet(dt: number, camera: Phaser.Cameras.Scene2D.Camera, seal: Mover): void {
    this.magnetTimer -= dt;
    if (this.magnetTimer > 0 || this.count('magnet') > 0) return;
    this.magnetTimer = PICKUPS.magnetInterval;
    const p = pickOffscreenPoint(camera, seal, this.random, {
      marginMin: SPAWN.marginMin,
      marginMax: SPAWN.marginMax,
      aheadBias: 0.9,
      top: WATER_TOP + 80,
      bottom: WATER_BOTTOM - 120,
      accept: (x, y) => openSpot(currentMap().terrain, x, y, 60),
    });
    if (p) this.spawnAt('magnet', p.x, p.y);
  }
}
