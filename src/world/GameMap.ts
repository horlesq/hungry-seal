// Runtime map: its definition plus the baked terrain field (baked once per map, then cached
// for the session). The map being played is also kept as the "current" map so systems that
// only need a query (is this spot open water? where's the ground?) don't need it threaded
// through every constructor.
import { MAPS, type MapDef, type MapId, type RegionDef } from '../config/maps';
import { WORLD, ZONES, type Zone, type ZoneId } from '../config/zones';
import { TerrainField } from './terrain';

const cache = new Map<MapId, GameMap>();
const pending = new Map<MapId, Promise<GameMap>>();
let current: GameMap | null = null;
let worker: Worker | null = null;
const resolvers = new Map<string, (data: Float32Array) => void>();

/** The shared bake worker (browser only; null where workers aren't available). */
function bakeWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === 'undefined') return null;
  try {
    worker = new Worker(new URL('./bakeWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: string; data: Float32Array }>) => {
      resolvers.get(e.data.id)?.(e.data.data);
      resolvers.delete(e.data.id);
    };
  } catch {
    worker = null;
  }
  return worker;
}

export class GameMap {
  readonly terrain: TerrainField;

  private constructor(
    readonly def: MapDef,
    data?: Float32Array,
  ) {
    this.terrain = new TerrainField(def.terrain, data);
  }

  /** The map, baking its terrain right now if it isn't ready (prefer prefetch()). */
  static get(id: MapId): GameMap {
    let map = cache.get(id);
    if (!map) {
      map = new GameMap(MAPS[id] ?? MAPS.bay);
      cache.set(id, map);
    }
    return map;
  }

  /** True once the map's terrain is baked. */
  static ready(id: MapId): boolean {
    return cache.has(id);
  }

  /** Bakes the map's terrain in a worker (no hitch); resolves when it's ready. */
  static prefetch(id: MapId): Promise<GameMap> {
    const done = cache.get(id);
    if (done) return Promise.resolve(done);
    const inFlight = pending.get(id);
    if (inFlight) return inFlight;
    const w = bakeWorker();
    if (!w) return Promise.resolve(GameMap.get(id));
    const def = MAPS[id] ?? MAPS.bay;
    const job = new Promise<GameMap>((resolve) => {
      resolvers.set(id, (data) => {
        // A synchronous get() may have beaten the worker to it.
        const map = cache.get(id) ?? new GameMap(def, data);
        cache.set(id, map);
        pending.delete(id);
        resolve(map);
      });
      w.postMessage({ id, def: def.terrain });
    });
    pending.set(id, job);
    return job;
  }

  get id(): MapId {
    return this.def.id;
  }

  get width(): number {
    return this.def.terrain.width;
  }

  /** The zone at `y` with this map's name and blurb. */
  zone(zone: Zone): Zone {
    const o = this.def.zones?.[zone.id];
    return o ? { ...zone, name: o.name, blurb: o.blurb } : zone;
  }

  /**
   * The region at (x, y): a depth-banded region (a lair) wins over the wide one around it.
   * Falls back to the nearest region by x.
   */
  regionAt(x: number, y: number): RegionDef {
    let wide: RegionDef | null = null;
    for (const r of this.def.regions) {
      if (x < r.x0 || x >= r.x1) continue;
      if (r.y0 !== undefined || r.y1 !== undefined) {
        if (y >= (r.y0 ?? -Infinity) && y < (r.y1 ?? Infinity)) return r;
      } else wide ??= r;
    }
    if (wide) return wide;
    return x < this.def.regions[0].x0 ? this.def.regions[0] : this.def.regions[this.def.regions.length - 1];
  }

  /** Spawn weight multiplier for a creature at (x, y): map-wide x region. */
  creatureMult(id: string, x: number, y: number): number {
    const m = (this.def.creatureMult as Record<string, number> | undefined)?.[id] ?? 1;
    const r = (this.regionAt(x, y).creatureMult as Record<string, number> | undefined)?.[id] ?? 1;
    return m * r;
  }

  /** Spawn multiplier for a predator kind with the camera at (x, y): map-wide x region. */
  predatorMult(id: string, x: number, y: number): number {
    const m = (this.def.predatorMult as Record<string, number> | undefined)?.[id] ?? 1;
    const r = (this.regionAt(x, y).predatorMult as Record<string, number> | undefined)?.[id] ?? 1;
    return m * r;
  }

  /** Background water color at the top of a zone. */
  zoneColor(id: ZoneId): string {
    return id === 'surface' ? this.def.palette.sky : this.def.palette.water[id];
  }
}

export function setCurrentMap(map: GameMap): void {
  current = map;
}

/** The map being played (Seal Bay until a run sets one). */
export function currentMap(): GameMap {
  current ??= GameMap.get('bay');
  return current;
}

/** Zones with the current map's names. */
export function mapZones(): Zone[] {
  const map = currentMap();
  return ZONES.map((z) => map.zone(z));
}

/** Clamp an x inside the playable width of the current map. */
export function clampToMap(x: number, margin = 0): number {
  return Math.min(currentMap().width - margin, Math.max(margin, x));
}

export const WORLD_HEIGHT = WORLD.height;
