import Phaser from 'phaser';
import type { Viewport } from '../utils/viewport';

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
    },
    scene: scenes,
  };
}
