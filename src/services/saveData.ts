// Persistent save data: schema, defaults, validation/migration and pure update helpers.
// No storage access here (SaveService does the I/O) so it can be unit tested.
import { DEFAULT_SKIN, SKIN_IDS, skinDef, type SkinId } from '../config/skins';
import { UPGRADE_IDS, type UpgradeId } from '../config/upgrades';
import {
  buyUpgrade as buy,
  emptyUpgrades,
  maxLevel,
  type UpgradeLevels,
} from '../systems/UpgradeSystem';

export const SAVE_VERSION = 3;

export interface SaveData {
  version: typeof SAVE_VERSION;
  /** Coins banked across runs, spent in the shop. */
  coins: number;
  bestScore: number;
  /** Best distance swum in one run, meters. */
  bestDistance: number;
  runs: number;
  upgrades: UpgradeLevels;
  /** Cosmetic seal skins: bought ones (always including the default) and the one worn. */
  skins: { owned: SkinId[]; equipped: SkinId };
  /** First-run hints have been shown. */
  tutorialDone: boolean;
  settings: {
    muted: boolean;
  };
}

export interface RunRecord {
  score: number;
  coins: number;
  distance: number;
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    coins: 0,
    bestScore: 0,
    bestDistance: 0,
    runs: 0,
    upgrades: emptyUpgrades(),
    skins: { owned: [DEFAULT_SKIN], equipped: DEFAULT_SKIN },
    tutorialDone: false,
    settings: { muted: false },
  };
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Turns whatever was in storage into valid SaveData. Unknown/corrupt fields fall back to
 * defaults. v1 saves (no upgrades/tutorial fields) upgrade naturally: missing fields get
 * defaults, except that anyone who already played counts as having seen the tutorial.
 */
export function migrateSave(raw: unknown): SaveData {
  const data = defaultSave();
  if (!raw || typeof raw !== 'object') return data;
  const r = raw as Record<string, unknown>;
  data.coins = count(r.coins);
  data.bestScore = count(r.bestScore);
  data.bestDistance = count(r.bestDistance);
  data.runs = count(r.runs);

  const upgrades = r.upgrades as Record<string, unknown> | undefined;
  for (const id of UPGRADE_IDS) {
    data.upgrades[id] = Math.min(maxLevel(id), count(upgrades?.[id]));
  }

  // Skins (v3): keep known ids only; the default is always owned; wear only what's owned.
  const skins = r.skins as { owned?: unknown; equipped?: unknown } | undefined;
  const owned = Array.isArray(skins?.owned) ? skins.owned : [];
  data.skins.owned = SKIN_IDS.filter((id) => id === DEFAULT_SKIN || owned.includes(id));
  const equipped = skins?.equipped as SkinId;
  data.skins.equipped = data.skins.owned.includes(equipped) ? equipped : DEFAULT_SKIN;

  data.tutorialDone = typeof r.tutorialDone === 'boolean' ? r.tutorialDone : data.runs > 0;
  const settings = r.settings as Record<string, unknown> | undefined;
  if (settings && typeof settings.muted === 'boolean') data.settings.muted = settings.muted;
  return data;
}

/** Applies a finished run. Returns the new data and whether the score is a new best. */
export function recordRun(data: SaveData, run: RunRecord): { data: SaveData; newBest: boolean } {
  const newBest = run.score > data.bestScore;
  return {
    newBest,
    data: {
      ...data,
      coins: data.coins + count(run.coins),
      bestScore: Math.max(data.bestScore, count(run.score)),
      bestDistance: Math.max(data.bestDistance, count(run.distance)),
      runs: data.runs + 1,
    },
  };
}

/** Buys a skin (and wears it) if not owned and affordable. Returns null if not possible. */
export function purchaseSkin(data: SaveData, id: SkinId): SaveData | null {
  const price = skinDef(id).price;
  if (data.skins.owned.includes(id) || data.coins < price) return null;
  return {
    ...data,
    coins: data.coins - price,
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
