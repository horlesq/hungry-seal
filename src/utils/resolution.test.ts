import { describe, expect, it } from 'vitest';
import { nextResolutionStep, ResolutionGovernor, type ResolutionAction } from './resolution';

const PARAMS = {
  lowFps: 45,
  slowSeconds: 4,
  settleSeconds: 3,
  judgeSeconds: 2,
  minGain: 1.15,
  steps: [2, 1.5, 1.25, 1],
};

/** Runs the governor at a fixed frame rate for `seconds`; returns the actions it asked for. */
function run(g: ResolutionGovernor, fps: number, seconds: number): ResolutionAction[] {
  const actions: ResolutionAction[] = [];
  for (let t = 0; t < seconds; t += 0.1) {
    const a = g.update(0.1, fps);
    if (a) actions.push(a);
  }
  return actions;
}

describe('ResolutionGovernor', () => {
  it('leaves a fast device alone', () => {
    expect(run(new ResolutionGovernor(PARAMS), 60, 60)).toEqual([]);
  });

  it('ignores the first seconds (loading hitches)', () => {
    expect(run(new ResolutionGovernor(PARAMS), 20, 3)).toEqual([]);
  });

  it('steps down after a sustained slowdown and keeps a step that helped', () => {
    const g = new ResolutionGovernor(PARAMS);
    run(g, 60, 3);
    expect(run(g, 30, 4.2)).toEqual(['lower']);
    // Fewer pixels, faster frames: keep it, and don't step again.
    expect(run(g, 58, 20)).toEqual([]);
  });

  it('keeps stepping while each step helps but it is still slow', () => {
    const g = new ResolutionGovernor(PARAMS);
    run(g, 60, 3);
    expect(run(g, 25, 4.2)).toEqual(['lower']);
    // Better (25 -> 35) but still under 45: after settling and judging, another step.
    expect(run(g, 35, 3 + 2 + 4.5)).toEqual(['lower']);
  });

  it('asks for the old resolution back when a step does not help (a 30 fps cap)', () => {
    const g = new ResolutionGovernor(PARAMS);
    run(g, 60, 3);
    expect(run(g, 30, 4.2)).toEqual(['lower']);
    expect(run(g, 30, 3 + 2.2)).toEqual(['restore']);
    // And it gives up for good: the device is capped, not short of pixels.
    expect(run(g, 30, 60)).toEqual([]);
  });

  it('does not fire on short hitches between good frames', () => {
    const g = new ResolutionGovernor(PARAMS);
    run(g, 60, 3);
    const actions: ResolutionAction[] = [];
    for (let i = 0; i < 20; i++) actions.push(...run(g, 20, 1), ...run(g, 60, 1));
    expect(actions).toEqual([]);
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
