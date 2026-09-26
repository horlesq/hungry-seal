import { describe, expect, it } from 'vitest';
import { EFFECT_TONES } from './sounds';
import { renderEffect, renderMusic, SAMPLE_RATE } from './synth';

function stats(buf: Float32Array) {
  let peak = 0;
  let finite = true;
  for (const s of buf) {
    if (!Number.isFinite(s)) finite = false;
    peak = Math.max(peak, Math.abs(s));
  }
  return { peak, finite };
}

describe('synth', () => {
  it('renders every effect as audible, finite, clipped audio', () => {
    for (const [key, tones] of Object.entries(EFFECT_TONES)) {
      const buf = renderEffect(tones);
      const { peak, finite } = stats(buf);
      expect(finite, key).toBe(true);
      expect(peak, key).toBeGreaterThan(0.05);
      expect(peak, key).toBeLessThanOrEqual(1);
      expect(buf.length / SAMPLE_RATE, key).toBeLessThan(2);
    }
  });

  it('is deterministic for a seed', () => {
    const tones = EFFECT_TONES['sfx-splash'];
    expect(renderEffect(tones, 7)).toEqual(renderEffect(tones, 7));
  });

  it('renders a stereo music loop that starts and ends near silence-matched', () => {
    const [l, r] = renderMusic();
    expect(l.length).toBe(r.length);
    const seconds = l.length / SAMPLE_RATE;
    expect(seconds).toBeGreaterThan(15);
    expect(seconds).toBeLessThan(40);
    const { peak, finite } = stats(l);
    expect(finite).toBe(true);
    expect(peak).toBeGreaterThan(0.05);
    expect(peak).toBeLessThanOrEqual(1);
    // Seamless loop: the wrap-around point shouldn't jump.
    expect(Math.abs(l[0] - l[l.length - 1])).toBeLessThan(0.2);
  });
});
