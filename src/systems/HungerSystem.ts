// Hunger = the seal's health. Drains continuously (faster over time and deeper down);
// eating refills it; reaching zero ends the run. Pure logic, no Phaser.
import type { ZoneId } from '../config/zones';

export interface HungerParams {
  max: number;
  baseDrainPerSec: number;
  rampSeconds: number;
  zoneMultiplier: Readonly<Record<ZoneId, number>>;
  /** Bigger seals burn more: drain multiplier per growth stage (index 0 = stage 1). */
  sizeMultiplier?: readonly number[];
  lowFraction: number;
}

export class HungerSystem {
  value: number;

  constructor(private readonly params: HungerParams) {
    this.value = params.max;
  }

  get max(): number {
    return this.params.max;
  }

  get fraction(): number {
    return this.value / this.params.max;
  }

  get isLow(): boolean {
    return this.fraction <= this.params.lowFraction;
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
    this.value = Math.max(0, this.value - this.drainRate(elapsed, zone, stage) * extra * dt);
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
