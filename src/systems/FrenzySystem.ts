// Frenzy: meals (weighted by combo) fill a meter; when full, the seal goes into a short
// frenzy (fast, invulnerable, eats anything, double score). The meter drains slowly if you
// stop eating. Pure logic, no Phaser.

export interface FrenzyParams {
  /** Meter gained per meal, times the combo multiplier. */
  perMeal: number;
  /** Seconds without eating before the meter starts draining. */
  decayDelay: number;
  /** Meter lost per second while draining. */
  decayPerSec: number;
  /** Seconds a frenzy lasts. */
  duration: number;
}

export class FrenzySystem {
  /** 0..1 fill (while active: time left as a fraction). */
  meter = 0;
  active = false;
  private timeLeft = 0;
  private idle = 0;

  constructor(private readonly p: FrenzyParams) {}

  /** Registers a meal. Returns true when this meal starts a frenzy. */
  feed(multiplier = 1): boolean {
    this.idle = 0;
    if (this.active) return false;
    this.meter = Math.min(1, this.meter + this.p.perMeal * multiplier);
    if (this.meter < 1) return false;
    this.active = true;
    this.timeLeft = this.p.duration;
    return true;
  }

  /** Advances time. Returns true on the frame a frenzy ends. */
  update(dt: number): boolean {
    if (this.active) {
      this.timeLeft -= dt;
      this.meter = Math.max(0, this.timeLeft / this.p.duration);
      if (this.timeLeft > 0) return false;
      this.active = false;
      this.meter = 0;
      return true;
    }
    this.idle += dt;
    if (this.idle > this.p.decayDelay) {
      this.meter = Math.max(0, this.meter - this.p.decayPerSec * dt);
    }
    return false;
  }
}
