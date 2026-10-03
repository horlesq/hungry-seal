// Persistent save data: schema, defaults, validation/migration and pure update helpers.
// No storage access here (SaveService does the I/O) so it can be unit tested.
import { ACHIEVEMENTS, type AchievementDef } from '../config/achievements';
import { MAP_ORDER, MAPS, type MapId } from '../config/maps';
import { ACTIVE_MISSIONS, MISSIONS, STARTER_MISSIONS, type MissionDef } from '../config/missions';
import { DEFAULT_SKIN, SKIN_IDS, skinDef, type SkinId } from '../config/skins';
import { UPGRADE_IDS, type UpgradeId } from '../config/upgrades';
import {
  addRunToStats,
  addTopRun,
  emptyLifetimeStats,
  newAchievements,
  settleMissions,
  starterMissions,
  TOP_RUNS,
  type ActiveMission,
  type LifetimeStats,
  type RunStats,
  type TopRun,
} from '../systems/progress';
import {
  buyUpgrade as buy,
  emptyUpgrades,
  maxLevel,
  type UpgradeLevels,
} from '../systems/UpgradeSystem';

export const SAVE_VERSION = 6;

export interface SaveData {
  version: typeof SAVE_VERSION;
  /** Coins banked across runs, spent on upgrades and skins. */
  coins: number;
  /** Rare currency (chests, missions, achievements), spent on premium skins. */
  gems: number;
  bestScore: number;
  /** Best distance swum in one run, meters. */
  bestDistance: number;
  runs: number;
  upgrades: UpgradeLevels;
  /** Cosmetic seal skins: bought ones (always including the default) and the one worn. */
  skins: { owned: SkinId[]; equipped: SkinId };
  stats: LifetimeStats;
  /** The three active missions, and how many have been completed ever. */
  missions: { active: ActiveMission[]; completed: number };
  /** Unlocked achievement ids. */
  achievements: string[];
  /** Best five runs, highest score first. */
  topRuns: TopRun[];
  /** First-run hints have been shown. */
  tutorialDone: boolean;
  /** The map to play, and the best score on each map (v5). */
  maps: {
    selected: MapId;
    best: Partial<Record<MapId, number>>;
    /** Pearls found on each map (indexes into the map's pearl list) (v6). */
    pearls: Partial<Record<MapId, number[]>>;
    /** Maps whose boss has been beaten (v6). */
    bosses: MapId[];
  };
  settings: Settings;
}

export interface Settings {
  muted: boolean;
  /** 0..1 */
  music: number;
  sfx: number;
  /** Camera shake on hits and big bites. */
  shake: boolean;
  /** Warnings ("!", hazards) get extra shape cues and high-contrast colors. */
  highContrast: boolean;
}

export function defaultSettings(): Settings {
  return { muted: false, music: 0.6, sfx: 0.8, shake: true, highContrast: false };
}

/** A map is open once the best score (any map) reaches its unlock score. */
/** A map opens after enough pearls on the map before it (or, for older saves, a best score). */
export function isMapUnlocked(data: SaveData, id: MapId): boolean {
  const u = MAPS[id].unlock;
  if (!u) return true;
  return pearlsFound(data, u.after) >= u.pearls || data.bestScore >= u.score;
}

export function pearlsFound(data: SaveData, id: MapId): number {
  return data.maps.pearls[id]?.length ?? 0;
}

/** Map mastered: every pearl found and the boss beaten. */
export function isMapMastered(data: SaveData, id: MapId): boolean {
  return pearlsFound(data, id) >= MAPS[id].pearls.length && data.maps.bosses.includes(id);
}

/**
 * Records a pearl. Returns the new data and the maps it unlocked, or null if it was already
 * found (or doesn't exist).
 */
export function collectPearl(
  data: SaveData,
  id: MapId,
  index: number,
): { data: SaveData; unlocked: MapId[] } | null {
  const found = data.maps.pearls[id] ?? [];
  if (found.includes(index) || index < 0 || index >= MAPS[id].pearls.length) return null;
  const next: SaveData = {
    ...data,
    maps: { ...data.maps, pearls: { ...data.maps.pearls, [id]: [...found, index].sort() } },
  };
  return { data: next, unlocked: newlyUnlocked(data, next) };
}

/** Records a boss win. Returns null if it was already beaten on this map. */
export function defeatBoss(data: SaveData, id: MapId): SaveData | null {
  if (data.maps.bosses.includes(id)) return null;
  return { ...data, maps: { ...data.maps, bosses: [...data.maps.bosses, id] } };
}

function newlyUnlocked(before: SaveData, after: SaveData): MapId[] {
  return MAP_ORDER.filter((m) => !isMapUnlocked(before, m) && isMapUnlocked(after, m));
}

