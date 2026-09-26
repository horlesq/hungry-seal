// Predator definitions. Predators hunt the seal while it's smaller than their tier, and
// flee (and become edible) once the seal has outgrown them. Each one declares how it spawns:
// on a run-time schedule, or whenever the camera is in its home zones.
import { TextureKeys, type TextureKey } from './assets';
import type { ZoneId } from './zones';

export type PredatorId = 'shark' | 'orca' | 'anglerfish';

export type PredatorSpawn =
  /** Max alive grows with run time. */
  | { kind: 'schedule'; steps: readonly { after: number; count: number }[] }
  /** Lives in `zones`: up to `max` while the camera is there, after `after` seconds. */
  | { kind: 'zone'; zones: readonly ZoneId[]; after: number; max: number };

export interface PredatorDef {
  id: PredatorId;
  name: string;
  texture: TextureKey;
  /** The seal's stage must reach this to eat it (6+ = never, outside a frenzy). */
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
  spawn: PredatorSpawn;
  /** Glowing spot (world px from the centre when facing right), visible in dark water. */
  glow?: { x: number; y: number; color: number; size: number };
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
    spawn: {
      kind: 'schedule',
      steps: [
        { after: 45, count: 1 },
        { after: 150, count: 2 },
        { after: 270, count: 3 },
      ],
    },
  },
  orca: {
    id: 'orca',
    name: 'Orca',
    texture: TextureKeys.Orca,
    // Bigger than the seal can ever grow: only edible during a frenzy.
    tier: 6,
    radius: 42,
    mouthOffset: 86,
    mouthRadius: 28,
    scale: 1,
    patrolSpeed: 130,
    chaseSpeed: 400,
    fleeSpeed: 450,
    turnRate: 2.2,
    chaseTurnRate: 2.0,
    accel: 560,
    noticeRadius: 540,
    loseRadius: 1000,
    telegraphTime: 0.7,
    maxChaseTime: 7,
    recoverTime: 2,
    cooldown: 5,
    damage: 40,
    knockback: 620,
    nutrition: 60,
    score: 600,
    growth: 60,
    coins: 10,
    zones: ['ocean', 'deep'],
    spawn: {
      kind: 'schedule',
      steps: [
        { after: 180, count: 1 },
        { after: 330, count: 2 },
      ],
    },
  },
  anglerfish: {
    id: 'anglerfish',
    name: 'Anglerfish',
    texture: TextureKeys.Anglerfish,
    tier: 4,
    radius: 30,
    mouthOffset: 40,
    mouthRadius: 26,
    scale: 1,
    // Lurks almost still, then lunges briefly at anything that comes close.
    patrolSpeed: 22,
    chaseSpeed: 540,
    fleeSpeed: 260,
    turnRate: 2,
    chaseTurnRate: 3.2,
    accel: 1400,
    noticeRadius: 230,
    loseRadius: 520,
    telegraphTime: 0.35,
    maxChaseTime: 0.8,
    recoverTime: 1.2,
    cooldown: 3,
    damage: 24,
    knockback: 480,
    nutrition: 34,
    score: 180,
    growth: 30,
    coins: 4,
    zones: ['deep', 'abyss'],
    spawn: { kind: 'zone', zones: ['deep', 'abyss'], after: 20, max: 3 },
    glow: { x: 58, y: -44, color: 0x9ffcff, size: 0.55 },
  },
};

export const PREDATOR_LIST: readonly PredatorDef[] = Object.values(PREDATORS);
