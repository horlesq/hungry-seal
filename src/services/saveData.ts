// Persistent save data: schema, defaults, validation/migration and run recording.
// Pure logic (no storage access) so it can be unit tested; SaveService does the I/O.

export const SAVE_VERSION = 1;

export interface SaveData {
  version: typeof SAVE_VERSION;
  /** Coins banked across runs (spent in the Phase 4 shop). */
  coins: number;
  bestScore: number;
  /** Best distance swum in one run, meters. */
  bestDistance: number;
  runs: number;
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
    settings: { muted: false },
  };
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Turns whatever was in storage into valid SaveData. Unknown/corrupt fields fall back to
 * defaults; older versions are upgraded here as the schema evolves.
 */
export function migrateSave(raw: unknown): SaveData {
  const data = defaultSave();
  if (!raw || typeof raw !== 'object') return data;
  const r = raw as Record<string, unknown>;
  // (No older versions exist yet. Future: if (r.version === 1) { ...upgrade to 2... })
  data.coins = count(r.coins);
  data.bestScore = count(r.bestScore);
  data.bestDistance = count(r.bestDistance);
  data.runs = count(r.runs);
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
