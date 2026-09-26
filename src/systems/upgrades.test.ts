import { describe, expect, it } from 'vitest';
import { UPGRADE_EFFECTS } from '../config/upgrades';
import { buyUpgrade, emptyUpgrades, maxLevel, nextCost, runModifiers } from './UpgradeSystem';

describe('UpgradeSystem', () => {
  it('has no effect at level 0', () => {
    expect(runModifiers(emptyUpgrades())).toEqual({
      speedMult: 1,
      extraHunger: 0,
      drainMult: 1,
      boostDrainMult: 1,
      boostRegenMult: 1,
      growthMult: 1,
      magnetMult: 1,
      frenzyChargeMult: 1,
    });
  });

  it('scales effects with level', () => {
    const m = runModifiers({
      speed: 2,
      belly: 3,
      metabolism: 1,
      boost: 1,
      jaws: 2,
      magnet: 1,
      frenzy: 3,
    });
    expect(m.growthMult).toBeCloseTo(1 + 2 * UPGRADE_EFFECTS.jawsPerLevel);
    expect(m.magnetMult).toBeGreaterThan(1);
    expect(m.frenzyChargeMult).toBeCloseTo(1 + 3 * UPGRADE_EFFECTS.frenzyPerLevel);
    expect(m.speedMult).toBeCloseTo(1 + 2 * UPGRADE_EFFECTS.speedPerLevel);
    expect(m.extraHunger).toBe(3 * UPGRADE_EFFECTS.bellyPerLevel);
    expect(m.drainMult).toBeLessThan(1);
    expect(m.boostDrainMult).toBeLessThan(1);
    expect(m.boostRegenMult).toBeGreaterThan(1);
  });

  it('charges the next level cost and stops at max level', () => {
    const first = buyUpgrade(emptyUpgrades(), 1000, 'speed');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.levels.speed).toBe(1);
    expect(first.coins).toBe(1000 - nextCost('speed', 0)!);

    const maxed = { ...emptyUpgrades(), speed: maxLevel('speed') };
    expect(buyUpgrade(maxed, 99999, 'speed')).toEqual({ ok: false, reason: 'maxed' });
    expect(nextCost('speed', maxLevel('speed'))).toBeNull();
  });

  it('refuses purchases you cannot afford', () => {
    expect(buyUpgrade(emptyUpgrades(), 1, 'belly')).toEqual({ ok: false, reason: 'poor' });
  });
});
