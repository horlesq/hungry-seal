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

/** Calm underwater loop: pads, a plucky arpeggio, soft bass and bubbles. Stereo, seamless. */
export function renderMusic(sampleRate = SAMPLE_RATE): [Float32Array, Float32Array] {
  const bpm = 88;
  const beat = 60 / bpm;
  const barBeats = 4;
  // Two bars per chord: Cmaj7 - Am7 - Fmaj7 - G6.
  const chords = [
    [48, 55, 59, 64],
    [45, 52, 55, 60],
    [41, 48, 52, 57],
    [43, 50, 52, 59],
  ];
  const barsPerChord = 2;
  const loopSeconds = chords.length * barsPerChord * barBeats * beat;
  const length = Math.round(loopSeconds * sampleRate);
  // Three mono buses (left / centre / right) mixed to stereo at the end: each note is
  // rendered once instead of once per channel.
  const buses = [new Float32Array(length), new Float32Array(length), new Float32Array(length)];
  const rng = createRng(99);
  const both = (tone: Tone) => {
    const pan = tone.pan ?? 0;
    const bus = pan < -0.2 ? 0 : pan > 0.2 ? 2 : 1;
    mixTone(buses[bus], tone, 1, rng, sampleRate, true);
  };

  chords.forEach((chord, ci) => {
    const chordStart = ci * barsPerChord * barBeats * beat;
    const chordLen = barsPerChord * barBeats * beat;
    // Pads: slow swell, slightly detuned per side for width, overlapping into the next chord.
    chord.forEach((note, ni) => {
      const pan = ni % 2 === 0 ? -0.4 : 0.4;
      both({
        wave: 'triangle',
        freq: midi(note + 12),
        start: chordStart,
        duration: chordLen + beat * 1.5,
        volume: 0.05,
        attack: 1.2,
        curve: 0.6,
        lowpass: 1400,
        vibrato: { rate: 0.3 + ni * 0.07, depth: 0.003 },
        pan,
      });
    });
    // Bass on beats 1 and 3.
    for (let b = 0; b < barsPerChord * barBeats; b += 2) {
      both({
        wave: 'sine',
        freq: midi(chord[0] - 12),
        start: chordStart + b * beat,
        duration: beat * 1.6,
        volume: 0.16,
        attack: 0.02,
        curve: 2,
      });
    }
    // Arpeggio in eighth notes, ping-ponging left/right.
    const pattern = [0, 1, 2, 3, 2, 1, 2, 3];
    for (let e = 0; e < barsPerChord * barBeats * 2; e++) {
      const note = chord[pattern[e % pattern.length]] + 24;
      both({
        wave: 'triangle',
        freq: midi(note),
        start: chordStart + e * beat * 0.5,
        duration: 0.32,
        volume: 0.045,
        attack: 0.004,
        curve: 3,
        lowpass: 3200,
        pan: e % 2 === 0 ? -0.5 : 0.5,
      });
    }
  });

  // A few bubble blips.
  for (let i = 0; i < 14; i++) {
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
