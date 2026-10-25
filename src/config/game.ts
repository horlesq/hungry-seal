import Phaser from 'phaser';
import type { ResolutionParams } from '../utils/resolution';
import type { Viewport } from '../utils/viewport';

/**
 * Adaptive resolution (utils/resolution.ts): a run that stays under lowFps for slowSeconds
 * renders at the next lower pixel ratio, for the session. A step that doesn't raise the frame
 * rate by minGain (a battery saver capping it at 30 fps) is undone and the feature turns off.
 */
export const ADAPTIVE_RESOLUTION: ResolutionParams = {
  lowFps: 45,
  slowSeconds: 4,
  settleSeconds: 4,
  judgeSeconds: 2,
  minGain: 1.15,
  steps: [2, 1.5, 1.25, 1],
};

/**
 * The canvas backing store is sized in device pixels (sharp on hi-DPI screens) and shown at
 * CSS size via `zoom = 1 / dpr`. Scale mode NONE: main.ts resizes it on window resize, and
 * scenes zoom their cameras to fit the 1280x720 design area (see services/Viewport.ts).
 */
export function createGameConfig(
  scenes: Phaser.Types.Scenes.SceneType[],
  viewport: Viewport,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#041425',
    scale: {
      mode: Phaser.Scale.NONE,
      width: viewport.width,
      height: viewport.height,
      zoom: 1 / viewport.dpr,
    },
    // No physics plugin: every mover (seal, creatures) runs its own kinematic motion model
    // and contacts are circle checks (see systems/feeding.ts). Add Arcade back if a feature
    // ever needs real collision response.
    input: {
      // Mouse + up to 3 simultaneous touches (steer + boost + spare).
      activePointers: 3,
    },
    render: {
      antialias: true,
      pixelArt: false,
      // WebGL Graphics cut every arc into 100 points and triangulate them each frame; merging
      // points closer than 3 screen px keeps rounded HUD panels and buttons smooth for a
      // fraction of the cost (it was ~40% of a phone's frame).
      pathDetailThreshold: 3,
    },
    scene: scenes,
  };
}
