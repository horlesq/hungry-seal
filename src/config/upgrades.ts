// Permanent upgrades bought with coins in the shop. Effects are applied at the start of each
// run by systems/UpgradeSystem.ts.

export type UpgradeId = 'speed' | 'belly' | 'metabolism' | 'boost';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  description: string;
  /** Coin cost of each level (index 0 = buying level 1). Length = max level. */
  costs: readonly number[];
  /** Short text describing the total effect at a level, e.g. "+12% speed". */
  effect: (level: number) => string;
}

export const UPGRADE_EFFECTS = {
  /** Top speed per level. */
  speedPerLevel: 0.04,
  /** Max hunger per level. */
  bellyPerLevel: 12,
  /** Hunger drain reduction per level. */
  metabolismPerLevel: 0.07,
  /** Boost stamina lasts longer and refills faster per level. */
  boostPerLevel: 0.18,
} as const;

const COSTS = [60, 150, 300, 550, 900] as const;

export const UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'speed',
    name: 'Flippers',
    description: 'Swim faster',
    costs: COSTS,
    effect: (l) => `+${Math.round(l * UPGRADE_EFFECTS.speedPerLevel * 100)}% speed`,
  },
  {
    id: 'belly',
    name: 'Big Belly',
    description: 'More hunger to burn',
    costs: COSTS,
    effect: (l) => `+${l * UPGRADE_EFFECTS.bellyPerLevel} max hunger`,
  },
  {
    id: 'metabolism',
    name: 'Blubber',
    description: 'Get hungry slower',
    costs: COSTS,
    effect: (l) => `-${Math.round(l * UPGRADE_EFFECTS.metabolismPerLevel * 100)}% hunger drain`,
  },
  {
    id: 'boost',
    name: 'Turbo Tail',
    description: 'Longer, faster-refilling boost',
    costs: COSTS,
    effect: (l) => `+${Math.round(l * UPGRADE_EFFECTS.boostPerLevel * 100)}% boost`,
  },
];

export const UPGRADE_IDS: readonly UpgradeId[] = UPGRADES.map((u) => u.id);

export function upgradeDef(id: UpgradeId): UpgradeDef {
  return UPGRADES.find((u) => u.id === id)!;
}
