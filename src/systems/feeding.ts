// Bite rules and contact tests. Pure logic, no Phaser.
import { FEEDING, GROWTH } from '../config/balance';

/** The seal can eat anything whose tier is at or below its growth stage. */
export function canEat(sealStage: number, preyTier: number): boolean {
  return sealStage >= preyTier;
}

export function circlesOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

/**
 * How much farther a seal of `stage` reaches with its mouth than a size-1 seal (0 at size 1).
 * Frenzy's oversized bite stage counts as full size.
 */
export function extraReach(stage: number): number {
  const i = Math.min(Math.max(stage, 1), GROWTH.stages.length) - 1;
  const reach = FEEDING.mouthOffset + FEEDING.mouthRadius;
  return reach * (GROWTH.stages[i].scale - GROWTH.stages[0].scale);
}
