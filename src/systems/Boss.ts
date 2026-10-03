// The map's boss, living in its lair (docs/LEVEL_DESIGN.md: "fight it, don't eat it").
// It drifts around the lair; when the seal comes in it telegraphs, then either lunges at the
// seal or sweeps its tentacles in a growing ring. After each attack it's exposed for a moment:
// a bite then takes one heart (it squirts ink and backs off). Out of hearts it sinks and
// drops a treasure; the first win on a map also counts toward mastering it.
import Phaser from 'phaser';
import { SoundKeys } from '../audio/sounds';
import { TextureKeys } from '../config/assets';
import { Depths } from '../config/depths';
import type { BossId, MapDef } from '../config/maps';
import { audio } from '../services/AudioManager';
import { textureScale } from '../services/Viewport';
import { circlesOverlap } from './feeding';

export const BOSSES: Record<
  BossId,
  { name: string; tint: number; glow: number; hp: number; speed: number; lungeSpeed: number }
> = {
  kraken: { name: 'The Kraken', tint: 0xff8a7a, glow: 0xff6a6a, hp: 6, speed: 90, lungeSpeed: 720 },
  colossal: { name: 'Colossal Squid', tint: 0xe8f0ff, glow: 0x9fd8ff, hp: 7, speed: 80, lungeSpeed: 700 },
  abyssal: { name: 'Abyssal Squid', tint: 0xc88aff, glow: 0xd06bff, hp: 8, speed: 100, lungeSpeed: 760 },
};

export const BOSS = {
  /** Display scale of the stand-in art (the squid texture, 70 du wide). */
  scale: 5.2,
  bodyRadius: 120,
  telegraph: 0.8,
  lungeTime: 0.65,
  sweepTime: 0.55,
  sweepRadius: 300,
  exposed: 2.0,
  recover: 1.6,
  damage: 30,
  knockback: 720,
  /** Seconds a bite makes it invulnerable (no double hits). */
  hitGuard: 0.8,
  reward: { coins: 120, score: 2500, gems: 3 },
} as const;

type State = 'idle' | 'telegraph' | 'lunge' | 'sweep' | 'exposed' | 'recover' | 'dead';

export type BossEvent =
  | { type: 'hit-seal'; x: number; y: number }
  | { type: 'hurt'; x: number; y: number; hp: number }
  | { type: 'defeated'; x: number; y: number }
  | { type: 'hp'; name: string; hp: number; max: number; show: boolean };

export class Boss {
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly def: (typeof BOSSES)[BossId];
  private state: State = 'idle';
  private t = 0;
  private x: number;
  private y: number;
  private vx = 0;
  private vy = 0;
  private hp: number;
  private guard = 0;
  private sweepR = 0;
  private wasShown = false;
  private readonly events: BossEvent[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly lair: MapDef['boss'],
  ) {
    this.def = BOSSES[lair.id];
    this.hp = this.def.hp;
    this.x = lair.x;
    this.y = lair.y;
    this.sprite = scene.add
      .image(this.x, this.y, TextureKeys.Squid)
      .setScale(BOSS.scale * textureScale(scene, TextureKeys.Squid))
      .setTint(this.def.tint)
      .setDepth(11);
    this.glow = scene.add
      .image(this.x, this.y, TextureKeys.Glow)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(this.def.glow)
      .setScale(1.6 * textureScale(scene, TextureKeys.Glow))
      .setAlpha(0.35)
      .setDepth(Depths.Glow);
    this.ring = scene.add.graphics().setDepth(12);
  }

  get name(): string {
    return this.def.name;
  }

  get alive(): boolean {
    return this.state !== 'dead';
  }

  /** The body the seal can bite (only counts while exposed). */
  get body(): { x: number; y: number; r: number; exposed: boolean } {
    return { x: this.x, y: this.y, r: BOSS.bodyRadius, exposed: this.state === 'exposed' && this.guard <= 0 };
  }

