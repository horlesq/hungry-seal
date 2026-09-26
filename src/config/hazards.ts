// Hazard definitions: things that hurt the seal on contact and can't be eaten.
import { TextureKeys, type TextureKey } from './assets';
import type { ZoneId } from './zones';

export type HazardId = 'jellyfish' | 'mine';

export interface HazardDef {
  id: HazardId;
  name: string;
  texture: TextureKey;
  /** Contact radius in world px. */
  radius: number;
  scale: number;
  /** Hunger lost on contact. */
  damage: number;
  /** Knockback speed (px/s) away from the hazard. */
  knockback: number;
  /** Seconds the seal can't steer after contact. */
  stun: number;
  /** Mines blow up (and disappear) on contact; jellyfish stay. */
  explodes: boolean;
  /** Slow horizontal drift (px/s) and vertical bob. */
  driftSpeed: number;
  bobAmp: number;
  bobFreq: number;
  zones: readonly ZoneId[];
  weight: number;
}

export const HAZARDS: Record<HazardId, HazardDef> = {
  jellyfish: {
    id: 'jellyfish',
    name: 'Jellyfish',
    texture: TextureKeys.Jellyfish,
    radius: 22,
    scale: 1,
    damage: 12,
    knockback: 420,
    stun: 0.7,
    explodes: false,
    driftSpeed: 14,
    bobAmp: 34,
    bobFreq: 0.3,
    zones: ['reef', 'ocean', 'deep'],
    weight: 3,
  },
  mine: {
    id: 'mine',
    name: 'Sea mine',
    texture: TextureKeys.Mine,
    radius: 26,
    scale: 1,
    damage: 30,
    knockback: 680,
    stun: 0.35,
    explodes: true,
    driftSpeed: 0,
    bobAmp: 8,
    bobFreq: 0.22,
    zones: ['ocean', 'deep', 'abyss'],
    weight: 2,
  },
};

export const HAZARD_LIST: readonly HazardDef[] = Object.values(HAZARDS);
