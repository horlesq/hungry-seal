import { describe, expect, it } from 'vitest';
import { nextResolutionStep, ResolutionGovernor } from './resolution';

const PARAMS = { lowFps: 45, slowSeconds: 4, settleSeconds: 3, steps: [2, 1.5, 1.25, 1] };

/** Runs the governor at a fixed frame rate for `seconds`; returns how many times it fired. */
function run(g: ResolutionGovernor, fps: number, seconds: number): number {
  let fired = 0;
  for (let t = 0; t < seconds; t += 0.1) if (g.update(0.1, fps)) fired++;
  return fired;
}

describe('ResolutionGovernor', () => {
  it('leaves a fast device alone', () => {
    expect(run(new ResolutionGovernor(PARAMS), 60, 60)).toBe(0);
  });

  it('ignores the first seconds (loading hitches)', () => {
    const g = new ResolutionGovernor(PARAMS);
    expect(run(g, 20, 3)).toBe(0);
  });

  it('steps down after a sustained slowdown, then settles before the next step', () => {
    const g = new ResolutionGovernor(PARAMS);
    run(g, 60, 3);
    expect(run(g, 30, 4.2)).toBe(1);
    // Right after a step it waits for the new size to settle.
    expect(run(g, 30, 3)).toBe(0);
    expect(run(g, 30, 4.2)).toBe(1);
  });

  it('does not fire on short hitches between good frames', () => {
    const g = new ResolutionGovernor(PARAMS);
    run(g, 60, 3);
    let fired = 0;
    for (let i = 0; i < 20; i++) fired += run(g, 20, 1) + run(g, 60, 1);
    expect(fired).toBe(0);
  });
});

describe('nextResolutionStep', () => {
  it('picks the next lower cap, or null at the bottom', () => {
    expect(nextResolutionStep(2, PARAMS.steps)).toBe(1.5);
    expect(nextResolutionStep(1.75, PARAMS.steps)).toBe(1.5);
    expect(nextResolutionStep(1.25, PARAMS.steps)).toBe(1);
    expect(nextResolutionStep(1, PARAMS.steps)).toBeNull();
  });
});
