// Screen-space layout, in design units. The visible area is at least 1280x720 design units
// and grows on the longer axis (see utils/viewport.ts), so anchor UI to edges using the
// current viewport rather than fixed coordinates, inset by the device safe area.
import { NO_INSETS, type Insets } from '../utils/viewport';

export const TOUCH_UI = {
  boostButton: {
    /** Distance of the button centre from the right/bottom edges (inside the safe area). */
    right: 118,
    bottom: 118,
    radius: 66,
    /** Touches that start within this radius count as boost, not steering. */
    hitRadius: 100,
  },
  pauseButton: {
    /** Distance of the button centre from the right/top edges (inside the safe area). */
    right: 54,
    top: 54,
    radius: 30,
    /** Touches that start within this radius pause instead of steering. */
    hitRadius: 50,
  },
} as const;

/** Boost button centre for a view of the given size (design units). */
export function boostButtonCenter(
  viewWidth: number,
  viewHeight: number,
  safe: Insets = NO_INSETS,
): { x: number; y: number } {
  const b = TOUCH_UI.boostButton;
  return { x: viewWidth - safe.right - b.right, y: viewHeight - safe.bottom - b.bottom };
}

/** Pause button centre (top-right corner of the HUD). */
export function pauseButtonCenter(
  viewWidth: number,
  safe: Insets = NO_INSETS,
): { x: number; y: number } {
  const b = TOUCH_UI.pauseButton;
  return { x: viewWidth - safe.right - b.right, y: safe.top + b.top };
}

/** The UI typeface (bundled via @fontsource, loaded before the game starts; see main.ts). */
export const UI_FONT =
  '"Baloo 2 Variable", "Baloo 2", "Trebuchet MS", "Arial Rounded MT Bold", sans-serif';
