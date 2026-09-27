// Meta progression rules (pure, no Phaser): what one run achieved, lifetime stats, missions,
// achievements and the local top-runs list. saveData.settleRun applies them when a run ends;
// GameScene uses `completedNow` for mid-run "mission complete" toasts.
import { ACHIEVEMENTS, type AchievementDef } from '../config/achievements';
import {
  ACTIVE_MISSIONS,
  MISSIONS,
  STARTER_MISSIONS,
  missionDef,
  type MissionDef,
} from '../config/missions';

/** What one run achieved. */
export interface RunStats {
  score: number;
  /** Coins collected during the run (mission rewards are separate). */
  coins: number;
  /** Gems found during the run (treasure chests). */
  gems: number;
  seconds: number;
  /** Meters swum. */
  distance: number;
  /** Deepest point, meters. */
  maxDepth: number;
  eaten: number;
  /** Meals by creature/predator id. */
  eatenBy: Record<string, number>;
  chests: number;
  frenzies: number;
  maxStage: number;
  /** How the run ended ('starved', or what dealt the last hit). */
  cause: string;
}

export function emptyRunStats(): RunStats {
  return {
    score: 0,
    coins: 0,
    gems: 0,
    seconds: 0,
    distance: 0,
    maxDepth: 0,
    eaten: 0,
    eatenBy: {},
    chests: 0,
    frenzies: 0,
    maxStage: 1,
    cause: 'starved',
  };
}

/** Totals across every run (bests like score and distance live at the top of the save). */
export interface LifetimeStats {
  eaten: number;
  eatenBy: Record<string, number>;
  /** Coins from runs and mission rewards. */
  coinsEarned: number;
  gemsEarned: number;
  /** Deepest dive, meters. */
  deepest: number;
  /** Longest run, seconds. */
  longestRun: number;
  timePlayed: number;
  chests: number;
  frenzies: number;
  maxStage: number;
  /** Runs ended per cause. */
  deaths: Record<string, number>;
}

export function emptyLifetimeStats(): LifetimeStats {
  return {
    eaten: 0,
    eatenBy: {},
    coinsEarned: 0,
    gemsEarned: 0,
    deepest: 0,
    longestRun: 0,
    timePlayed: 0,
    chests: 0,
    frenzies: 0,
    maxStage: 1,
    deaths: {},
  };
}

function addCounts(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
}

/** Folds a finished run (plus any reward coins/gems) into the lifetime totals. */
export function addRunToStats(
  s: LifetimeStats,
  run: RunStats,
  rewards: { coins: number; gems: number } = { coins: 0, gems: 0 },
): LifetimeStats {
  return {
    eaten: s.eaten + run.eaten,
    eatenBy: addCounts(s.eatenBy, run.eatenBy),
    coinsEarned: s.coinsEarned + run.coins + rewards.coins,
    gemsEarned: s.gemsEarned + run.gems + rewards.gems,
    deepest: Math.max(s.deepest, run.maxDepth),
    longestRun: Math.max(s.longestRun, run.seconds),
    timePlayed: s.timePlayed + run.seconds,
    chests: s.chests + run.chests,
    frenzies: s.frenzies + run.frenzies,
    maxStage: Math.max(s.maxStage, run.maxStage),
    deaths: addCounts(s.deaths, { [run.cause]: 1 }),
  };
}

/** The creature eaten most often, or null before the first meal. */
export function favoriteSnack(s: LifetimeStats): { id: string; count: number } | null {
  let best: { id: string; count: number } | null = null;
  for (const [id, count] of Object.entries(s.eatenBy)) {
    if (!best || count > best.count) best = { id, count };
  }
  return best;
}

// ---------------------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------------------

export interface ActiveMission {
  id: string;
  /** Best single run so far (`run` missions) or the running total (`total` missions). */
  progress: number;
}

/** What a mission measures in one run. */
export function missionValue(def: MissionDef, run: RunStats): number {
  switch (def.metric) {
    case 'eat':
      return run.eaten;
    case 'eatKind':
      return run.eatenBy[def.kind ?? ''] ?? 0;
    case 'score':
      return run.score;
    case 'survive':
      return Math.floor(run.seconds);
    case 'coins':
      return run.coins;
    case 'depth':
      return Math.floor(run.maxDepth);
    case 'stage':
      return run.maxStage;
    case 'chests':
      return run.chests;
    case 'frenzies':
      return run.frenzies;
  }
}

