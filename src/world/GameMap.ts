// Runtime map: its definition plus the baked terrain field (baked once per map, then cached
// for the session). The map being played is also kept as the "current" map so systems that
// only need a query (is this spot open water? where's the ground?) don't need it threaded
// through every constructor.
import { MAPS, type MapDef, type MapId } from '../config/maps';
import { WORLD, ZONES, type Zone, type ZoneId } from '../config/zones';
import { TerrainField } from './terrain';

const cache = new Map<MapId, GameMap>();
let current: GameMap | null = null;

export class GameMap {
  readonly terrain: TerrainField;

  private constructor(readonly def: MapDef) {
    this.terrain = new TerrainField(def.terrain);
  }

  static get(id: MapId): GameMap {
    let map = cache.get(id);
    if (!map) {
      map = new GameMap(MAPS[id] ?? MAPS.bay);
      cache.set(id, map);
    }
    return map;
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
