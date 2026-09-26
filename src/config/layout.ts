// Screen-space layout in design pixels (the 1280x720 game size).

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const TOUCH_UI = {
  boostButton: {
    x: GAME_WIDTH - 118,
    y: GAME_HEIGHT - 118,
    radius: 66,
    /** Touches that start within this radius count as boost, not steering. */
    hitRadius: 100,
  },
} as const;

export const UI_FONT = '"Trebuchet MS", "Arial Rounded MT Bold", Arial, sans-serif';
