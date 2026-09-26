import Phaser from 'phaser';
import { createGameConfig } from './config/game';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { MenuScene } from './scenes/MenuScene';
import { PreloadScene } from './scenes/PreloadScene';
import { ShopScene } from './scenes/ShopScene';
import { applyViewport, measureViewport } from './services/Viewport';

// Order matters for rendering: later scenes draw on top (Hud over Game, GameOver over both).
const game = new Phaser.Game(
  createGameConfig(
    [BootScene, PreloadScene, MenuScene, ShopScene, GameScene, HudScene, GameOverScene],
    measureViewport(),
  ),
);

// Keep the canvas matched to the window (and pixel ratio, e.g. when dragged to another
// monitor or the browser zoom changes).
let resizeQueued = false;
const onResize = () => {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => {
    resizeQueued = false;
    applyViewport(game);
  });
};
window.addEventListener('resize', onResize);
window.visualViewport?.addEventListener('resize', onResize);
game.events.once(Phaser.Core.Events.READY, () => applyViewport(game));

if (import.meta.env.DEV) {
  (window as unknown as { __PHASER_GAME__: Phaser.Game }).__PHASER_GAME__ = game;
}
