// Every map is playable at every size: the level-design checklist, automated.
import { describe, expect, it } from 'vitest';
import { MAP_ORDER, MAPS } from '../config/maps';
import { canCollect, MAX_SIZE, reachable, regionStage, type Reach } from './mapCheck';
import { TerrainField } from './terrain';

const BEACH = 2600;

describe.each(MAP_ORDER)('map %s', (id) => {
  const map = MAPS[id];
  const field = new TerrainField(map.terrain);
  const reaches: Reach[] = [];
  for (let s = 1; s <= MAX_SIZE; s++) reaches.push(reachable(map, field, s));
  const at = (s: number) => reaches[s - 1];

  it('starts in open water', () => {
    expect(field.distance(map.start.x, map.start.y)).toBeGreaterThan(40);
  });

  it('both beaches are reachable by the smallest and the biggest seal', () => {
    for (const s of [1, MAX_SIZE]) {
      expect(regionStage(map, [at(s)], { x0: 0, x1: BEACH }), `west, size ${s}`).toBe(s);
      expect(
        regionStage(map, [at(s)], { x0: map.terrain.width - BEACH, x1: map.terrain.width }),
        `east, size ${s}`,
      ).toBe(s);
    }
  });

  it('every region is reachable, ungated ones from size 1', () => {
    for (const region of map.regions) {
      const stage = regionStage(map, reaches, region);
      expect(stage, region.id).not.toBeNull();
      if (region.id !== 'lair') expect(stage, region.id).toBe(1);
    }
  });

  it('the boss lair opens at size 7 and not before', () => {
    const lair = map.regions.find((r) => r.id === 'lair')!;
    expect(regionStage(map, reaches.slice(0, 6), lair)).toBeNull();
    expect(regionStage(map, [at(7)], lair)).toBe(7);
    expect(regionStage(map, [at(MAX_SIZE)], lair)).toBe(MAX_SIZE);
  });

  it('every pearl can be collected at some size', () => {
    map.pearls.forEach((p, i) => {
      const sizes = reaches.filter((r) => canCollect(r, field, p.x, p.y)).map((r) => r.stage);
      expect(sizes.length, `pearl ${i + 1} at ${p.x},${p.y}`).toBeGreaterThan(0);
    });
  });

  it('at least one pearl is for small seals only (a tight grotto)', () => {
    const small = map.pearls.filter(
      (p) => canCollect(at(1), field, p.x, p.y) && !canCollect(at(6), field, p.x, p.y),
    );
    expect(small.length).toBeGreaterThan(0);
  });

  it('the lair pearl needs size 7', () => {
    const p = map.pearls[5];
    expect(canCollect(at(6), field, p.x, p.y)).toBe(false);
    expect(canCollect(at(7), field, p.x, p.y)).toBe(true);
  });
});
