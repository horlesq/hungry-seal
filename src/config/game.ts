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
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        // Variable step keeps motion smooth on 120/144 Hz displays.
        fixedStep: false,
        debug: false,
      },
    },
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
