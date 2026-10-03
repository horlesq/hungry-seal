// Fishing boats patrolling the surface lanes of a map. While the seal is below one, the
// crew drops nets (sinking; tangle the seal: slow + a little damage) and throws harpoons
// (fast, hurt). A seal of size BOAT_RAM_STAGE can ram the hull from below: the boat drops
// fish crates (food and coins) and flees for a while.
import Phaser from 'phaser';
import { SoundKeys } from '../audio/sounds';
import { TextureKeys } from '../config/assets';
import type { MapDef } from '../config/maps';
import { WORLD } from '../config/zones';
import { audio } from '../services/AudioManager';
import { textureScale } from '../services/Viewport';
import { circlesOverlap } from './feeding';

export const BOATS = {
  speed: 90,
  fleeSpeed: 260,
  /** Seconds between attacks while the seal is in range. */
  attackEvery: 3.2,
  /** The crew attacks a seal within this horizontal distance and depth below the surface. */
  rangeX: 650,
  rangeDepth: 1000,
  harpoonRange: 520,
  harpoonSpeed: 760,
  netSink: 130,
  netRadius: 56,
  netTrap: 2.2,
  netDamage: 6,
  harpoonDamage: 16,
  harpoonKnockback: 420,
  /** Size needed to ram a boat (knocks its catch loose). */
  ramStage: 7,
  fleeTime: 20,
  crates: 3,
  crate: { nutrition: 25, score: 150, growth: 20, coins: 3 },
} as const;

interface Boat {
  sprite: Phaser.GameObjects.Image;
  x0: number;
  x1: number;
  dir: number;
  attackTimer: number;
  fleeLeft: number;
}

interface Projectile {
  kind: 'net' | 'harpoon';
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
}

interface Crate {
  sprite: Phaser.GameObjects.Image;
  vy: number;
  life: number;
}

export type BoatEvent =
  | { type: 'net' | 'harpoon'; x: number; y: number }
  | { type: 'crate'; x: number; y: number }
  | { type: 'rammed'; x: number; y: number };

export class Boats {
  private readonly boats: Boat[] = [];
  private readonly shots: Projectile[] = [];
  private readonly crates: Crate[] = [];
  private readonly events: BoatEvent[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    map: MapDef,
    private readonly random: () => number = Math.random,
  ) {
    for (const lane of map.boatLanes) {
      const x = lane.x0 + (lane.x1 - lane.x0) * (0.3 + random() * 0.4);
      const sprite = scene.add
        .image(x, WORLD.surfaceY + 34, TextureKeys.Boat)
        .setOrigin(0.5, 0.94)
        .setScale(textureScale(scene, TextureKeys.Boat))
        .setDepth(12);
      this.boats.push({ sprite, x0: lane.x0, x1: lane.x1, dir: random() < 0.5 ? -1 : 1, attackTimer: 2, fleeLeft: 0 });
    }
  }

  update(
    dt: number,
    time: number,
    seal: { x: number; y: number; radius: number; inWater: boolean },
    sealStage: number,
    vulnerable: boolean,
  ): readonly BoatEvent[] {
    this.events.length = 0;
    for (const b of this.boats) this.stepBoat(b, dt, time, seal, sealStage);
    this.stepShots(dt, seal, vulnerable);
    this.stepCrates(dt, seal);
    return this.events;
  }

