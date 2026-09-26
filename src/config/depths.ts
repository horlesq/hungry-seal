// Draw order of world layers that must stack predictably across systems.
export const Depths = {
  /** Deep-water darkness overlay (above creatures, below glows and floating text). */
  Darkness: 25,
  /** Glowing spots (lures, lanternfish, hazard lights) that show through the darkness. */
  Glow: 26,
} as const;