/** Selects a map if it's unlocked. Returns null if not possible. */
export function selectMap(data: SaveData, id: MapId): SaveData | null {
  if (!isMapUnlocked(data, id)) return null;
  return { ...data, maps: { ...data.maps, selected: id } };
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    coins: 0,
    gems: 0,
    bestScore: 0,
    bestDistance: 0,
    runs: 0,
    upgrades: emptyUpgrades(),
    skins: { owned: [DEFAULT_SKIN], equipped: DEFAULT_SKIN },
    stats: emptyLifetimeStats(),
    missions: { active: starterMissions(), completed: 0 },
    achievements: [],
    topRuns: [],
    tutorialDone: false,
    maps: { selected: 'bay', best: {}, pearls: {}, bosses: [] },
    settings: defaultSettings(),
  };
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function counts(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(record(value) ?? {})) {
    const n = count(v);
    if (n > 0) out[k] = n;
  }
  return out;
}

function migrateStats(raw: unknown): LifetimeStats {
  const r = record(raw) ?? {};
  const s = emptyLifetimeStats();
  return {
    eaten: count(r.eaten),
    eatenBy: counts(r.eatenBy),
    coinsEarned: count(r.coinsEarned),
    gemsEarned: count(r.gemsEarned),
    deepest: count(r.deepest),
    longestRun: count(r.longestRun),
    timePlayed: count(r.timePlayed),
    chests: count(r.chests),
    frenzies: count(r.frenzies),
    maxStage: Math.max(s.maxStage, count(r.maxStage)),
    deaths: counts(r.deaths),
  };
}

/** Known, distinct missions with progress clamped to the target, topped up to three. */
function migrateMissions(raw: unknown): { active: ActiveMission[]; completed: number } {
  const r = record(raw) ?? {};
  const active: ActiveMission[] = [];
  for (const m of Array.isArray(r.active) ? r.active : []) {
    const entry = record(m);
    const def = MISSIONS.find((d) => d.id === entry?.id);
    if (!def || active.some((a) => a.id === def.id)) continue;
    active.push({ id: def.id, progress: Math.min(def.target, count(entry?.progress)) });
    if (active.length === ACTIVE_MISSIONS) break;
  }
  // Deterministic top-up: starters first, then the pool in order.
  for (const id of [...STARTER_MISSIONS, ...MISSIONS.map((m) => m.id)]) {
    if (active.length >= ACTIVE_MISSIONS) break;
    if (!active.some((a) => a.id === id)) active.push({ id, progress: 0 });
  }
  return { active, completed: count(r.completed) };
}

function migrateTopRuns(raw: unknown): TopRun[] {
  const runs: TopRun[] = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const r = record(item);
    if (!r || count(r.score) <= 0) continue;
    runs.push({
      score: count(r.score),
      seconds: count(r.seconds),
      stage: Math.max(1, count(r.stage)),
      distance: count(r.distance),
      skin: typeof r.skin === 'string' ? r.skin : DEFAULT_SKIN,
      date: typeof r.date === 'string' ? r.date : '',
    });
  }
  return runs.sort((a, b) => b.score - a.score).slice(0, TOP_RUNS);
}

/**
 * Turns whatever was in storage into valid SaveData. Unknown/corrupt fields fall back to
 * defaults, so older saves upgrade naturally: v1 had no upgrades/tutorial (anyone who
 * already played counts as having seen the tutorial), v2 no skins, v3 no gems, stats,
 * missions, achievements or top runs (they start fresh).
 */
