// Predator definitions. Predators hunt the seal while it's smaller than their tier, and
// flee (and become edible) once the seal has outgrown them.
import { TextureKeys, type TextureKey } from './assets';
import type { ZoneId } from './zones';

export type PredatorId = 'shark';

export interface PredatorDef {
  id: PredatorId;
  name: string;
  texture: TextureKey;
  /** The seal's stage must reach this to eat it; below it, the predator hunts the seal. */
  tier: number;
  /** Body radius (world px) for being eaten by the seal. */
  radius: number;
  /** Mouth circle ahead of the centre (world px) used for biting the seal. */
  mouthOffset: number;
  mouthRadius: number;
  scale: number;
  patrolSpeed: number;
  chaseSpeed: number;
  fleeSpeed: number;
  turnRate: number;
  chaseTurnRate: number;
  accel: number;
  /** Starts hunting when the seal is this close (and in the water). */
  noticeRadius: number;
  /** Gives up when the seal gets this far away. */
  loseRadius: number;
  /** Seconds of warning (stops, turns, "!") before charging. */
  telegraphTime: number;
  maxChaseTime: number;
  /** Seconds spent swimming off after a successful bite. */
  recoverTime: number;
  /** Seconds before it can notice the seal again after giving up or biting. */
  cooldown: number;
  damage: number;
  knockback: number;
  /** Rewards when the seal eats it. */
  nutrition: number;
  score: number;
  growth: number;
  coins: number;
  zones: readonly ZoneId[];
}

export const PREDATORS: Record<PredatorId, PredatorDef> = {
  shark: {
    id: 'shark',
    name: 'Shark',
    texture: TextureKeys.Shark,
    tier: 5,
    radius: 34,
    mouthOffset: 72,
    mouthRadius: 24,
    scale: 1,
    patrolSpeed: 110,
    chaseSpeed: 370,
    fleeSpeed: 420,
    turnRate: 2.4,
    chaseTurnRate: 2.1,
    accel: 520,
    noticeRadius: 460,
    loseRadius: 900,
    telegraphTime: 0.8,
    maxChaseTime: 6,
    recoverTime: 1.6,
    cooldown: 4,
    damage: 28,
    knockback: 520,
    nutrition: 45,
    score: 250,
    growth: 40,
    coins: 5,
    zones: ['ocean', 'deep'],
  },
};

export const PREDATOR_LIST: readonly PredatorDef[] = Object.values(PREDATORS);
