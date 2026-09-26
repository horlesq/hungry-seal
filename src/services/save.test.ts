import { describe, expect, it } from 'vitest';
import { defaultSave, migrateSave, recordRun } from './saveData';
import { SaveService } from './SaveService';

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

  it('survives corrupt JSON and missing storage', () => {
    const storage = new MemoryStorage();
    storage.setItem('hungry-seal-save', '{not json');
    expect(new SaveService(storage).data).toEqual(defaultSave());
    const noStorage = new SaveService(null);
    expect(noStorage.recordRun({ score: 1, coins: 1, distance: 1 }).data.coins).toBe(1);
  });
});
