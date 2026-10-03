// Bakes a map's terrain field off the main thread (it takes a few hundred ms for a big map).
import type { TerrainDef } from './terrain';
import { TerrainField } from './terrain';

self.onmessage = (e: MessageEvent<{ id: string; def: TerrainDef }>) => {
  const field = new TerrainField(e.data.def);
  const data = field.data;
  (self as unknown as Worker).postMessage({ id: e.data.id, data }, [data.buffer]);
};
