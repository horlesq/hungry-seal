// Hunger = the seal's health. Drains continuously (faster over time, deeper down and for a
// bigger seal); eating refills it; reaching zero ends the run. Pure logic, no Phaser.
import type { ZoneId } from '../config/zones';

export interface HungerParams {
  max: number;
  baseDrainPerSec: number;
  rampSeconds: number;
  zoneMultiplier: Readonly<Record<ZoneId, number>>;
  /** Bigger seals burn more: drain multiplier per growth stage (index 0 = stage 1). */
  sizeMultiplier?: readonly number[];
  /** Low (warning) below this fraction of the bar... */
  lowFraction: number;
  /** ...or when fewer than this many seconds of food are left at the current drain. */
  lowSeconds?: number;
}

export class HungerSystem {
  value: number;
  /** Drain per second at the last update (for the time-based low warning). */
  private lastRate = 0;

  constructor(private readonly params: HungerParams) {
    this.value = params.max;
  }

  get max(): number {
    return this.params.max;
  }

  get fraction(): number {
    return this.value / this.params.max;
  }

  /**
   * Time to warn the player: under a fixed share of the bar, or (late in a run, when the bar
   * empties fast) fewer than `lowSeconds` of food left.
   */
  get isLow(): boolean {
    const p = this.params;
    return this.fraction <= p.lowFraction || this.value <= this.lastRate * (p.lowSeconds ?? 0);
  }

  get isStarved(): boolean {
    return this.value <= 0;
  }

  /** Hunger lost per second after `elapsed` seconds of the run, in `zone`, at `stage`. */
  drainRate(elapsed: number, zone: ZoneId, stage = 1): number {
    const p = this.params;
    const sizes = p.sizeMultiplier ?? [];
    const size = sizes.length ? sizes[Math.min(Math.max(stage, 1), sizes.length) - 1] : 1;
    return p.baseDrainPerSec * (1 + elapsed / p.rampSeconds) * p.zoneMultiplier[zone] * size;
  }

  /** `extra` multiplies the drain (toxic water, hot vents). */
  update(dt: number, elapsed: number, zone: ZoneId, extra = 1, stage = 1): void {
    this.lastRate = this.drainRate(elapsed, zone, stage) * extra;
    this.value = Math.max(0, this.value - this.lastRate * dt);
  }

  /** Restores hunger (clamped to max). Returns the amount actually gained. */
  feed(amount: number): number {
    const before = this.value;
    this.value = Math.min(this.params.max, this.value + amount);
    return this.value - before;
  }

  damage(amount: number): void {
    this.value = Math.max(0, this.value - amount);
  }
}
