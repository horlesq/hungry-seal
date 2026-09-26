// Turns upgrade levels into run modifiers and handles purchase rules. Pure logic, no Phaser.
import { UPGRADE_EFFECTS, UPGRADE_IDS, upgradeDef, type UpgradeId } from '../config/upgrades';

export type UpgradeLevels = Record<UpgradeId, number>;

export interface RunModifiers {
  /** Multiplier on the seal's top speed. */
  speedMult: number;
  /** Added to max hunger. */
  extraHunger: number;
  /** Multiplier on hunger drain (< 1 = slower). */
  drainMult: number;
  /** Multiplier on boost stamina drain (< 1 = lasts longer). */
  boostDrainMult: number;
  /** Multiplier on boost stamina regen (> 1 = refills faster). */
  boostRegenMult: number;
  /** Multiplier on growth points per meal. */
  growthMult: number;
  /** Multiplier on the coin magnet radius. */
  magnetMult: number;
  /** Multiplier on frenzy meter gain per meal. */
  frenzyChargeMult: number;
}

export function emptyUpgrades(): UpgradeLevels {
  return { speed: 0, belly: 0, metabolism: 0, boost: 0, jaws: 0, magnet: 0, frenzy: 0 };
}

export function runModifiers(levels: UpgradeLevels): RunModifiers {
  const e = UPGRADE_EFFECTS;
  return {
    speedMult: 1 + levels.speed * e.speedPerLevel,
    extraHunger: levels.belly * e.bellyPerLevel,
    drainMult: Math.max(0.2, 1 - levels.metabolism * e.metabolismPerLevel),
    boostDrainMult: 1 / (1 + levels.boost * e.boostPerLevel),
    boostRegenMult: 1 + levels.boost * e.boostPerLevel,
    growthMult: 1 + levels.jaws * e.jawsPerLevel,
    magnetMult: 1 + levels.magnet * e.magnetPerLevel,
    frenzyChargeMult: 1 + levels.frenzy * e.frenzyPerLevel,
  };
}

export function maxLevel(id: UpgradeId): number {
  return upgradeDef(id).costs.length;
}

/** Cost of the next level, or null when maxed. */
export function nextCost(id: UpgradeId, level: number): number | null {
  const costs = upgradeDef(id).costs;
  return level < costs.length ? costs[level] : null;
}

/** Whether any upgrade's next level is affordable (the "something to buy" badge). */
export function anyAffordable(levels: UpgradeLevels, coins: number): boolean {
  return UPGRADE_IDS.some((id) => {
    const cost = nextCost(id, levels[id]);
    return cost !== null && coins >= cost;
  });
}

export type BuyResult =
  { ok: true; levels: UpgradeLevels; coins: number } | { ok: false; reason: 'maxed' | 'poor' };

export function buyUpgrade(levels: UpgradeLevels, coins: number, id: UpgradeId): BuyResult {
  const cost = nextCost(id, levels[id]);
  if (cost === null) return { ok: false, reason: 'maxed' };
  if (coins < cost) return { ok: false, reason: 'poor' };
  return { ok: true, levels: { ...levels, [id]: levels[id] + 1 }, coins: coins - cost };
}
