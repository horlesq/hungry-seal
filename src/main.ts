import '@fontsource-variable/baloo-2';
import Phaser from 'phaser';
import { createGameConfig } from './config/game';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { MenuScene } from './scenes/MenuScene';
import { PauseScene } from './scenes/PauseScene';
import { PreloadScene } from './scenes/PreloadScene';
import { ShopScene } from './scenes/ShopScene';
import { applyViewport, measureViewport } from './services/Viewport';

/** Don't hold the game back forever if the font can't load (it falls back to system fonts). */
const FONT_TIMEOUT_MS = 3000;

/**
 * Canvas text only uses a web font that has already loaded, so fetch the UI font before any
 * scene draws text (Phaser rasterizes Text once, when it's created).
 */
async function loadFonts(): Promise<void> {
  if (!document.fonts?.load) return;
  const fonts = Promise.all([
    document.fonts.load('800 32px "Baloo 2 Variable"'),
    document.fonts.load('600 32px "Baloo 2 Variable"'),
  ]);
  const timeout = new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS));
  await Promise.race([fonts, timeout]).catch(() => undefined);
}

function start(): void {
  // Order matters for rendering: later scenes draw on top (Hud over Game, overlays over both).
  const game = new Phaser.Game(
    createGameConfig(
      [
        BootScene,
        PreloadScene,
        MenuScene,
        ShopScene,
        GameScene,
        HudScene,
        GameOverScene,
        PauseScene,
      ],
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
}

void loadFonts().then(start);
