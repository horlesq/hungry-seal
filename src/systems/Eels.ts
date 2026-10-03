// Eels living in the map's cave walls (dens from the map config).
// - Moray: hides with just its head showing; when a seal it can eat swims close it tenses,
//   lunges out along the den direction and snaps back.
// - Electric eel: pokes out and charges up (growing glow), then zaps everything nearby.
// A seal big enough eats them (the den stays empty for the rest of the run).
import Phaser from 'phaser';
import { SoundKeys } from '../audio/sounds';
import { TextureKeys } from '../config/assets';
import { Depths } from '../config/depths';
import type { MapDef } from '../config/maps';
import { audio } from '../services/AudioManager';
import { textureScale } from '../services/Viewport';
import { canEat, circlesOverlap } from './feeding';

export const EELS = {
  moray: {
    tier: 5,
    texture: TextureKeys.MorayEel,
    length: 170,
    notice: 300,
    tense: 0.45,
    lunge: 0.22,
    reach: 230,
    retract: 0.7,
    cooldown: 2.2,
    damage: 18,
    knockback: 460,
    stun: 0.3,
    reward: { nutrition: 30, score: 260, growth: 34 },
  },
  electric: {
    tier: 6,
    texture: TextureKeys.ElectricEel,
    length: 180,
    notice: 420,
    charge: 1.3,
    zapRadius: 240,
    cycle: 4.2,
    damage: 14,
    knockback: 380,
    stun: 0.9,
    reward: { nutrition: 34, score: 320, growth: 40 },
  },
} as const;

export type EelKind = keyof typeof EELS;

type State = 'hidden' | 'tense' | 'lunge' | 'retract' | 'cooldown';

interface Eel {
  kind: EelKind;
  /** Den mouth on the wall, and the unit direction into the water. */
  x: number;
  y: number;
  dx: number;
  dy: number;
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  state: State;
  t: number;
  /** How far out of the den (px) the head is. */
  out: number;
  /** Electric charge 0..1. */
  charge: number;
  eaten: boolean;
}

export type EelEvent =
  | { type: 'bite'; source: 'moray'; x: number; y: number; damage: number; knockback: number; stun: number }
  | { type: 'zap'; source: 'eel'; x: number; y: number; damage: number; knockback: number; stun: number; hit: boolean };

export class Eels {
  private readonly eels: Eel[] = [];
  private readonly events: EelEvent[] = [];

  constructor(scene: Phaser.Scene, map: MapDef) {
    for (const den of map.eelDens) {
      const len = Math.hypot(den.dir[0], den.dir[1]) || 1;
      const def = EELS[den.kind];
      const sprite = scene.add
        .image(den.x, den.y, def.texture)
        .setOrigin(0.92, 0.5)
        .setScale(textureScale(scene, def.texture))
        .setRotation(Math.atan2(den.dir[1], den.dir[0]))
        // Behind the rock: the body inside the wall is hidden.
        .setDepth(Depths.Terrain - 0.5);
      const glow = scene.add
        .image(den.x, den.y, TextureKeys.Glow)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(den.kind === 'electric' ? 0xfff27a : 0x9fe0a0)
        .setScale(0.25 * textureScale(scene, TextureKeys.Glow))
        .setAlpha(den.kind === 'electric' ? 0.4 : 0)
        .setDepth(Depths.Glow);
      this.eels.push({
        kind: den.kind,
        x: den.x,
        y: den.y,
        dx: den.dir[0] / len,
        dy: den.dir[1] / len,
        sprite,
        glow,
        state: 'hidden',
        t: Math.random() * 2,
        out: 30,
        charge: 0,
        eaten: false,
      });
    }
  }

  /** Living eels' heads (for eating them): position and radius. */
  heads(): Array<{ eel: Eel; x: number; y: number; r: number; tier: number }> {
    return this.eels
      .filter((e) => !e.eaten)
      .map((e) => ({ eel: e, x: e.x + e.dx * e.out, y: e.y + e.dy * e.out, r: 22, tier: EELS[e.kind].tier }));
  }

  /** The seal ate this eel: its den is empty for the rest of the run. */
  eat(eel: Eel): { nutrition: number; score: number; growth: number } {
    eel.eaten = true;
    eel.sprite.setVisible(false);
    eel.glow.setVisible(false);
    return EELS[eel.kind].reward;
  }