  private stepBoat(
    b: Boat,
    dt: number,
    time: number,
    seal: { x: number; y: number; radius: number; inWater: boolean },
    sealStage: number,
  ): void {
    const s = b.sprite;
    b.fleeLeft = Math.max(0, b.fleeLeft - dt);
    const speed = b.fleeLeft > 0 ? BOATS.fleeSpeed : BOATS.speed;
    s.x += b.dir * speed * dt;
    if (s.x < b.x0) b.dir = 1;
    else if (s.x > b.x1) b.dir = -1;
    s.setFlipX(b.dir < 0);
    // Bob on the waves.
    s.y = WORLD.surfaceY + 34 + Math.sin(time * 0.002 + b.x0) * 5;
    s.setRotation(Math.sin(time * 0.0016 + b.x0) * 0.04);

    // Ram: a big seal hitting the hull from below knocks the catch loose.
    const hullY = WORLD.surfaceY + 10;
    if (
      sealStage >= BOATS.ramStage &&
      b.fleeLeft <= 0 &&
      circlesOverlap(seal.x, seal.y, seal.radius, s.x, hullY, 120)
    ) {
      b.fleeLeft = BOATS.fleeTime;
      b.dir = seal.x < s.x ? 1 : -1;
      this.events.push({ type: 'rammed', x: s.x, y: hullY });
      audio.play(SoundKeys.Bump);
      for (let i = 0; i < BOATS.crates; i++) {
        const crate = this.scene.add
          .image(s.x + (i - 1) * 50, hullY + 20, TextureKeys.Crate)
          .setScale(textureScale(this.scene, TextureKeys.Crate))
          .setDepth(9);
        this.crates.push({ sprite: crate, vy: 60 + this.random() * 60, life: 14 });
      }
      return;
    }

    // Attack a seal swimming below.
    if (b.fleeLeft > 0 || !seal.inWater) return;
    const dx = seal.x - s.x;
    const depth = seal.y - WORLD.surfaceY;
    if (Math.abs(dx) > BOATS.rangeX || depth > BOATS.rangeDepth || depth < 0) {
      b.attackTimer = Math.min(b.attackTimer, 1.2);
      return;
    }
    b.attackTimer -= dt;
    if (b.attackTimer > 0) return;
    b.attackTimer = BOATS.attackEvery * (0.8 + this.random() * 0.4);
    const close = Math.hypot(dx, depth) < BOATS.harpoonRange;
    if (close && this.random() < 0.6) this.throwHarpoon(s.x, hullY - 40, seal.x, seal.y);
    else this.dropNet(s.x + dx * 0.4, hullY + 40);
  }

  private throwHarpoon(x: number, y: number, tx: number, ty: number): void {
    const a = Math.atan2(ty - y, tx - x);
    const sprite = this.scene.add
      .image(x, y, TextureKeys.Harpoon)
      .setScale(textureScale(this.scene, TextureKeys.Harpoon))
      .setRotation(a)
      .setDepth(11);
    this.shots.push({
      kind: 'harpoon',
      sprite,
      vx: Math.cos(a) * BOATS.harpoonSpeed,
      vy: Math.sin(a) * BOATS.harpoonSpeed,
      life: 1.6,
    });
    audio.play(SoundKeys.Boost);
  }

  private dropNet(x: number, y: number): void {
    const sprite = this.scene.add
      .image(x, y, TextureKeys.Net)
      .setScale(textureScale(this.scene, TextureKeys.Net))
      .setAlpha(0.9)
      .setDepth(11);
    this.shots.push({ kind: 'net', sprite, vx: 0, vy: BOATS.netSink, life: 7 });
    audio.play(SoundKeys.Splash);
  }

  private stepShots(dt: number, seal: { x: number; y: number; radius: number }, vulnerable: boolean): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const p = this.shots[i];
      p.life -= dt;
      // Harpoons slow down in the water; nets drift and sway as they sink.
      if (p.kind === 'harpoon') {
        p.vx *= Math.exp(-0.8 * dt);
        p.vy *= Math.exp(-0.8 * dt);
      } else {
        p.sprite.setRotation(Math.sin(p.life * 2) * 0.15);
      }
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      if (p.life < 1) p.sprite.setAlpha(Math.max(0, p.life));
      const r = p.kind === 'net' ? BOATS.netRadius : 16;
      const hit = vulnerable && circlesOverlap(p.sprite.x, p.sprite.y, r, seal.x, seal.y, seal.radius);
      if (hit) this.events.push({ type: p.kind, x: p.sprite.x, y: p.sprite.y });
      if (hit || p.life <= 0) {
        p.sprite.destroy();
        this.shots.splice(i, 1);
      }
    }
  }

  private stepCrates(dt: number, seal: { x: number; y: number; radius: number }): void {
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      c.life -= dt;
      c.sprite.y += c.vy * dt;
      c.sprite.setRotation(Math.sin(c.life * 1.5) * 0.2);
      const got = circlesOverlap(c.sprite.x, c.sprite.y, 24, seal.x, seal.y, seal.radius);
      if (got) this.events.push({ type: 'crate', x: c.sprite.x, y: c.sprite.y });
      if (got || c.life <= 0) {
        c.sprite.destroy();
        this.crates.splice(i, 1);
      }
    }
  }

  destroy(): void {
    for (const b of this.boats) b.sprite.destroy();
    for (const p of this.shots) p.sprite.destroy();
    for (const c of this.crates) c.sprite.destroy();
    this.boats.length = 0;
    this.shots.length = 0;
    this.crates.length = 0;
  }
}
