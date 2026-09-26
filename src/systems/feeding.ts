// Bite rules and contact tests. Pure logic, no Phaser.

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