  update(
    dt: number,
    seal: { x: number; y: number; radius: number },
    sealStage: number,
    vulnerable: boolean,
    view: Phaser.Geom.Rectangle,
  ): readonly EelEvent[] {
    this.events.length = 0;
    for (const e of this.eels) {
      if (e.eaten) continue;
      const near = Math.abs(e.x - view.centerX) < view.width && Math.abs(e.y - view.centerY) < view.height;
      e.sprite.setVisible(near);
      if (!near) continue;
      if (e.kind === 'moray') this.stepMoray(e, dt, seal, sealStage, vulnerable);
      else this.stepElectric(e, dt, seal, sealStage, vulnerable);
      const hx = e.x + e.dx * e.out;
      const hy = e.y + e.dy * e.out;
      // The head sits at the sprite's origin (0.92): move the whole sprite out of the den.
      e.sprite.setPosition(hx, hy);
      e.glow.setPosition(hx, hy);
    }
    return this.events;
  }

  private stepMoray(
    e: Eel,
    dt: number,
    seal: { x: number; y: number; radius: number },
    sealStage: number,
    vulnerable: boolean,
  ): void {
    const d = EELS.moray;
    e.t += dt;
    const dist = Math.hypot(seal.x - e.x, seal.y - e.y);
    // A seal that can eat the eel scares it back into its den.
    const scared = canEat(sealStage, d.tier);
    switch (e.state) {
      case 'hidden':
        e.out = 30 + Math.sin(e.t * 2) * 6;
        if (!scared && vulnerable && dist < d.notice) {
          e.state = 'tense';
          e.t = 0;
        }
        break;
      case 'tense':
        // Pulls back a little, shaking: the telegraph.
        e.out = 18 + Math.sin(e.t * 60) * 3;
        if (e.t >= d.tense) {
          e.state = 'lunge';
          e.t = 0;
          audio.play(SoundKeys.Bump);
        }
        break;
      case 'lunge': {
        e.out = 30 + (d.reach * Math.min(1, e.t / d.lunge));
        const hx = e.x + e.dx * e.out;
        const hy = e.y + e.dy * e.out;
        if (vulnerable && circlesOverlap(hx, hy, 24, seal.x, seal.y, seal.radius)) {
          this.events.push({ type: 'bite', source: 'moray', x: hx, y: hy, ...pick(d) });
          e.state = 'retract';
          e.t = 0;
        } else if (e.t >= d.lunge) {
          e.state = 'retract';
          e.t = 0;
        }
        break;
      }
      case 'retract':
        e.out = Math.max(30, e.out - (d.reach / d.retract) * dt);
        if (e.out <= 30) {
          e.state = 'cooldown';
          e.t = 0;
        }
        break;
      case 'cooldown':
        e.out = 30;
        if (e.t >= d.cooldown) {
          e.state = 'hidden';
          e.t = 0;
        }
        break;
    }
    if (scared && e.state !== 'lunge') e.out = Math.max(8, e.out - 200 * dt);
  }

  private stepElectric(
    e: Eel,
    dt: number,
    seal: { x: number; y: number; radius: number },
    sealStage: number,
    vulnerable: boolean,
  ): void {
    const d = EELS.electric;
    e.t += dt;
    const dist = Math.hypot(seal.x - e.x, seal.y - e.y);
    const scared = canEat(sealStage, d.tier);
    e.out = scared ? Math.max(10, e.out - 200 * dt) : 60 + Math.sin(e.t * 1.7) * 14;
    // Charges only while something is around; zaps at the end of each cycle.
    const active = !scared && dist < d.notice;
    const phase = e.t % d.cycle;
    e.charge = active && phase > d.cycle - d.charge ? (phase - (d.cycle - d.charge)) / d.charge : 0;
    e.glow.setAlpha(0.25 + e.charge * 0.75).setScale(0.25 + e.charge * 0.55);
    if (active && phase + dt >= d.cycle) {
      const hx = e.x + e.dx * e.out;
      const hy = e.y + e.dy * e.out;
      const hit = vulnerable && Math.hypot(seal.x - hx, seal.y - hy) < d.zapRadius + seal.radius;
      audio.play(SoundKeys.Zap);
      this.events.push({ type: 'zap', source: 'eel', x: hx, y: hy, hit, ...pick(d) });
    }
  }

  destroy(): void {
    for (const e of this.eels) {
      e.sprite.destroy();
      e.glow.destroy();
    }
    this.eels.length = 0;
  }
}

function pick(d: { damage: number; knockback: number; stun: number }) {
  return { damage: d.damage, knockback: d.knockback, stun: d.stun };
}
