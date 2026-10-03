// Tiny offline synthesizer (pure, no Phaser/WebAudio): renders sound effects and the music
// loop into Float32Array sample buffers. AudioManager turns them into AudioBuffers.
// Everything is generated in code, so there are no audio files or licenses to track;
// swap in recorded audio later by registering files under the same keys.
import { createRng, type Rng } from '../utils/rng';

export const SAMPLE_RATE = 22050;

export type Wave = 'sine' | 'triangle' | 'square' | 'saw' | 'noise';

export interface Tone {
  wave: Wave;
  /** Start frequency in Hz (ignored for noise unless filtered). */
  freq: number;
  /** End frequency; glides exponentially from `freq`. */
  freqEnd?: number;
  /** Start offset in seconds. */
  start?: number;
  duration: number;
  volume?: number;
  /** Attack time in seconds (linear ramp in). */
  attack?: number;
  /** Decay curve exponent: higher = snappier fade (1 = linear). */
  curve?: number;
  /** One-pole low-pass cutoff in Hz, optionally sweeping to `lowpassEnd`. */
  lowpass?: number;
  lowpassEnd?: number;
  vibrato?: { rate: number; depth: number };
  /** -1 (left) .. 1 (right), for stereo rendering. */
  pan?: number;
}

function oscillator(wave: Wave, phase: number, rng: Rng): number {
  const p = phase - Math.floor(phase);
  switch (wave) {
    case 'sine':
      return Math.sin(p * Math.PI * 2);
    case 'triangle':
      return 1 - 4 * Math.abs(p - 0.5);
    case 'square':
      return p < 0.5 ? 1 : -1;
    case 'saw':
      return 2 * p - 1;
    case 'noise':
      return rng() * 2 - 1;
  }
}

/**
 * Mixes `tone` into `out` (mono or one channel of stereo). With `wrap`, samples past the end
 * wrap around to the start, so sustained notes loop seamlessly in music.
 */
function mixTone(
  out: Float32Array,
  tone: Tone,
  gain: number,
  rng: Rng,
  sampleRate: number,
  wrap = false,
): void {
  const start = Math.floor((tone.start ?? 0) * sampleRate);
  const count = Math.floor(tone.duration * sampleRate);
  const volume = (tone.volume ?? 1) * gain;
  const attack = tone.attack ?? 0.005;
  const curve = tone.curve ?? 1.5;
  const glide = (tone.freqEnd ?? tone.freq) / tone.freq;
  const lpGlide = tone.lowpass ? (tone.lowpassEnd ?? tone.lowpass) / tone.lowpass : 1;
  let phase = 0;
  let filtered = 0;

  for (let i = 0; i < count; i++) {
    let idx = start + i;
    if (idx >= out.length) {
      if (!wrap) break;
      idx %= out.length;
    }
    const t = i / sampleRate;
    const progress = i / count;
    let f = tone.freq * Math.pow(glide, progress);
    if (tone.vibrato) f *= 1 + tone.vibrato.depth * Math.sin(Math.PI * 2 * tone.vibrato.rate * t);
    phase += f / sampleRate;
    let s = oscillator(tone.wave, phase, rng);
    if (tone.lowpass) {
      const cutoff = tone.lowpass * Math.pow(lpGlide, progress);
      const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
      filtered += alpha * (s - filtered);
      s = filtered;
    }
    const env = Math.min(1, t / attack) * Math.pow(1 - progress, curve);
    out[idx] += s * volume * env;
  }
}

/** Soft-clips a buffer into [-1, 1]. */
function softClip(buf: Float32Array): Float32Array {
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i]);
  return buf;
}

/** Renders a one-shot effect (mono). */
export function renderEffect(
  tones: readonly Tone[],
  seed = 1,
  sampleRate = SAMPLE_RATE,
): Float32Array {
  const rng = createRng(seed);
  const end = Math.max(...tones.map((t) => (t.start ?? 0) + t.duration));
  const out = new Float32Array(Math.ceil(end * sampleRate) + 1);
  for (const tone of tones) mixTone(out, tone, 1, rng, sampleRate);
  return softClip(out);
}

// ---------------------------------------------------------------------------------------
// Music
// ---------------------------------------------------------------------------------------

const midi = (note: number) => 440 * Math.pow(2, (note - 69) / 12);

/** A music loop: chord progression, tempo and which parts play. */
export interface TrackSpec {
  bpm: number;
  /** MIDI notes per chord (root first); each lasts `barsPerChord` bars of 4 beats. */
  chords: number[][];
  barsPerChord: number;
  pad: { wave: Wave; volume: number; octave: number; lowpass: number };
  /** Bass hits every `every` beats, each `length` beats long. */
  bass: { volume: number; every: number; length: number };
  /** Arpeggio (pattern indexes into the chord, one note per `step` beats), or null. */
  arp: { pattern: number[]; step: number; octave: number; volume: number; wave: Wave } | null;
  /** Sparse high bell notes (deep-water plinks). */
  bells?: { count: number; volume: number };
  bubbles: number;
  seed: number;
}

/** Calm underwater loop for the menus: pads, a plucky arpeggio, soft bass and bubbles. */
export const MENU_TRACK: TrackSpec = {
  bpm: 88,
  // Cmaj7 - Am7 - Fmaj7 - G6.
  chords: [
    [48, 55, 59, 64],
    [45, 52, 55, 60],
    [41, 48, 52, 57],
    [43, 50, 52, 59],
  ],
  barsPerChord: 2,
  pad: { wave: 'triangle', volume: 0.05, octave: 12, lowpass: 1400 },
  bass: { volume: 0.16, every: 2, length: 1.6 },
  arp: { pattern: [0, 1, 2, 3, 2, 1, 2, 3], step: 0.5, octave: 24, volume: 0.045, wave: 'triangle' },
  bubbles: 14,
  seed: 99,
};

