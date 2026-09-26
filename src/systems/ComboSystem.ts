// Eating in quick succession builds a combo that multiplies score. Pure logic, no Phaser.

export class ComboSystem {
  /** Meals in the current combo (0 = no combo). */
  count = 0;
  private timer = 0;

  constructor(
    private readonly window: number,
    /** Combo counts at which the multiplier becomes x2, x3, ... */
    private readonly thresholds: readonly number[],
  ) {}

  get active(): boolean {
    return this.count > 0 && this.timer > 0;
  }

  get multiplier(): number {
    let m = 1;
    this.thresholds.forEach((t, i) => {
      if (this.count >= t) m = i + 2;
    });
    return m;
  }

  /** 0..1 time left before the combo ends. */
  get remaining(): number {
    return this.active ? this.timer / this.window : 0;
  }

  /** Registers a meal and returns the score multiplier to apply to it. */
  hit(): number {
    this.count = this.timer > 0 ? this.count + 1 : 1;
    this.timer = this.window;
    return this.multiplier;
  }

  /** Advances time. Returns the final count of a combo that just ended, else 0. */
  update(dt: number): number {
    if (this.timer <= 0) return 0;
    this.timer -= dt;
    if (this.timer > 0) return 0;
    const ended = this.count;
    this.count = 0;
    return ended;
  }

  /** Breaks the combo immediately (e.g. when the seal gets hurt). */
  reset(): void {
    this.count = 0;
    this.timer = 0;
  }
}
