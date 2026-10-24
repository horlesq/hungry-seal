import '@fontsource-variable/baloo-2';
import Phaser from 'phaser';
import { ASSET_MANIFEST } from './config/assets';
import { createGameConfig } from './config/game';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { MenuScene } from './scenes/MenuScene';
import { PauseScene } from './scenes/PauseScene';
import { PreloadScene } from './scenes/PreloadScene';
import { ShopScene } from './scenes/ShopScene';
import { SkinsScene } from './scenes/SkinsScene';
import { StatsScene } from './scenes/StatsScene';
import { MapScene } from './scenes/MapScene';
import { SettingsScene } from './scenes/SettingsScene';
import { EventBus } from './services/EventBus';
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
        SkinsScene,
        StatsScene,
        MapScene,
        GameScene,
        HudScene,
        GameOverScene,
        PauseScene,
        SettingsScene,
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
  game.events.once(Phaser.Core.Events.READY, () => {
    applyViewport(game);
    // The HTML loading screen (index.html) hands over to PreloadScene's progress bar.
    const boot = document.getElementById('boot');
    if (boot) {
      boot.style.opacity = '0';
      setTimeout(() => boot.remove(), 300);
    }
  });

  if (import.meta.env.DEV) {
    // Test hooks (playtest, soak, balance bot).
    const w = window as unknown as { __PHASER_GAME__: Phaser.Game; __EVENT_BUS__: unknown };
    w.__PHASER_GAME__ = game;
    w.__EVENT_BUS__ = EventBus;
  }
}

/**
 * Offline play and "install to home screen" (public/sw.js). Production only: in dev it would
 * cache modules Vite serves fresh on every reload.
 */
function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`./sw.js?v=${encodeURIComponent(__APP_VERSION__)}`)
      .then(() => navigator.serviceWorker.ready)
      // Once the title screen has loaded, cache what it used plus the art loaded on demand.
      .then((reg) =>
        setTimeout(() => reg.active?.postMessage({ type: 'precache', urls: offlineUrls() }), 2000),
      )
      .catch(() => undefined); // Embeds that don't allow it (some iframes) just play online.
  });
}

/** Every same-origin file the page has fetched so far, and every file in the asset manifest. */
function offlineUrls(): string[] {
  const urls = new Set<string>();
  for (const e of performance.getEntriesByType('resource')) {
    if (new URL(e.name).origin === location.origin) urls.add(e.name);
  }
  for (const entry of ASSET_MANIFEST) {
    if (entry.url) urls.add(new URL(entry.url, document.baseURI).href);
  }
  return [...urls];
}

registerServiceWorker();
void loadFonts().then(start);
