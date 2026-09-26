export const SceneKeys = {
  Boot: 'Boot',
  Preload: 'Preload',
  Menu: 'Menu',
  Game: 'Game',
  Hud: 'Hud',
  GameOver: 'GameOver',
} as const;

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

export const RegistryKeys = {
  Debug: 'debug',
} as const;
