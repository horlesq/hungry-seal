import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './layout';

export function createGameConfig(
  scenes: Phaser.Types.Scenes.SceneType[],
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#041425',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
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
