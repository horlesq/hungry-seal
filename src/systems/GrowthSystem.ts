// Growth within a run: eating fills a meter; a full meter advances the seal one stage
// (bigger, faster, higher bite tier). Resets every run. Pure logic, no Phaser.

export class GrowthSystem {
  stage = 1;
  /** Points collected toward the next stage. */
  points = 0;

  /** `stageCosts[i]` = points to go from stage i+1 to i+2. */
  constructor(private readonly stageCosts: readonly number[]) {}

  get maxStage(): number {
    return this.stageCosts.length + 1;
  }

  get isMaxStage(): boolean {
    return this.stage >= this.maxStage;
  }

  /** 0..1 progress toward the next stage (1 at max stage). */
  get progress(): number {
    return this.isMaxStage ? 1 : this.points / this.stageCosts[this.stage - 1];
  }

  /** Points still needed to reach the next stage (0 at max stage). */
  get pointsToNext(): number {
    return this.isMaxStage ? 0 : this.stageCosts[this.stage - 1] - this.points;
  }

  /** Adds growth points. Returns how many stages were gained (usually 0 or 1). */
  add(points: number): number {
    if (this.isMaxStage) return 0;
    this.points += points;
    let gained = 0;
    while (!this.isMaxStage && this.points >= this.stageCosts[this.stage - 1]) {
      this.points -= this.stageCosts[this.stage - 1];
      this.stage++;
      gained++;
    }
    if (this.isMaxStage) this.points = 0;
    return gained;
  }
}
