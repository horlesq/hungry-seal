// Viewport math (pure, no Phaser).
//
// The canvas is rendered at the device's real pixel size (CSS size x devicePixelRatio, capped)
// so everything is sharp, and cameras zoom so the DESIGN area (1280x720) always fits. The
// longer screen axis simply shows more of the world: no letterbox bars on any aspect ratio.
//
// Phones and tablets (`mobile`) differ in two ways; desktop is unaffected:
// - The world camera zooms out a bit (MOBILE_WORLD_SCALE): the same view as a monitor feels
//   cramped on a small screen.
// - Held upright, the UI fits a portrait 720x1280 design area instead, so text and buttons
//   stay as big as in landscape rather than shrinking to fit 1280 units across.

export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;
/** Higher DPRs cost fill-rate for little visible gain. */
export const MAX_DPR = 2;
/** World camera zoom relative to the UI zoom on phones/tablets (< 1 = see more ocean). */
export const MOBILE_WORLD_SCALE = 0.85;

export interface Viewport {
  /** Canvas backing size in device pixels. */
  width: number;
  height: number;
  /** Effective device pixel ratio used (clamped). */
  dpr: number;
  /** UI camera zoom: device pixels per design unit. */
  zoom: number;
  /** World camera zoom before the growth-stage zoom-out (== zoom on desktop). */
  worldZoom: number;
  /** Phone/tablet held upright: UI laid out for a portrait design area. */
  portrait: boolean;
  /** Visible UI area in design units (fits 1280x720, or 720x1280 in portrait). */
  viewWidth: number;
  viewHeight: number;
}

export function computeViewport(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  mobile = false,
): Viewport {
  const ratio = Number.isFinite(dpr) && dpr > 0 ? Math.min(dpr, MAX_DPR) : 1;
  const width = Math.max(1, Math.round(Math.max(1, cssWidth) * ratio));
  const height = Math.max(1, Math.round(Math.max(1, cssHeight) * ratio));
  const portrait = mobile && height > width;
  const zoom = portrait
    ? Math.min(width / DESIGN_HEIGHT, height / DESIGN_WIDTH)
    : Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
  return {
    width,
    height,
    dpr: ratio,
    zoom,
    worldZoom: zoom * (mobile ? MOBILE_WORLD_SCALE : 1),
    portrait,
    viewWidth: width / zoom,
    viewHeight: height / zoom,
  };
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Converts CSS-pixel insets (e.g. the notch safe area) to design units for a viewport. */
export function cssInsetsToDesign(css: Insets, v: Viewport): Insets {
  const k = v.dpr / v.zoom;
  return { top: css.top * k, right: css.right * k, bottom: css.bottom * k, left: css.left * k };
}

/** Text is rasterized at this multiple of its size so it stays sharp under camera zoom. */
export function textResolution(zoom: number): number {
  return Math.min(4, Math.max(1, Math.ceil(zoom * 2) / 2));
}
