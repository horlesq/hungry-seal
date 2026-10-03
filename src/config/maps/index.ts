// The maps (one file each) and their order on the map select.
import { ARCTIC } from './arctic';
import { BAY } from './bay';
import { TROPICAL } from './tropical';
import type { MapDef, MapId } from './types';

export * from './types';

export const MAPS: Record<MapId, MapDef> = { bay: BAY, arctic: ARCTIC, tropical: TROPICAL };
export const MAP_ORDER: readonly MapId[] = ['bay', 'arctic', 'tropical'];
