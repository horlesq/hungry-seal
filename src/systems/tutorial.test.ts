import { describe, expect, it } from 'vitest';
import { Tutorial, type HintId, type TutorialProgress } from './Tutorial';

const TEXTS: Record<HintId, string> = {
  move: 'move',
  eat: 'eat',
  boost: 'boost',
  danger: 'danger',
  grow: 'grow',
  shark: 'shark',
};

const start = (): TutorialProgress => ({
  elapsed: 0,
  distance: 0,
  eaten: 0,
  stage: 1,
  sharkNoticed: false,
});

function run(t: Tutorial, p: TutorialProgress, seconds: number): string | null {
  let hint: string | null = null;
  for (let s = 0; s < seconds; s += 0.1) {
    p.elapsed += 0.1;
    hint = t.update(0.1, p);
  }
  return hint;
}

describe('Tutorial', () => {
  it('walks through move -> eat -> boost as the player progresses', () => {
    const t = new Tutorial(TEXTS);
    const p = start();
    expect(t.update(0.1, p)).toBe('move');
    p.distance = 40;
    expect(run(t, p, 3)).toBe('eat'); // moved, and move was shown long enough
    p.eaten = 3;
    expect(run(t, p, 3)).toBe('boost');
  });

  it('keeps a hint up long enough to read even if already satisfied', () => {
    const t = new Tutorial(TEXTS);
    const p = start();
    t.update(0.1, p);
    p.distance = 100;
    expect(run(t, p, 1)).toBe('move');
  });

  it('lets urgent hints interrupt and never repeats a hint', () => {
    const t = new Tutorial(TEXTS);
    const p = start();
    t.update(0.1, p);
    p.sharkNoticed = true;
    expect(t.update(0.1, p)).toBe('shark');
    // The sequence of distinct hints shown from here on (the shark hint is already up).
    const seen: string[] = ['shark'];
    for (let i = 0; i < 400; i++) {
      p.elapsed += 0.1;
      p.distance += 1;
      p.eaten += 1;
      const h = t.update(0.1, p);
      if (h && seen[seen.length - 1] !== h) seen.push(h);
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toContain('boost');
  });

  it('brings back a hint that was interrupted before it could be read', () => {
    const t = new Tutorial(TEXTS);
    const p = start();
    t.update(0.1, p); // "move" is up
    p.sharkNoticed = true;
    expect(t.update(0.1, p)).toBe('shark');
    // Player still hasn't moved: once the shark hint times out, "move" returns.
    expect(run(t, p, 4.5)).toBe('move');
  });

  it('shows the danger warning once hazards start', () => {
    const t = new Tutorial(TEXTS);
    const p = start();
    p.distance = 100;
    p.eaten = 10;
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      p.elapsed += 0.1;
      const h = t.update(0.1, p);
      if (h) seen.add(h);
    }
    expect(seen.has('danger')).toBe(true);
    expect(t.finished).toBe(false); // grow and shark never happened
  });
});
