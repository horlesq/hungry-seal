// Hazards the map places (as opposed to the random drifting ones in HazardField): urchin
// beds along the seabed, mines on chains in minefields, and clouds of toxic or hot water
// that make hunger drain faster. Built once per run; only the ones near the view update.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { HAZARDS } from '../config/hazards';
import { Hazard } from '../entities/Hazard';
import { textureScale } from '../services/Viewport';
import type { GameMap } from '../world/GameMap';

/** Hunger drain multiplier inside each kind of cloud. */
const CLOUD_DRAIN = { toxic: 3, heat: 2 } as const;
const CLOUD_TINT = { toxic: 0x7dff4a, heat: 0xff7a2a } as const;
const URCHIN_SPACING = 70;
const CULL = 600;

interface Cloud {
  x: number;
  y: number;
  r: number;
  kind: 'toxic' | 'heat';
  puffs: Phaser.GameObjects.Image[];
}

export class MapHazards {
  /** Urchins and mines still in play. */
  readonly alive: Hazard[] = [];
  private readonly chains: Array<{ mine: Hazard; groundY: number }> = [];
  private readonly chainGfx: Phaser.GameObjects.Graphics;
  private readonly clouds: Cloud[] = [];
  private time = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    map: GameMap,
    random: () => number = Math.random,
  ) {
    const t = map.terrain;
    const def = map.def;
    for (const bed of def.urchinBeds) {
      for (let x = bed.x0; x <= bed.x1; x += URCHIN_SPACING * (0.7 + random() * 0.6)) {
        const ground = t.groundBelow(x, bed.minY, bed.maxY - bed.minY);
        if (ground === null || ground > bed.maxY) continue;
        const n = t.normal(x, ground - 4, { x: 0, y: 0 });
        if (n.y > -0.6) continue; // too steep
        this.add(new Hazard(scene).spawn(HAZARDS.urchin, x, ground - 13, random));
      }
    }
    this.chainGfx = scene.add.graphics().setDepth(8);
    for (const field of def.minefields) {
      for (let i = 0; i < field.count; i++) {
        const x = field.x0 + ((i + 0.5) / field.count) * (field.x1 - field.x0) + (random() - 0.5) * 160;
        const ground = t.groundBelow(x, 700, 6000);
        if (ground === null) continue;
        const y = ground - 200 - random() * 420;
        if (t.distance(x, y) < 60) continue;
        const mine = new Hazard(scene).spawn(HAZARDS.mine, x, y, random);
        this.add(mine);
        this.chains.push({ mine, groundY: ground });
      }
    }
    for (const z of def.toxicZones) {
      const puffs: Phaser.GameObjects.Image[] = [];
      const ts = textureScale(scene, TextureKeys.Glow);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        puffs.push(
          scene.add
            .image(z.x + Math.cos(a) * z.r * 0.35, z.y + Math.sin(a) * z.r * 0.25, TextureKeys.Glow)
            .setTint(CLOUD_TINT[z.kind])
            .setBlendMode(Phaser.BlendModes.ADD)
            .setAlpha(0.3)
            .setScale(((z.r * 1.3) / 256) * ts * 2)
            .setDepth(13),
        );
      }
      this.clouds.push({ ...z, puffs });
    }
  }

  private add(h: Hazard): void {
    this.scene.add.existing(h);
    this.alive.push(h);
  }

  /** Hunger drain multiplier at (x, y): >1 inside toxic or hot water. */
  drainAt(x: number, y: number): number {
    for (const c of this.clouds) {
      if (Math.hypot(x - c.x, y - c.y) < c.r) return CLOUD_DRAIN[c.kind];
    }
    return 1;
  }

  /** The cloud at (x, y), if any (for the "toxic!" warning). */
  cloudAt(x: number, y: number): 'toxic' | 'heat' | null {
    for (const c of this.clouds) if (Math.hypot(x - c.x, y - c.y) < c.r) return c.kind;
    return null;
  }

  update(dt: number, camera: Phaser.Cameras.Scene2D.Camera): void {
    this.time += dt;
    const v = camera.worldView;
    const near = (x: number, y: number) =>
      x > v.x - CULL && x < v.right + CULL && y > v.y - CULL && y < v.bottom + CULL;
    for (let i = this.alive.length - 1; i >= 0; i--) {
      const h = this.alive[i];
      if (!h.active) {
        this.alive.splice(i, 1);
        continue;
      }
      const on = near(h.x, h.y);
      h.setVisible(on);
      if (on) h.step(dt);
    }
    this.chainGfx.clear();
    for (const c of this.chains) {
      if (!c.mine.active || !near(c.mine.x, c.mine.y)) continue;
      this.chainGfx.lineStyle(4, 0x2a2f36, 1);
      this.chainGfx.lineBetween(c.mine.x, c.mine.y + 24, c.mine.x, c.groundY);
      this.chainGfx.lineStyle(2, 0x6b7380, 1);
      for (let y = c.mine.y + 34; y < c.groundY; y += 14) {
        this.chainGfx.strokeEllipse(c.mine.x, y, 6, 10);
      }
    }
    for (const c of this.clouds) {
      const on = near(c.x, c.y);
      c.puffs.forEach((p, i) => {
        p.setVisible(on);
        if (on) p.setAlpha(0.22 + 0.12 * Math.sin(this.time * 1.3 + i * 1.7));
      });
    }
  }

  destroy(): void {
    for (const h of this.alive) h.destroy();
    for (const c of this.clouds) for (const p of c.puffs) p.destroy();
    this.chainGfx.destroy();
    this.alive.length = 0;
  }
}
