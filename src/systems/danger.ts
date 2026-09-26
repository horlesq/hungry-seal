// Difficulty schedule: how many hazards/predators are allowed at a point in the run.
// Pure logic, no Phaser.
import { DANGER } from '../config/balance';
import type { PredatorSpawn } from '../config/predators';
import type { ZoneId } from '../config/zones';

export function hazardsAllowed(elapsed: number): number {
  if (elapsed < DANGER.hazardsStartAt) return 0;
  const minutes = (elapsed - DANGER.hazardsStartAt) / 60;
  return Math.min(
    DANGER.hazardsMax,
    Math.floor(DANGER.hazardsBase + DANGER.hazardsPerMinute * minutes),
  );
}

/** Max alive for one predator kind, given run time and the zone the camera is in. */
export function predatorsAllowed(rule: PredatorSpawn, elapsed: number, viewZone: ZoneId): number {
  if (rule.kind === 'zone') {
    return elapsed >= rule.after && rule.zones.includes(viewZone) ? rule.max : 0;
  }
  let count = 0;
  for (const step of rule.steps) if (elapsed >= step.after) count = step.count;
  return count;
}
