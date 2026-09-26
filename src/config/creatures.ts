// Creature definitions. Adding a creature = add an entry here + a texture key (+ placeholder
// painter until real art exists). Behaviors are combined from the list; see creatureAI.ts.
import { TextureKeys, type TextureKey } from './assets';
import { WORLD, type ZoneId } from './zones';

/** `fly` = lives above the water (seabirds): spawned in the sky, clamped to the air. */
export type BehaviorId = 'wander' | 'drift' | 'flee' | 'school' | 'jet' | 'fly';
export type CreatureId =
  'minnow' | 'shrimp' | 'sardine' | 'squid' | 'penguin' | 'turtle' | 'seabird';

export interface CreatureDef {
  id: CreatureId;
  name: string;
  texture: TextureKey;
  /** The seal's growth stage must be >= tier to eat it. */
  tier: number;
  /** Hit radius in world px. */
  radius: number;
  /** Display scale of the texture. */
  scale: number;
  /** Cruising speed (px/s). */
  speed: number;
  /** Top speed when fleeing or catching up with its school. */
  fleeSpeed: number;
  /** Radians per second. */
  turnRate: number;
  /** Speed change per second. */
  accel: number;
  /** Starts fleeing when a seal that can eat it is this close. */
  fleeRadius: number;
  /** Hunger restored when eaten. */
  nutrition: number;
  score: number;
  /** Growth points when eaten. */
  growth: number;
  behaviors: readonly BehaviorId[];
  school?: { min: number; max: number; spread: number };
  /** Depth zones it spawns and swims in. */
  zones: readonly ZoneId[];
  /** Explicit vertical range (world y) overriding the zones' band, e.g. near the surface. */
  band?: { top: number; bottom: number };
  /** Relative spawn chance among creatures allowed in a zone. */
  weight: number;
}

export const CREATURES: Record<CreatureId, CreatureDef> = {
  minnow: {
    id: 'minnow',
    name: 'Minnow',
    texture: TextureKeys.Minnow,
    tier: 1,
    radius: 11,
    scale: 1,
    speed: 90,
    fleeSpeed: 290,
    turnRate: 5,
    accel: 600,
    fleeRadius: 220,
    nutrition: 6,
    score: 10,
    growth: 4,
    behaviors: ['school', 'wander', 'flee'],
    school: { min: 3, max: 6, spread: 36 },
    zones: ['reef', 'ocean'],
    weight: 5,
  },
  shrimp: {
    id: 'shrimp',
    name: 'Shrimp',
    texture: TextureKeys.Shrimp,
    tier: 1,
    radius: 10,
    scale: 1,
    speed: 45,
    fleeSpeed: 230,
    turnRate: 4,
    accel: 500,
    fleeRadius: 150,
    nutrition: 5,
    score: 8,
    growth: 3,
    behaviors: ['drift', 'flee'],
    zones: ['reef'],
    weight: 3,
  },
  sardine: {
    id: 'sardine',
    name: 'Sardine',
    texture: TextureKeys.Sardine,
    tier: 2,
    radius: 13,
    scale: 1,
    speed: 120,
    fleeSpeed: 330,
    turnRate: 4.5,
    accel: 650,
    fleeRadius: 240,
    nutrition: 11,
    score: 20,
    growth: 8,
    behaviors: ['school', 'wander', 'flee'],
    school: { min: 6, max: 10, spread: 44 },
    zones: ['ocean', 'deep'],
    weight: 4,
  },
  squid: {
    id: 'squid',
    name: 'Squid',
    texture: TextureKeys.Squid,
    tier: 3,
    radius: 17,
    scale: 1,
    speed: 60,
    fleeSpeed: 420,
    turnRate: 3.5,
    accel: 260,
    fleeRadius: 230,
    nutrition: 16,
    score: 60,
    growth: 14,
    behaviors: ['wander', 'jet', 'flee'],
    zones: ['ocean', 'deep'],
    weight: 2,
  },
  penguin: {
    id: 'penguin',
    name: 'Penguin',
    texture: TextureKeys.Penguin,
    tier: 3,
    radius: 18,
    scale: 1,
    speed: 150,
    fleeSpeed: 390,
    turnRate: 5.5,
    accel: 700,
    fleeRadius: 250,
    nutrition: 20,
    score: 90,
    growth: 16,
    behaviors: ['school', 'wander', 'flee'],
    school: { min: 2, max: 3, spread: 50 },
    zones: ['reef'],
    // Penguins stay in the upper water, close to the surface.
    band: { top: WORLD.surfaceY + 30, bottom: WORLD.surfaceY + 520 },
    weight: 1.5,
  },
  turtle: {
    id: 'turtle',
    name: 'Sea turtle',
    texture: TextureKeys.Turtle,
    tier: 4,
    radius: 28,
    scale: 1,
    speed: 45,
    fleeSpeed: 70,
    turnRate: 1.5,
    accel: 100,
    fleeRadius: 0,
    nutrition: 32,
    score: 120,
    growth: 26,
    // Slow and doesn't flee: a big, easy meal once you're large enough.
    behaviors: ['wander'],
    zones: ['reef', 'ocean'],
    weight: 1,
  },
  seabird: {
    id: 'seabird',
    name: 'Seabird',
    texture: TextureKeys.Seabird,
    tier: 2,
    radius: 16,
    scale: 1,
    speed: 150,
    fleeSpeed: 230,
    turnRate: 3,
    accel: 300,
    fleeRadius: 140,
    nutrition: 12,
    score: 50,
    growth: 10,
    // Glides above the waves and swoops low: leap out of the water to catch it.
    behaviors: ['wander', 'flee', 'fly'],
    zones: ['surface'],
    band: { top: WORLD.surfaceY - 280, bottom: WORLD.surfaceY - 20 },
    weight: 1,
  },
};

/** Vertical limits a creature can never leave: the air for flyers, the water for the rest. */
export function hardLimits(def: CreatureDef): { top: number; bottom: number } {
  return def.behaviors.includes('fly')
    ? { top: WORLD.ceilingY + 40, bottom: WORLD.surfaceY - 12 }
    : { top: WORLD.surfaceY + 16, bottom: WORLD.floorY - 16 };
}

export const CREATURE_LIST: readonly CreatureDef[] = Object.values(CREATURES);
export const SWIMMERS: readonly CreatureDef[] = CREATURE_LIST.filter(
  (d) => !d.behaviors.includes('fly'),
);
export const FLYERS: readonly CreatureDef[] = CREATURE_LIST.filter((d) =>
  d.behaviors.includes('fly'),
);
