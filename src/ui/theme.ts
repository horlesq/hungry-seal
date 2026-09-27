// Design tokens shared by every screen: palette, type and motion. Scenes create text through
// `uiText()` so sizes, weights and outlines stay consistent.
//
// Palette: deep-water inks for surfaces, sea-foam text, glacier cyan for progress and focus,
// gold for coins and score, coral for danger. Buoy orange is reserved for the one main action
// on a screen (Play, Swim again): it sits opposite the blues on the color wheel.
import Phaser from 'phaser';
import { UI_FONT } from '../config/layout';
import { uiTextResolution } from '../services/Viewport';

export const FONT_FAMILY = UI_FONT;

/** Numeric colors for Graphics fills and tints. */
export const COLORS = {
  /** Deep water: panels, outlines. */
  ink: 0x07284a,
  /** Raised ink: quiet buttons, wells. */
  inkRaised: 0x0f3d66,
  /** Darkest water: scrims, button edges, tracks. */
  trench: 0x041a31,
  /** Primary text on dark surfaces. */
  foam: 0xe9fbff,
  /** Secondary text. */
  mist: 0xa9cfe0,
  /** Progress, focus rings, secondary accents. */
  glacier: 0x7fe8f5,
  /** The main action on a screen. */
  buoy: 0xff6b35,
  buoyEdge: 0xb83a0c,
  /** Coins, score, purchases. */
  gold: 0xffc83d,
  goldEdge: 0xb9820b,
  /** Danger: low hunger, damage, not enough coins. */
  coral: 0xff4f6d,
  /** Healthy hunger. */
  kelp: 0x5fdc84,
} as const;

/** The same palette as CSS strings, for Text. */
export const CSS = {
  ink: '#07284a',
  trench: '#041a31',
  foam: '#e9fbff',
  mist: '#a9cfe0',
  glacier: '#7fe8f5',
  buoy: '#ff6b35',
  buoyEdge: '#b83a0c',
  gold: '#ffc83d',
  coral: '#ff4f6d',
  kelp: '#5fdc84',
  /** Gems (the rare currency). */
  gem: '#ff8ad0',
} as const;

/** Upgrade icon wells: one hue per upgrade so the shop scans at a glance. */
export const UPGRADE_HUES = {
  speed: 0x3fc1e0,
  belly: 0x5fdc84,
  metabolism: 0x9b8cff,
  boost: 0xffc83d,
  jaws: 0xff4f6d,
  magnet: 0xff8a3d,
  frenzy: 0xff6fd8,
} as const;

/** Chunky buttons sit on a darker edge this tall; pressing sinks the face onto it. */
export const BUTTON_DEPTH = 6;

/** Screen edge margin (design units), added to the device safe-area inset. */
export const EDGE = 24;

export type TextKind = 'title' | 'heading' | 'button' | 'number' | 'body' | 'caption';

interface TypeSpec {
  size: number;
  weight: number;
  color: string;
  /** Ink outline thickness (0 = none). */
  outline: number;
  /** Hard drop-shadow offset (0 = none). */
  shadow: number;
}

// Type scale (design units at 1280x720): roughly a 1.25 ratio from the 16px caption.
const TYPE: Record<TextKind, TypeSpec> = {
  title: { size: 64, weight: 800, color: CSS.foam, outline: 10, shadow: 5 },
  heading: { size: 28, weight: 800, color: CSS.foam, outline: 0, shadow: 0 },
  button: { size: 30, weight: 800, color: CSS.foam, outline: 0, shadow: 0 },
  number: { size: 44, weight: 800, color: CSS.foam, outline: 8, shadow: 3 },
  body: { size: 20, weight: 600, color: CSS.foam, outline: 0, shadow: 0 },
  caption: { size: 16, weight: 600, color: CSS.mist, outline: 0, shadow: 0 },
};

export interface TextOptions {
  size?: number;
  weight?: number;
  color?: string;
  outline?: number;
  outlineColor?: string;
  shadow?: number;
  shadowColor?: string;
  align?: 'left' | 'center' | 'right';
  /** Wrap width in design units. */
  wrap?: number;
  lineSpacing?: number;
}

/** Adds a Text in the shared type scale, rasterized sharp for the current zoom. */
export function uiText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  kind: TextKind,
  options: TextOptions = {},
): Phaser.GameObjects.Text {
  const spec = { ...TYPE[kind], ...options };
  // Phaser sizes the text canvas for the stroke but not the shadow: pad symmetrically so
  // the shadow isn't clipped and centred origins stay centred.
  const pad = spec.shadow;
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: FONT_FAMILY,
    fontSize: `${spec.size}px`,
    fontStyle: String(spec.weight),
    color: spec.color,
    stroke: options.outlineColor ?? CSS.ink,
    strokeThickness: spec.outline,
    align: options.align ?? 'left',
    padding: { x: 2, y: pad },
    resolution: uiTextResolution(),
  };
  if (options.wrap) style.wordWrap = { width: options.wrap, useAdvancedWrap: true };
  if (options.lineSpacing !== undefined) style.lineSpacing = options.lineSpacing;
  const t = scene.add.text(x, y, text, style);
  if (spec.shadow > 0) {
    t.setShadow(0, spec.shadow, options.shadowColor ?? CSS.ink, 0, spec.outline > 0, true);
  }
  return t;
}

/** Thousands separators for scores and coins ("12,450"). */
export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** Whether the player asked the OS for less motion (skip intros, count-ups, pulses). */
export function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export interface PanelStyle {
  radius?: number;
  fill?: number;
  alpha?: number;
  /** Hairline border alpha (0 = none). */
  line?: number;
  /** Solid darker edge under the panel (chunky, like the buttons). */
  depth?: number;
}

/** Draws a panel with its top-left at (x, y). */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  style: PanelStyle = {},
): Phaser.GameObjects.Graphics {
  const { radius = 24, fill = COLORS.ink, alpha = 0.86, line = 0.16, depth = 0 } = style;
  if (depth > 0) {
    g.fillStyle(COLORS.trench, Math.min(1, alpha + 0.1));
    g.fillRoundedRect(x, y + depth, w, h, radius);
  }
  g.fillStyle(fill, alpha).fillRoundedRect(x, y, w, h, radius);
  if (line > 0) g.lineStyle(2, COLORS.foam, line).strokeRoundedRect(x, y, w, h, radius);
  return g;
}