export function migrateSave(raw: unknown): SaveData {
  const data = defaultSave();
  if (!raw || typeof raw !== 'object') return data;
  const r = raw as Record<string, unknown>;
  data.coins = count(r.coins);
  data.gems = count(r.gems);
  data.bestScore = count(r.bestScore);
  data.bestDistance = count(r.bestDistance);
  data.runs = count(r.runs);

  const upgrades = record(r.upgrades);
  for (const id of UPGRADE_IDS) {
    data.upgrades[id] = Math.min(maxLevel(id), count(upgrades?.[id]));
  }

  // Skins (v3): keep known ids only; the default is always owned; wear only what's owned.
  const skins = record(r.skins);
  const owned = Array.isArray(skins?.owned) ? skins.owned : [];
  data.skins.owned = SKIN_IDS.filter((id) => id === DEFAULT_SKIN || owned.includes(id));
  const equipped = skins?.equipped as SkinId;
  data.skins.equipped = data.skins.owned.includes(equipped) ? equipped : DEFAULT_SKIN;

  // Progression (v4).
  data.stats = migrateStats(r.stats);
  data.missions = migrateMissions(r.missions);
  const unlocked = Array.isArray(r.achievements) ? r.achievements : [];
  data.achievements = ACHIEVEMENTS.map((a) => a.id).filter((id) => unlocked.includes(id));
  data.topRuns = migrateTopRuns(r.topRuns);

  data.tutorialDone = typeof r.tutorialDone === 'boolean' ? r.tutorialDone : data.runs > 0;
  const settings = record(r.settings);
  if (settings && typeof settings.muted === 'boolean') data.settings.muted = settings.muted;
  const unit = (v: unknown, d: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d;
  data.settings.music = unit(settings?.music, data.settings.music);
  data.settings.sfx = unit(settings?.sfx, data.settings.sfx);
  if (typeof settings?.shake === 'boolean') data.settings.shake = settings.shake;
  if (typeof settings?.highContrast === 'boolean') data.settings.highContrast = settings.highContrast;

  // Maps (v5): per-map bests for known maps; keep the selection only if it's unlocked.
  const maps = record(r.maps);
  const best = record(maps?.best) ?? {};
  const pearls = record(maps?.pearls) ?? {};
  const bosses = Array.isArray(maps?.bosses) ? maps.bosses : [];
  for (const id of MAP_ORDER) {
    const n = count(best[id]);
    if (n > 0) data.maps.best[id] = n;
    // Pearls and bosses (v6): valid, distinct pearl indexes only.
    const list = Array.isArray(pearls[id]) ? (pearls[id] as unknown[]) : [];
    const valid = [...new Set(list)].filter(
      (i): i is number => Number.isInteger(i) && (i as number) >= 0 && (i as number) < MAPS[id].pearls.length,
    );
    if (valid.length > 0) data.maps.pearls[id] = valid.sort();
    if (bosses.includes(id)) data.maps.bosses.push(id);
  }
  const selected = maps?.selected as MapId;
  if (MAP_ORDER.includes(selected) && isMapUnlocked(data, selected)) data.maps.selected = selected;
  return data;
}

export interface RunSettlement {
  data: SaveData;
  newBest: boolean;
  /** Place on the top-runs list (1-5), or null. */
  rank: number | null;
  missions: MissionDef[];
  achievements: AchievementDef[];
  /** Paid by missions and achievements (on top of what the run collected). */
  rewardCoins: number;
  rewardGems: number;
  /** Maps this run's score unlocked. */
  unlockedMaps: MapId[];
}

/**
 * Banks a finished run: coins and gems, bests, lifetime stats, missions (paid and replaced),
 * new achievements (their gems) and the top-runs list.
 */
export function settleRun(
  data: SaveData,
  run: RunStats,
  options: { random: () => number; date: string; map?: MapId },
): RunSettlement {
  const map = options.map ?? data.maps.selected;
  const missions = settleMissions(data.missions.active, run, options.random);
  const statsAfterRun = addRunToStats(data.stats, run, missions);
  const achievements = newAchievements(statsAfterRun, data.achievements);
  const achievementGems = achievements.reduce((sum, a) => sum + a.gems, 0);
  const stats = { ...statsAfterRun, gemsEarned: statsAfterRun.gemsEarned + achievementGems };
  const top = addTopRun(data.topRuns, {
    score: count(run.score),
    seconds: Math.round(run.seconds),
    stage: run.maxStage,
    distance: Math.round(run.distance),
    skin: data.skins.equipped,
    date: options.date,
  });
  const rewardGems = missions.gems + achievementGems;
  const bestScore = Math.max(data.bestScore, count(run.score));
  const unlockedMaps = newlyUnlocked(data, { ...data, bestScore });
  return {
    unlockedMaps,
    newBest: run.score > data.bestScore,
    rank: top.rank,
    missions: missions.completed,
    achievements,
    rewardCoins: missions.coins,
    rewardGems,
    data: {
      ...data,
      coins: data.coins + count(run.coins) + missions.coins,
      gems: data.gems + count(run.gems) + rewardGems,
      bestScore,
      maps: {
        ...data.maps,
        best: { ...data.maps.best, [map]: Math.max(data.maps.best[map] ?? 0, count(run.score)) },
      },
      bestDistance: Math.max(data.bestDistance, count(Math.round(run.distance))),
      runs: data.runs + 1,
      stats,
      missions: {
        active: missions.active,
        completed: data.missions.completed + missions.completed.length,
      },
      achievements: [...data.achievements, ...achievements.map((a) => a.id)],
      topRuns: top.list,
    },
  };
}

/** Buys a skin (and wears it) if not owned and affordable. Returns null if not possible. */
export function purchaseSkin(data: SaveData, id: SkinId): SaveData | null {
  const { price, currency } = skinDef(id);
  const wallet = currency === 'gems' ? data.gems : data.coins;
  if (data.skins.owned.includes(id) || wallet < price) return null;
  return {
    ...data,
    coins: currency === 'coins' ? data.coins - price : data.coins,
    gems: currency === 'gems' ? data.gems - price : data.gems,
    skins: { owned: [...data.skins.owned, id], equipped: id },
  };
}

/** Wears an owned skin. Returns null if it isn't owned. */
export function equipSkin(data: SaveData, id: SkinId): SaveData | null {
  if (!data.skins.owned.includes(id)) return null;
  return { ...data, skins: { ...data.skins, equipped: id } };
}

/** Buys the next level of an upgrade if affordable. Returns null if not possible. */
export function purchase(data: SaveData, id: UpgradeId): SaveData | null {
  const result = buy(data.upgrades, data.coins, id);
  if (!result.ok) return null;
  return { ...data, coins: result.coins, upgrades: result.levels };
}