/** Bright, bouncier loop for the sunny shallows and open water. */
export const SHALLOWS_TRACK: TrackSpec = {
  bpm: 108,
  // Fmaj7 - C/E - Dm7 - Bbmaj7.
  chords: [
    [41, 48, 52, 57],
    [40, 48, 55, 60],
    [38, 45, 48, 53],
    [46, 50, 53, 57],
  ],
  barsPerChord: 2,
  pad: { wave: 'triangle', volume: 0.04, octave: 12, lowpass: 1800 },
  bass: { volume: 0.17, every: 1, length: 0.7 },
  arp: { pattern: [0, 2, 1, 3, 2, 3, 1, 2], step: 0.5, octave: 24, volume: 0.05, wave: 'square' },
  bubbles: 10,
  seed: 7,
};

/** Slow, dark ambience for the deep and the abyss. */
export const DEEP_TRACK: TrackSpec = {
  bpm: 66,
  // Am - Fmaj7 - Dm - E.
  chords: [
    [45, 52, 57, 60],
    [41, 48, 52, 57],
    [38, 45, 50, 53],
    [40, 47, 52, 56],
  ],
  barsPerChord: 2,
  pad: { wave: 'saw', volume: 0.035, octave: 0, lowpass: 700 },
  bass: { volume: 0.2, every: 4, length: 3.6 },
  arp: null,
  bells: { count: 10, volume: 0.04 },
  bubbles: 22,
  seed: 5,
};

/** Renders a seamless stereo loop for `spec`. */
export function renderMusic(
  spec: TrackSpec = MENU_TRACK,
  sampleRate = SAMPLE_RATE,
): [Float32Array, Float32Array] {
  const beat = 60 / spec.bpm;
  const barBeats = 4;
  const { chords, barsPerChord } = spec;
  const loopSeconds = chords.length * barsPerChord * barBeats * beat;
  const length = Math.round(loopSeconds * sampleRate);
  // Three mono buses (left / centre / right) mixed to stereo at the end: each note is
  // rendered once instead of once per channel.
  const buses = [new Float32Array(length), new Float32Array(length), new Float32Array(length)];
  const rng = createRng(spec.seed);
  const both = (tone: Tone) => {
    const pan = tone.pan ?? 0;
    const bus = pan < -0.2 ? 0 : pan > 0.2 ? 2 : 1;
    mixTone(buses[bus], tone, 1, rng, sampleRate, true);
  };

  chords.forEach((chord, ci) => {
    const chordStart = ci * barsPerChord * barBeats * beat;
    const chordLen = barsPerChord * barBeats * beat;
    // Pads: slow swell, alternating sides for width, overlapping into the next chord.
    chord.forEach((note, ni) => {
      both({
        wave: spec.pad.wave,
        freq: midi(note + spec.pad.octave),
        start: chordStart,
        duration: chordLen + beat * 1.5,
        volume: spec.pad.volume,
        attack: 1.2,
        curve: 0.6,
        lowpass: spec.pad.lowpass,
        vibrato: { rate: 0.3 + ni * 0.07, depth: 0.003 },
        pan: ni % 2 === 0 ? -0.4 : 0.4,
      });
    });
    for (let b = 0; b < barsPerChord * barBeats; b += spec.bass.every) {
      both({
        wave: 'sine',
        freq: midi(chord[0] - 12),
        start: chordStart + b * beat,
        duration: beat * spec.bass.length,
        volume: spec.bass.volume,
        attack: 0.02,
        curve: 2,
      });
    }
    const arp = spec.arp;
    if (arp) {
      const steps = Math.round((barsPerChord * barBeats) / arp.step);
      for (let e = 0; e < steps; e++) {
        both({
          wave: arp.wave,
          freq: midi(chord[arp.pattern[e % arp.pattern.length]] + arp.octave),
          start: chordStart + e * beat * arp.step,
          duration: 0.3,
          volume: arp.volume * (arp.wave === 'square' ? 0.6 : 1),
          attack: 0.004,
          curve: 3,
          lowpass: 3200,
          pan: e % 2 === 0 ? -0.5 : 0.5,
        });
      }
    }
  });

  if (spec.bells) {
    // Sparse bell plinks on chord tones, two octaves up.
    for (let i = 0; i < spec.bells.count; i++) {
      const chord = chords[Math.floor(rng() * chords.length)];
      both({
        wave: 'sine',
        freq: midi(chord[1 + Math.floor(rng() * 3)] + 24),
        start: rng() * loopSeconds,
        duration: 1.6,
        volume: spec.bells.volume,
        attack: 0.003,
        curve: 2.5,
        pan: rng() * 1.6 - 0.8,
      });
    }
  }

  // A few bubble blips.
  for (let i = 0; i < spec.bubbles; i++) {
    const f = 700 + rng() * 900;
    both({
      wave: 'sine',
      freq: f,
      freqEnd: f * 1.8,
      start: rng() * loopSeconds,
      duration: 0.07,
      volume: 0.035,
      curve: 2,
      pan: rng() * 1.6 - 0.8,
    });
  }

  const [busL, busC, busR] = buses;
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    left[i] = busC[i] + busL[i] + busR[i] * 0.45;
    right[i] = busC[i] + busR[i] + busL[i] * 0.45;
  }
  return [softClip(left), softClip(right)];
}
