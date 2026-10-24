// Adaptive resolution (pure logic): when a device can't keep the frame rate up during a run,
// render fewer pixels (a lower pixel-ratio cap). It only ever steps down, once per sustained
// slowdown, so the picture doesn't flip back and forth.

export interface ResolutionParams {
  /** Below this many frames per second counts as slow. */
  lowFps: number;
  /** Seconds of (mostly) slow frames before stepping down. */
  slowSeconds: number;
  /** Seconds to ignore after starting or after a step (loading hitches, the new size settling). */
  settleSeconds: number;
  /** Pixel-ratio caps to step through, highest first. */
  steps: readonly number[];
}

export class ResolutionGovernor {
  private slow = 0;
  private settle: number;

  constructor(private readonly params: ResolutionParams) {
    this.settle = params.settleSeconds;
  }

  /** Feed the time step and the current frame rate; true = time to lower the resolution. */
  update(dt: number, fps: number): boolean {
    const p = this.params;
    if (this.settle > 0) {
      this.settle -= dt;
      return false;
    }
    // Good frames pay back slow time twice as fast: only a sustained slowdown counts.
    this.slow = fps < p.lowFps ? this.slow + dt : Math.max(0, this.slow - dt * 2);
    if (this.slow < p.slowSeconds) return false;
    this.slow = 0;
    this.settle = p.settleSeconds;
    return true;
  }
}

/** The next cap below the pixel ratio in use, or null if it's already at the lowest step. */
export function nextResolutionStep(currentDpr: number, steps: readonly number[]): number | null {
  for (const s of steps) if (s < currentDpr - 1e-3) return s;
  return null;
}
