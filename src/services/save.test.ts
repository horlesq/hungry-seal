import { describe, expect, it } from 'vitest';
import { defaultSave, migrateSave, purchase, recordRun } from './saveData';
import { SaveService } from './SaveService';
import { emptyUpgrades } from '../systems/UpgradeSystem';

class MemoryStorage {
  store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe('save data', () => {
  it('falls back to defaults for garbage', () => {
    expect(migrateSave(null)).toEqual(defaultSave());
    expect(migrateSave('nope')).toEqual(defaultSave());
    expect(migrateSave({ coins: -5, bestScore: 'x', runs: NaN })).toEqual(defaultSave());
  });

  it('keeps valid fields', () => {
    const s = migrateSave({ version: 1, coins: 42, bestScore: 900, settings: { muted: true } });
    expect(s.coins).toBe(42);
    expect(s.bestScore).toBe(900);
    expect(s.settings.muted).toBe(true);
  });

  it('migrates a v1 save: keeps progress, adds upgrades, skips the tutorial for veterans', () => {
    const s = migrateSave({ version: 1, coins: 80, bestScore: 900, runs: 3 });
    expect(s.version).toBe(2);
    expect(s.coins).toBe(80);
    expect(s.upgrades).toEqual(emptyUpgrades());
    expect(s.tutorialDone).toBe(true);
    expect(migrateSave({ version: 1, runs: 0 }).tutorialDone).toBe(false);
  });

  it('clamps corrupt upgrade levels', () => {
    const s = migrateSave({ upgrades: { speed: 99, belly: -2, metabolism: 'x', boost: 2.7 } });
    expect(s.upgrades).toEqual({ ...emptyUpgrades(), speed: 5, belly: 0, metabolism: 0, boost: 2 });
  });

  it('buys upgrades with banked coins', () => {
    const rich = { ...defaultSave(), coins: 100 };
    const after = purchase(rich, 'speed');
    expect(after?.upgrades.speed).toBe(1);
    expect(after?.coins).toBe(40);
    expect(purchase({ ...defaultSave(), coins: 10 }, 'speed')).toBeNull();
  });

  it('records a run: banks coins, tracks bests', () => {
    const first = recordRun(defaultSave(), { score: 500, coins: 7, distance: 120.6 });
    expect(first.newBest).toBe(true);
    expect(first.data).toMatchObject({ coins: 7, bestScore: 500, bestDistance: 120, runs: 1 });
    const second = recordRun(first.data, { score: 300, coins: 3, distance: 50 });
    expect(second.newBest).toBe(false);
    expect(second.data).toMatchObject({ coins: 10, bestScore: 500, runs: 2 });
  });
});

describe('SaveService', () => {
  it('persists runs and reloads them', () => {
    const storage = new MemoryStorage();
    const a = new SaveService(storage);
    a.recordRun({ score: 250, coins: 4, distance: 80 });
    const b = new SaveService(storage);
    expect(b.data.coins).toBe(4);
    expect(b.data.bestScore).toBe(250);
  });

  it('persists purchases, mute and tutorial state', () => {
    const storage = new MemoryStorage();
    const a = new SaveService(storage);
    a.recordRun({ score: 10, coins: 200, distance: 1 });
    expect(a.buyUpgrade('belly')).toBe(true);
    a.setMuted(true);
    a.completeTutorial();
    const b = new SaveService(storage);
    expect(b.data.upgrades.belly).toBe(1);
    expect(b.data.coins).toBe(140);
    expect(b.data.settings.muted).toBe(true);
    expect(b.data.tutorialDone).toBe(true);
  });

  it('survives corrupt JSON and missing storage', () => {
    const storage = new MemoryStorage();
    storage.setItem('hungry-seal-save', '{not json');
    expect(new SaveService(storage).data).toEqual(defaultSave());
    const noStorage = new SaveService(null);
    expect(noStorage.recordRun({ score: 1, coins: 1, distance: 1 }).data.coins).toBe(1);
  });
});
