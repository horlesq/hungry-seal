export const SceneKeys = {
  Boot: 'Boot',
  Preload: 'Preload',
  Menu: 'Menu',
  Game: 'Game',
  Hud: 'Hud',
  GameOver: 'GameOver',
  Pause: 'Pause',
  Shop: 'Shop',
  Skins: 'Skins',
  Stats: 'Stats',
  Maps: 'Maps',
  Settings: 'Settings',
} as const;

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

export const RegistryKeys = {
  Debug: 'debug',
  /** No hazards or predators (URL `?calm`), for movement testing and tuning. */
  Calm: 'calm',
  CanvasTerrain: 'canvasTerrain',
} as const;
