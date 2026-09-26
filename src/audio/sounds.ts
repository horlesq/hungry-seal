// Sound effect definitions for the synth. Keys are used everywhere via SoundKeys.
import type { Tone } from './synth';

export const SoundKeys = {
  Chomp: 'sfx-chomp',
  ChompBig: 'sfx-chomp-big',
  Coin: 'sfx-coin',
  Splash: 'sfx-splash',
  Hurt: 'sfx-hurt',
  Zap: 'sfx-zap',
  Explode: 'sfx-explode',
  Boost: 'sfx-boost',
  Grow: 'sfx-grow',
  Frenzy: 'sfx-frenzy',
  SharkAlert: 'sfx-shark-alert',
  Bump: 'sfx-bump',
  Click: 'sfx-click',
  Buy: 'sfx-buy',
  GameOver: 'sfx-game-over',
  Music: 'music-ocean',
} as const;

export type SoundKey = (typeof SoundKeys)[keyof typeof SoundKeys];

const arp = (notes: number[], step: number, tone: Omit<Tone, 'freq' | 'start'>): Tone[] =>
  notes.map((freq, i) => ({ ...tone, freq, start: i * step }));

export const EFFECT_TONES: Record<Exclude<SoundKey, 'music-ocean'>, Tone[]> = {
  [SoundKeys.Chomp]: [
    {
      wave: 'noise',
      freq: 1,
      duration: 0.07,
      volume: 0.5,
      lowpass: 2600,
      lowpassEnd: 600,
      curve: 2,
    },
    { wave: 'sine', freq: 420, freqEnd: 170, duration: 0.09, volume: 0.6, curve: 2 },
  ],
  [SoundKeys.ChompBig]: [
    {
      wave: 'noise',
      freq: 1,
      duration: 0.12,
      volume: 0.6,
      lowpass: 1800,
      lowpassEnd: 300,
      curve: 2,
    },
    { wave: 'sine', freq: 300, freqEnd: 90, duration: 0.16, volume: 0.8, curve: 1.6 },
  ],
  [SoundKeys.Coin]: [
    { wave: 'square', freq: 988, duration: 0.06, volume: 0.18, curve: 0.8, lowpass: 6000 },
    {
      wave: 'square',
      freq: 1319,
      start: 0.06,
      duration: 0.16,
      volume: 0.18,
      curve: 1.5,
      lowpass: 6000,
    },
  ],
  [SoundKeys.Splash]: [
    {
      wave: 'noise',
      freq: 1,
      duration: 0.45,
      volume: 0.6,
      attack: 0.01,
      lowpass: 3500,
      lowpassEnd: 400,
      curve: 2.2,
    },
    { wave: 'sine', freq: 180, freqEnd: 80, duration: 0.2, volume: 0.3, curve: 2 },
  ],
  [SoundKeys.Hurt]: [
    {
      wave: 'saw',
      freq: 190,
      freqEnd: 80,
      duration: 0.28,
      volume: 0.35,
      lowpass: 1200,
      curve: 1.4,
    },
    { wave: 'noise', freq: 1, duration: 0.12, volume: 0.3, lowpass: 1500, curve: 2 },
  ],
  [SoundKeys.Zap]: [
    {
      wave: 'square',
      freq: 700,
      freqEnd: 1300,
      duration: 0.22,
      volume: 0.2,
      vibrato: { rate: 45, depth: 0.25 },
      lowpass: 4000,
      curve: 1.2,
    },
  ],
  [SoundKeys.Explode]: [
    {
      wave: 'noise',
      freq: 1,
      duration: 0.8,
      volume: 0.9,
      lowpass: 2500,
      lowpassEnd: 120,
      curve: 1.6,
    },
    { wave: 'sine', freq: 90, freqEnd: 35, duration: 0.6, volume: 0.9, curve: 1.4 },
  ],
  [SoundKeys.Boost]: [
    {
      wave: 'noise',
      freq: 1,
      duration: 0.35,
      volume: 0.45,
      attack: 0.05,
      lowpass: 400,
      lowpassEnd: 3000,
      curve: 1.2,
    },
  ],
  [SoundKeys.Grow]: arp([523, 659, 784, 1047], 0.08, {
    wave: 'triangle',
    duration: 0.22,
    volume: 0.35,
    curve: 1.4,
  }),
  [SoundKeys.Frenzy]: arp([392, 523, 659, 784, 1047, 1319], 0.055, {
    wave: 'square',
    duration: 0.18,
    volume: 0.14,
    curve: 1.2,
    lowpass: 5000,
  }),
  [SoundKeys.SharkAlert]: [
    { wave: 'saw', freq: 82, duration: 0.22, volume: 0.45, lowpass: 700, curve: 1 },
    { wave: 'saw', freq: 87, start: 0.26, duration: 0.3, volume: 0.45, lowpass: 700, curve: 1 },
  ],
  [SoundKeys.Bump]: [
    { wave: 'sine', freq: 160, freqEnd: 110, duration: 0.12, volume: 0.5, curve: 2 },
  ],
  [SoundKeys.Click]: [
    { wave: 'triangle', freq: 880, freqEnd: 660, duration: 0.05, volume: 0.3, curve: 2 },
  ],
  [SoundKeys.Buy]: arp([784, 988, 1319], 0.07, {
    wave: 'square',
    duration: 0.14,
    volume: 0.15,
    curve: 1.4,
    lowpass: 6000,
  }),
  [SoundKeys.GameOver]: arp([523, 440, 349, 262], 0.16, {
    wave: 'triangle',
    duration: 0.3,
    volume: 0.35,
    curve: 1.2,
  }),
};
