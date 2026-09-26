// Hunger = the seal's health. Drains continuously (faster over time and deeper down);
// eating refills it; reaching zero ends the run. Pure logic, no Phaser.
import type { ZoneId } from '../config/zones';

export interface HungerParams {
  max: number;
  baseDrainPerSec: number;
  rampSeconds: number;
  zoneMultiplier: Readonly<Record<ZoneId, number>>;
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

  /** Hunger lost per second after `elapsed` seconds of the run, in `zone`. */
  drainRate(elapsed: number, zone: ZoneId): number {
    const p = this.params;
    return p.baseDrainPerSec * (1 + elapsed / p.rampSeconds) * p.zoneMultiplier[zone];
  }

  update(dt: number, elapsed: number, zone: ZoneId): void {
    this.value = Math.max(0, this.value - this.drainRate(elapsed, zone) * dt);
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
