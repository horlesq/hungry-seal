import { describe, expect, it } from 'vitest';
import { DANGER } from '../config/balance';
import { hazardsAllowed, predatorsAllowed } from './danger';

describe('danger schedule', () => {
  it('keeps the start of a run safe', () => {
    expect(hazardsAllowed(0)).toBe(0);
    expect(hazardsAllowed(DANGER.hazardsStartAt - 0.1)).toBe(0);
    expect(predatorsAllowed(0)).toBe(0);
  });

  it('ramps hazards up over time and caps them', () => {
    const start = hazardsAllowed(DANGER.hazardsStartAt);
    expect(start).toBe(DANGER.hazardsBase);
    expect(hazardsAllowed(DANGER.hazardsStartAt + 60)).toBeGreaterThan(start);
    expect(hazardsAllowed(10_000)).toBe(DANGER.hazardsMax);
  });

  it('follows the predator schedule', () => {
    for (const step of DANGER.predatorSchedule) {
      expect(predatorsAllowed(step.after)).toBe(step.count);
      expect(predatorsAllowed(step.after - 0.01)).toBeLessThan(step.count);
    }
  });
});
