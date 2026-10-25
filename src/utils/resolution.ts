// Adaptive resolution (pure logic): when a device can't keep the frame rate up during a run,
// render fewer pixels (a lower pixel-ratio cap). It only steps down once per sustained
// slowdown, and after each step it checks the step helped: a frame rate that stays put (a
// battery saver capping it at 30 fps, or a slow CPU rather than a slow GPU) means fewer
// pixels only made the picture softer, so it asks for the old resolution back.

export interface ResolutionParams {
  /** Below this many frames per second counts as slow. */
  lowFps: number;
  /** Seconds of (mostly) slow frames before stepping down. */
  slowSeconds: number;
  /** Seconds to ignore after starting or after a step (loading hitches, the new size settling). */
  settleSeconds: number;
  /** Seconds of frame rate measured after a step to judge it. */
  judgeSeconds: number;
  /** A step must raise the frame rate by this factor to be kept. */
  minGain: number;
  /** Pixel-ratio caps to step through, highest first. */
  steps: readonly number[];
}

export type ResolutionAction = 'lower' | 'restore' | null;

export class ResolutionGovernor {
  private slow = 0;
  private settle: number;
  /** After a step: the frame rate before it, and what's been measured since. */
  private judging: { before: number; sum: number; time: number } | null = null;
  /** A step didn't help: resolution isn't the problem on this device, stop trying. */
  private stopped = false;

  constructor(private readonly params: ResolutionParams) {
    this.settle = params.settleSeconds;
  }

  /**
   * Feed the time step and the current frame rate. 'lower' = render fewer pixels now;
   * 'restore' = the last step didn't help, go back to the previous resolution (and stop).
   */
  update(dt: number, fps: number): ResolutionAction {
    const p = this.params;
    if (this.stopped) return null;
    if (this.settle > 0) {
      this.settle -= dt;
      return null;
    }
    const j = this.judging;
    if (j) {
      j.sum += fps * dt;
      j.time += dt;
      if (j.time < p.judgeSeconds) return null;
      this.judging = null;
      if (j.sum / j.time < j.before * p.minGain) {
        this.stopped = true;
        return 'restore';
      }
    }
    // Good frames pay back slow time twice as fast: only a sustained slowdown counts.
    this.slow = fps < p.lowFps ? this.slow + dt : Math.max(0, this.slow - dt * 2);
    if (this.slow < p.slowSeconds) return null;
    this.slow = 0;
    this.settle = p.settleSeconds;
    this.judging = { before: fps, sum: 0, time: 0 };
    return 'lower';
  }
}

/** The next cap below the pixel ratio in use, or null if it's already at the lowest step. */
export function nextResolutionStep(currentDpr: number, steps: readonly number[]): number | null {
  for (const s of steps) if (s < currentDpr - 1e-3) return s;
  return null;
}
