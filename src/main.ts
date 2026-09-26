import Phaser from 'phaser';
import { createGameConfig } from './config/game';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { MenuScene } from './scenes/MenuScene';
import { PreloadScene } from './scenes/PreloadScene';

// Order matters for rendering: later scenes draw on top (Hud over Game, GameOver over both).
const game = new Phaser.Game(
  createGameConfig([BootScene, PreloadScene, MenuScene, GameScene, HudScene, GameOverScene]),
);

if (import.meta.env.DEV) {
  (window as unknown as { __PHASER_GAME__: Phaser.Game }).__PHASER_GAME__ = game;
}
