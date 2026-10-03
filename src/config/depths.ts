// Draw order of world layers that must stack predictably across systems.
export const Depths = {
  /** Decorations behind the creatures (coral, rocks, wrecks). */
  DecorBack: 4,
  /** The map's rock: behind everything that moves, so a seal pressed to a wall stays visible. */
  Terrain: 7,
  /** Rock, coral and ice clusters set into the terrain's edge (over the rock, under creatures). */
  TerrainEdge: 7.5,
  /** Rock around the water line, redrawn over the front water line so it doesn't cross islands. */
  TerrainOverWater: 21,
  /** Foreground decorations (kelp in front of the seal). */
  DecorFront: 22,
  /** Deep-water darkness overlay (above creatures, below glows and floating text). */
  Darkness: 25,
  /** Glowing spots (lures, lanternfish, hazard lights) that show through the darkness. */
  Glow: 26,
} as const;
