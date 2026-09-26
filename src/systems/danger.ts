// Difficulty schedule: how many hazards/predators are allowed at a point in the run.
// Pure logic, no Phaser.
import { DANGER } from '../config/balance';

export function hazardsAllowed(elapsed: number): number {
  if (elapsed < DANGER.hazardsStartAt) return 0;
  const minutes = (elapsed - DANGER.hazardsStartAt) / 60;
  return Math.min(
    DANGER.hazardsMax,
    Math.floor(DANGER.hazardsBase + DANGER.hazardsPerMinute * minutes),
  );
}

export function predatorsAllowed(elapsed: number): number {
  let count = 0;
  for (const step of DANGER.predatorSchedule) if (elapsed >= step.after) count = step.count;
  return count;
}
