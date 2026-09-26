// Screen-space layout, in design units. The visible area is at least 1280x720 design units
// and grows on the longer axis (see utils/viewport.ts), so anchor UI to edges using the
// current viewport rather than fixed coordinates.

export const TOUCH_UI = {
  boostButton: {
    /** Distance of the button centre from the right/bottom edges. */
    right: 118,
    bottom: 118,
    radius: 66,
    /** Touches that start within this radius count as boost, not steering. */
    hitRadius: 100,
  },
} as const;

/** Boost button centre for a view of the given size (design units). */
export function boostButtonCenter(viewWidth: number, viewHeight: number): { x: number; y: number } {
  const b = TOUCH_UI.boostButton;
  return { x: viewWidth - b.right, y: viewHeight - b.bottom };
}

export const UI_FONT = '"Trebuchet MS", "Arial Rounded MT Bold", Arial, sans-serif';
