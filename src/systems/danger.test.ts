import { describe, expect, it } from 'vitest';
import { DANGER } from '../config/balance';
import { PREDATORS } from '../config/predators';
import { hazardsAllowed, predatorsAllowed } from './danger';

describe('danger schedule', () => {
  it('keeps the start of a run safe', () => {
    expect(hazardsAllowed(0)).toBe(0);
    expect(hazardsAllowed(DANGER.hazardsStartAt - 0.1)).toBe(0);
    expect(predatorsAllowed(PREDATORS.shark.spawn, 0, 'ocean')).toBe(0);
    expect(predatorsAllowed(PREDATORS.orca.spawn, 0, 'ocean')).toBe(0);
  });

  it('ramps hazards up over time and caps them', () => {
    const start = hazardsAllowed(DANGER.hazardsStartAt);
    expect(start).toBe(DANGER.hazardsBase);
    expect(hazardsAllowed(DANGER.hazardsStartAt + 60)).toBeGreaterThan(start);
    expect(hazardsAllowed(10_000)).toBe(DANGER.hazardsMax);
  });

  it('follows scheduled predator steps', () => {
    const rule = PREDATORS.shark.spawn;
    if (rule.kind !== 'schedule') throw new Error('shark should be scheduled');
    for (const step of rule.steps) {
      expect(predatorsAllowed(rule, step.after, 'reef')).toBe(step.count);
      expect(predatorsAllowed(rule, step.after - 0.01, 'reef')).toBeLessThan(step.count);
    }
  });

  it('orcas arrive late in a run, after the first sharks', () => {
    const orca = PREDATORS.orca.spawn;
    const shark = PREDATORS.shark.spawn;
    if (orca.kind !== 'schedule' || shark.kind !== 'schedule') throw new Error('scheduled');
    const first = orca.steps[0].after;
    expect(first).toBeGreaterThanOrEqual(120);
    expect(first).toBeGreaterThan(shark.steps[0].after);
    expect(predatorsAllowed(orca, first - 1, 'deep')).toBe(0);
    expect(predatorsAllowed(orca, first + 1, 'deep')).toBe(1);
  });

  it('zone predators only appear while the camera is in their zones', () => {
    const rule = PREDATORS.anglerfish.spawn;
    expect(predatorsAllowed(rule, 100, 'reef')).toBe(0);
    expect(predatorsAllowed(rule, 100, 'abyss')).toBeGreaterThan(0);
  });
});
