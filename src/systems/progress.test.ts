import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../config/achievements';
import { ACTIVE_MISSIONS, MISSIONS } from '../config/missions';
import {
  addRunToStats,
  addTopRun,
  completedNow,
  emptyLifetimeStats,
  emptyRunStats,
  favoriteSnack,
  missionProgress,
  newAchievements,
  settleMissions,
  starterMissions,
  type RunStats,
  type TopRun,
} from './progress';

const run = (over: Partial<RunStats>): RunStats => ({ ...emptyRunStats(), ...over });
const def = (id: string) => MISSIONS.find((m) => m.id === id)!;
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('missions', () => {
  it('config ids are unique and targets positive', () => {
    const ids = MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(MISSIONS.every((m) => m.target > 0 && m.coins > 0)).toBe(true);
    expect(starterMissions()).toHaveLength(ACTIVE_MISSIONS);
  });

  it('single-run missions keep the best run; total missions add up', () => {
    expect(missionProgress(def('eat-20'), 12, run({ eaten: 8 }))).toBe(12);
    expect(missionProgress(def('eat-20'), 12, run({ eaten: 15 }))).toBe(15);
    expect(missionProgress(def('total-eat-200'), 150, run({ eaten: 30 }))).toBe(180);
    // Capped at the target.
    expect(missionProgress(def('total-eat-200'), 190, run({ eaten: 30 }))).toBe(200);
  });

  it('counts a specific creature for eatKind missions', () => {
    const r = run({ eatenBy: { penguin: 3, minnow: 20 } });
    expect(missionProgress(def('penguin-3'), 0, r)).toBe(3);
    expect(missionProgress(def('squid-4'), 0, r)).toBe(0);
  });

  it('spots missions completed during a run (for toasts)', () => {
    const active = [
      { id: 'eat-20', progress: 0 },
      { id: 'total-chests-3', progress: 2 },
      { id: 'score-8000', progress: 0 },
    ];
    expect(completedNow(active, run({ eaten: 21, chests: 1, score: 100 }))).toEqual([
      'eat-20',
      'total-chests-3',
    ]);
  });

  it('pays and replaces completed missions with new, different ones', () => {
    const active = [
      { id: 'eat-20', progress: 0 },
      { id: 'score-2000', progress: 500 },
      { id: 'seabird-2', progress: 1 },
    ];
    const r = run({ eaten: 25, score: 900, eatenBy: { seabird: 2 } });
    const s = settleMissions(active, r, seq(0, 0.5, 0.99));
    expect(s.completed.map((m) => m.id)).toEqual(['eat-20', 'seabird-2']);
    expect(s.coins).toBe(def('eat-20').coins + def('seabird-2').coins);
    expect(s.active).toHaveLength(ACTIVE_MISSIONS);
    expect(s.active[0]).toEqual({ id: 'score-2000', progress: 900 });
    const ids = s.active.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain('eat-20');
    expect(ids).not.toContain('seabird-2');
  });
});

describe('lifetime stats and achievements', () => {
  it('adds runs up and tracks bests and deaths', () => {
    let s = emptyLifetimeStats();
    s = addRunToStats(s, run({ eaten: 10, eatenBy: { minnow: 10 }, seconds: 60, maxDepth: 120 }));
    s = addRunToStats(
      s,
      run({
        eaten: 5,
        eatenBy: { minnow: 2, shark: 1 },
        seconds: 90,
        maxDepth: 80,
        cause: 'shark',
      }),
      { coins: 100, gems: 1 },
    );
    expect(s.eaten).toBe(15);
    expect(s.eatenBy).toEqual({ minnow: 12, shark: 1 });
    expect(s.longestRun).toBe(90);
    expect(s.timePlayed).toBe(150);
    expect(s.deepest).toBe(120);
    expect(s.coinsEarned).toBe(100);
    expect(s.gemsEarned).toBe(1);
    expect(s.deaths).toEqual({ starved: 1, shark: 1 });
    expect(favoriteSnack(s)).toEqual({ id: 'minnow', count: 12 });
  });

  it('unlocks achievements once', () => {
    const s = { ...emptyLifetimeStats(), eaten: 3, eatenBy: { shark: 1 }, deepest: 450 };
    const first = newAchievements(s, []).map((a) => a.id);
    expect(first).toEqual(['first-bite', 'abyss-diver', 'shark-snack']);
    expect(newAchievements(s, first)).toEqual([]);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});

describe('top runs', () => {
  const entry = (score: number): TopRun => ({
    score,
    seconds: 60,
    stage: 2,
    distance: 100,
    skin: 'harbor',
    date: '2026-09-28',
  });

  it('keeps the best five, highest first, and reports the rank', () => {
    let list: TopRun[] = [];
    for (const score of [500, 900, 100, 700, 300]) list = addTopRun(list, entry(score)).list;
    expect(list.map((r) => r.score)).toEqual([900, 700, 500, 300, 100]);
    const second = addTopRun(list, entry(800));
    expect(second.rank).toBe(2);
    expect(second.list.map((r) => r.score)).toEqual([900, 800, 700, 500, 300]);
    expect(addTopRun(second.list, entry(50)).rank).toBeNull();
    expect(addTopRun([], entry(0)).rank).toBeNull();
  });
});
