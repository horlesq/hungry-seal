// Creature definitions. Adding a creature = add an entry here + a texture key (+ placeholder
// painter until real art exists). Behaviors are combined from the list; see creatureAI.ts.
import { TextureKeys, type TextureKey } from './assets';
import type { ZoneId } from './zones';

export type BehaviorId = 'wander' | 'drift' | 'flee' | 'school';
export type CreatureId = 'minnow' | 'shrimp' | 'sardine';

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
};

export const CREATURE_LIST: readonly CreatureDef[] = Object.values(CREATURES);
