// Current viewport + Phaser glue: measuring the window, resizing the game canvas, and fitting
// scene cameras. Scenes lay out in design units using `getViewport().viewWidth/viewHeight`.
import Phaser from 'phaser';
import {
  computeViewport,
  cssInsetsToDesign,
  NO_INSETS,
  textResolution,
  type Insets,
  type Viewport,
} from '../utils/viewport';

let current: Viewport = computeViewport(1280, 720, 1);
let safe: Insets = NO_INSETS;

export function getViewport(): Viewport {
  return current;
}

/** Device safe-area insets (notches, rounded corners, home bar) in design units. */
export function getSafeInsets(): Insets {
  return safe;
}

/** Reads the window size and pixel ratio and makes that the current viewport. */
export function measureViewport(): Viewport {
  current = computeViewport(window.innerWidth, window.innerHeight, window.devicePixelRatio);
  safe = cssInsetsToDesign(readSafeAreaCss(), current);
  return current;
}

/** CSS env(safe-area-inset-*) values, read through a hidden probe element. */
function readSafeAreaCss(): Insets {
  if (!document.body) return NO_INSETS;
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) ' +
    'env(safe-area-inset-bottom) env(safe-area-inset-left);';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const px = (v: string) => parseFloat(v) || 0;
  const insets = {
    top: px(cs.paddingTop),
    right: px(cs.paddingRight),
    bottom: px(cs.paddingBottom),
    left: px(cs.paddingLeft),
  };
  probe.remove();
  return insets;
}

/** Resizes the canvas to the current window (backing = device pixels, CSS = window size). */
export function applyViewport(game: Phaser.Game): void {
  const v = measureViewport();
  game.scale.resize(v.width, v.height);
  game.scale.setZoom(1 / v.dpr);
  game.registry.set('viewport', v);
}

/**
 * UI scenes (menu, HUD, results): camera shows design space [0..viewWidth] x [0..viewHeight].
 */
export function fitUiCamera(scene: Phaser.Scene): Viewport {
  const v = current;
  scene.cameras.main
    .setSize(v.width, v.height)
    .setZoom(v.zoom)
    .centerOn(v.viewWidth / 2, v.viewHeight / 2);
  return v;
}

/** World camera: same zoom, but it keeps following/scrolling as usual. */
export function fitWorldCamera(camera: Phaser.Cameras.Scene2D.Camera): Viewport {
  const v = current;
  camera.setSize(v.width, v.height).setZoom(v.zoom);
  return v;
}

/** Calls `fn` whenever the canvas is resized, until the scene shuts down. */
export function onResize(scene: Phaser.Scene, fn: () => void): void {
  scene.scale.on(Phaser.Scale.Events.RESIZE, fn);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off(Phaser.Scale.Events.RESIZE, fn);
  });
}

/** Resolution for new Text objects so they stay sharp at the current zoom. */
export function uiTextResolution(): number {
  return textResolution(current.zoom);
}

/**
 * Re-rasterizes every Text in the scene (including inside containers) at the current zoom.
 * Call at the end of create() and after a resize.
 */
export function sharpenTexts(scene: Phaser.Scene): void {
  const res = uiTextResolution();
  const visit = (objects: Phaser.GameObjects.GameObject[]) => {
    for (const obj of objects) {
      if (obj instanceof Phaser.GameObjects.Text) {
        if (obj.style.resolution !== res) obj.setResolution(res);
      } else if (obj instanceof Phaser.GameObjects.Container) {
        visit(obj.list);
      }
    }
  };
  visit(scene.children.list);
}

/** 1 / pixel density of a texture (placeholders are painted at 2x; see PlaceholderArt). */
export function textureScale(scene: Phaser.Scene, key: string): number {
  const data = scene.textures.get(key).customData as { resolution?: number };
  return 1 / (data.resolution ?? 1);
}
