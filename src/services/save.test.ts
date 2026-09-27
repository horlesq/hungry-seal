import { describe, expect, it } from 'vitest';
import { STARTER_MISSIONS } from '../config/missions';
import { emptyLifetimeStats, emptyRunStats, type RunStats } from '../systems/progress';
import { emptyUpgrades } from '../systems/UpgradeSystem';
import {
  defaultSave,
  equipSkin,
  migrateSave,
  purchase,
  purchaseSkin,
  settleRun,
  type SaveData,
} from './saveData';
import { SaveService } from './SaveService';

const runOf = (over: Partial<RunStats>): RunStats => ({ ...emptyRunStats(), ...over });
const settle = (data: SaveData, over: Partial<RunStats>) =>
  settleRun(data, runOf(over), { random: () => 0.5, date: '2026-09-28' });

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

  it('gives old saves the default skin and drops unknown or unowned skins', () => {
    expect(migrateSave({ version: 2, coins: 10 }).skins).toEqual({
      owned: ['harbor'],
      equipped: 'harbor',
    });
    const s = migrateSave({ skins: { owned: ['walrus', 'unicorn'], equipped: 'arctic' } });
    expect(s.skins.owned).toEqual(['harbor', 'walrus']);
    expect(s.skins.equipped).toBe('harbor');
  });

  it('buys a skin once, wears it, and can switch back', () => {
    const rich = { ...defaultSave(), coins: 1000 };
    const bought = purchaseSkin(rich, 'arctic');
    expect(bought?.coins).toBe(700);
    expect(bought?.skins).toEqual({ owned: ['harbor', 'arctic'], equipped: 'arctic' });
    expect(purchaseSkin(bought!, 'arctic')).toBeNull();
    expect(purchaseSkin(defaultSave(), 'walrus')).toBeNull();
    expect(equipSkin(bought!, 'harbor')?.skins.equipped).toBe('harbor');
    expect(equipSkin(bought!, 'walrus')).toBeNull();
  });

  it('keeps valid fields', () => {
    const s = migrateSave({ version: 1, coins: 42, bestScore: 900, settings: { muted: true } });
    expect(s.coins).toBe(42);
    expect(s.bestScore).toBe(900);
    expect(s.settings.muted).toBe(true);
  });

  it('migrates a v1 save: keeps progress, adds upgrades, skips the tutorial for veterans', () => {
    const s = migrateSave({ version: 1, coins: 80, bestScore: 900, runs: 3 });
    expect(s.version).toBe(4);
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
    const first = settle(defaultSave(), { score: 500, coins: 7, distance: 120.6 });
    expect(first.newBest).toBe(true);
    expect(first.data).toMatchObject({ coins: 7, bestScore: 500, bestDistance: 121, runs: 1 });
    const second = settle(first.data, { score: 300, coins: 3, distance: 50 });
    expect(second.newBest).toBe(false);
    expect(second.data).toMatchObject({ coins: 10, bestScore: 500, runs: 2 });
  });

  it('migrates a v3 save: progression starts fresh, everything else kept', () => {
    const s = migrateSave({
      version: 3,
      coins: 300,
      runs: 5,
      skins: { owned: ['harbor', 'walrus'], equipped: 'walrus' },
    });
    expect(s).toMatchObject({ version: 4, coins: 300, gems: 0, runs: 5, achievements: [] });
    expect(s.skins.equipped).toBe('walrus');
    expect(s.stats).toEqual(emptyLifetimeStats());
    expect(s.missions.active.map((m) => m.id)).toEqual(STARTER_MISSIONS);
    expect(s.topRuns).toEqual([]);
  });

  it('cleans up corrupt progression data', () => {
    const s = migrateSave({
      gems: -3,
      missions: {
        active: [
          { id: 'eat-20', progress: 999 },
          { id: 'eat-20', progress: 1 },
          { id: 'not-a-mission', progress: 5 },
        ],
        completed: 'x',
      },
      achievements: ['shark-snack', 'made-up', 'shark-snack'],
      topRuns: [{ score: 10 }, { score: 'x' }, { score: 90, skin: 'walrus' }, null],
      stats: { eaten: 12, eatenBy: { minnow: 12, bad: -4 }, deaths: 'nope' },
    });
    expect(s.gems).toBe(0);
    expect(s.missions.active).toHaveLength(3);
    expect(s.missions.active[0]).toEqual({ id: 'eat-20', progress: 20 });
    expect(new Set(s.missions.active.map((m) => m.id)).size).toBe(3);
    expect(s.missions.completed).toBe(0);
    expect(s.achievements).toEqual(['shark-snack']);
    expect(s.topRuns.map((r) => r.score)).toEqual([90, 10]);
    expect(s.stats.eatenBy).toEqual({ minnow: 12 });
    expect(s.stats.deaths).toEqual({});
  });

  it('pays missions and achievements, and places the run on the top list', () => {
    const r = settle(defaultSave(), { score: 800, eaten: 25, eatenBy: { minnow: 25 }, coins: 5 });
    // 'Eat 20 fish in one run' (a starter) is done; 'First Bite' unlocks.
    expect(r.missions.map((m) => m.id)).toEqual(['eat-20']);
    expect(r.achievements.map((a) => a.id)).toEqual(['first-bite']);
    expect(r.rewardCoins).toBe(r.missions[0].coins);
    expect(r.data.coins).toBe(5 + r.rewardCoins);
    expect(r.data.gems).toBe(r.rewardGems);
    expect(r.data.missions.completed).toBe(1);
    expect(r.data.missions.active.map((m) => m.id)).not.toContain('eat-20');
    expect(r.data.achievements).toEqual(['first-bite']);
    expect(r.rank).toBe(1);
    expect(r.data.topRuns[0]).toMatchObject({ score: 800, skin: 'harbor', date: '2026-09-28' });
    expect(r.data.stats.eaten).toBe(25);
    // Nothing is paid twice.
    const again = settle(r.data, { score: 10, eaten: 1 });
    expect(again.achievements).toEqual([]);
  });

  it('buys premium skins with gems, not coins', () => {
    const coinsOnly = { ...defaultSave(), coins: 99999 };
    expect(purchaseSkin(coinsOnly, 'golden')).toBeNull();
    const withGems = purchaseSkin({ ...defaultSave(), gems: 25 }, 'golden');
    expect(withGems?.gems).toBe(5);
    expect(withGems?.skins.equipped).toBe('golden');
  });
});

describe('SaveService', () => {
  it('persists runs and reloads them', () => {
    const storage = new MemoryStorage();
    const a = new SaveService(storage);
    a.recordRun(runOf({ score: 250, coins: 4, distance: 80 }));
    const b = new SaveService(storage);
    expect(b.data.coins).toBe(4);
    expect(b.data.bestScore).toBe(250);
  });

  it('persists purchases, mute and tutorial state', () => {
    const storage = new MemoryStorage();
    const a = new SaveService(storage);
    a.recordRun(runOf({ score: 10, coins: 200, distance: 1 }));
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
    expect(noStorage.recordRun(runOf({ score: 1, coins: 1, distance: 1 })).data.coins).toBe(1);
  });
});