  update(dt: number, seal: { x: number; y: number; radius: number }, vulnerable: boolean): readonly BossEvent[] {
    this.events.length = 0;
    if (this.state === 'dead') {
      // Sinks and fades.
      this.t += dt;
      this.y += 40 * dt;
      this.sprite.setPosition(this.x, this.y).setAlpha(Math.max(0, 1 - this.t / 3));
      this.glow.setAlpha(Math.max(0, 0.35 - this.t / 6));
      return this.events;
    }
    this.t += dt;
    this.guard = Math.max(0, this.guard - dt);
    const L = this.lair;
    const inLair = Math.hypot(seal.x - L.x, seal.y - L.y) < L.lairRadius;
    if (inLair !== this.wasShown) {
      this.wasShown = inLair;
      this.events.push({ type: 'hp', name: this.def.name, hp: this.hp, max: this.def.hp, show: inLair });
    }
    const toSeal = Math.atan2(seal.y - this.y, seal.x - this.x);

    switch (this.state) {
      case 'idle': {
        // Slow loop around the lair.
        const a = this.t * 0.35;
        this.steerTo(L.x + Math.cos(a) * L.lairRadius * 0.4, L.y + Math.sin(a) * L.lairRadius * 0.2, this.def.speed);
        if (inLair && vulnerable) this.enter('telegraph');
        break;
      }
      case 'telegraph':
        this.vx *= 0.9;
        this.vy *= 0.9;
        this.sprite.setTint(Math.floor(this.t * 12) % 2 ? 0xffffff : this.def.tint);
        if (this.t >= BOSS.telegraph) {
          this.sprite.setTint(this.def.tint);
          // Close: sweep the tentacles; farther: lunge.
          const d = Math.hypot(seal.x - this.x, seal.y - this.y);
          if (d < BOSS.sweepRadius) {
            this.enter('sweep');
            audio.play(SoundKeys.Explode);
          } else {
            this.vx = Math.cos(toSeal) * this.def.lungeSpeed;
            this.vy = Math.sin(toSeal) * this.def.lungeSpeed;
            this.enter('lunge');
            audio.play(SoundKeys.SharkAlert);
          }
        }
        break;
      case 'lunge':
        if (vulnerable && circlesOverlap(this.x, this.y, BOSS.bodyRadius, seal.x, seal.y, seal.radius)) {
          this.events.push({ type: 'hit-seal', x: this.x, y: this.y });
        }
        if (this.t >= BOSS.lungeTime) this.enter('exposed');
        break;
      case 'sweep': {
        this.sweepR = (this.t / BOSS.sweepTime) * BOSS.sweepRadius;
        const d = Math.hypot(seal.x - this.x, seal.y - this.y);
        if (vulnerable && Math.abs(d - this.sweepR) < seal.radius + 26) {
          this.events.push({ type: 'hit-seal', x: this.x, y: this.y });
        }
        if (this.t >= BOSS.sweepTime) {
          this.sweepR = 0;
          this.enter('exposed');
        }
        break;
      }
      case 'exposed':
        // Tired: drifts, glowing so the player knows to bite now.
        this.vx *= Math.exp(-2 * dt);
        this.vy *= Math.exp(-2 * dt);
        if (this.t >= BOSS.exposed) this.enter('recover');
        break;
      case 'recover':
        this.steerTo(L.x, L.y, this.def.speed * 2);
        if (this.t >= BOSS.recover) this.enter('idle');
        break;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // Never leaves its lair.
    const dx = this.x - L.x;
    const dy = this.y - L.y;
    const lim = L.lairRadius * 0.8;
    if (Math.hypot(dx, dy) > lim) {
      const k = lim / Math.hypot(dx, dy);
      this.x = L.x + dx * k;
      this.y = L.y + dy * k;
    }
    this.sprite.setPosition(this.x, this.y);
    this.sprite.setFlipX(this.vx < -5);
    this.sprite.setRotation(Math.sin(this.t * 1.4) * 0.06);
    const exposed = this.state === 'exposed';
    this.glow
      .setPosition(this.x, this.y)
      .setAlpha(exposed ? 0.55 + 0.3 * Math.sin(this.t * 10) : 0.3);
    this.ring.clear();
    if (this.state === 'sweep' && this.sweepR > 0) {
      this.ring.lineStyle(14, this.def.glow, 0.6).strokeCircle(this.x, this.y, this.sweepR);
    }
    return this.events;
  }

  /** The seal bit it while exposed. */
  hit(): void {
    if (!this.body.exposed) return;
    this.hp--;
    this.guard = BOSS.hitGuard;
    this.events.push({ type: 'hurt', x: this.x, y: this.y, hp: this.hp });
    this.events.push({ type: 'hp', name: this.def.name, hp: this.hp, max: this.def.hp, show: true });
    if (this.hp <= 0) {
      this.state = 'dead';
      this.t = 0;
      this.events.push({ type: 'defeated', x: this.x, y: this.y });
      this.events.push({ type: 'hp', name: this.def.name, hp: 0, max: this.def.hp, show: false });
      return;
    }
    // Ink and back off.
    this.enter('recover');
  }

  /** Events raised by hit() (read once by the scene after calling it). */
  drainEvents(): BossEvent[] {
    return this.events.splice(0);
  }

  private enter(state: State): void {
    this.state = state;
    this.t = 0;
  }

  private steerTo(x: number, y: number, speed: number): void {
    const a = Math.atan2(y - this.y, x - this.x);
    const d = Math.hypot(x - this.x, y - this.y);
    const s = Math.min(speed, d * 2);
    this.vx += (Math.cos(a) * s - this.vx) * 0.05;
    this.vy += (Math.sin(a) * s - this.vy) * 0.05;
  }

  destroy(): void {
    this.sprite.destroy();
    this.glow.destroy();
    this.ring.destroy();
  }
}
