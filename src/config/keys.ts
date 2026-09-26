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
  /** No hazards or predators (URL `?calm`), for movement testing and tuning. */
  Calm: 'calm',
} as const;