/** Stored progress after (or during) a run. */
export function missionProgress(def: MissionDef, stored: number, run: RunStats): number {
  const value = missionValue(def, run);
  const next = def.scope === 'total' ? stored + value : Math.max(stored, value);
  return Math.min(def.target, next);
}

/** Ids of active missions that the run in progress has completed. */
export function completedNow(active: readonly ActiveMission[], run: RunStats): string[] {
  const done: string[] = [];
  for (const a of active) {
    const def = missionDef(a.id);
    if (def && missionProgress(def, a.progress, run) >= def.target) done.push(a.id);
  }
  return done;
}

/** A random mission not in `exclude` (null only if the pool is exhausted). */
export function pickMission(exclude: readonly string[], random: () => number): string | null {
  const pool = MISSIONS.filter((m) => !exclude.includes(m.id));
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))].id;
}

export function starterMissions(): ActiveMission[] {
  return STARTER_MISSIONS.slice(0, ACTIVE_MISSIONS).map((id) => ({ id, progress: 0 }));
}

export interface MissionSettlement {
  active: ActiveMission[];
  completed: MissionDef[];
  coins: number;
  gems: number;
}

/** Applies a finished run: updates progress, pays and replaces completed missions. */
export function settleMissions(
  active: readonly ActiveMission[],
  run: RunStats,
  random: () => number,
): MissionSettlement {
  const completed: MissionDef[] = [];
  const kept: ActiveMission[] = [];
  for (const a of active) {
    const def = missionDef(a.id);
    if (!def) continue;
    const progress = missionProgress(def, a.progress, run);
    if (progress >= def.target) completed.push(def);
    else kept.push({ id: a.id, progress });
  }
  // Replacements: never a mission that's active or was just completed.
  const exclude = [...kept.map((m) => m.id), ...completed.map((m) => m.id)];
  while (kept.length < ACTIVE_MISSIONS) {
    const id = pickMission(exclude, random);
    if (!id) break;
    kept.push({ id, progress: 0 });
    exclude.push(id);
  }
  return {
    active: kept,
    completed,
    coins: completed.reduce((sum, m) => sum + m.coins, 0),
    gems: completed.reduce((sum, m) => sum + (m.gems ?? 0), 0),
  };
}

// ---------------------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------------------

export function achievementValue(def: AchievementDef, s: LifetimeStats): number {
  switch (def.metric) {
    case 'eaten':
      return s.eaten;
    case 'eatKind':
      return s.eatenBy[def.kind ?? ''] ?? 0;
    case 'deepest':
      return s.deepest;
    case 'maxStage':
      return s.maxStage;
    case 'chests':
      return s.chests;
    case 'frenzies':
      return s.frenzies;
    case 'longestRun':
      return s.longestRun;
    case 'coinsEarned':
      return s.coinsEarned;
  }
}

/** Achievements the stats now satisfy that weren't unlocked before. */
export function newAchievements(s: LifetimeStats, unlocked: readonly string[]): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.includes(a.id) && achievementValue(a, s) >= a.target);
}

// ---------------------------------------------------------------------------------------
// Top runs (local leaderboard)
// ---------------------------------------------------------------------------------------

export const TOP_RUNS = 5;

export interface TopRun {
  score: number;
  seconds: number;
  stage: number;
  distance: number;
  skin: string;
  /** YYYY-MM-DD. */
  date: string;
}

/** Inserts a run by score (ties go below older runs). Rank is 1-based, or null if it missed. */
export function addTopRun(
  list: readonly TopRun[],
  run: TopRun,
): { list: TopRun[]; rank: number | null } {
  if (run.score <= 0) return { list: [...list], rank: null };
  let i = list.findIndex((r) => r.score < run.score);
  if (i < 0) i = list.length;
  if (i >= TOP_RUNS) return { list: [...list], rank: null };
  const next = [...list.slice(0, i), run, ...list.slice(i)].slice(0, TOP_RUNS);
  return { list: next, rank: i + 1 };
}
