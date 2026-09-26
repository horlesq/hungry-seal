// Asset manifest. Game code only ever uses the keys below.
//
// To swap a placeholder for real art: drop the file in public/assets/ and set its `url`.
// Any image entry without a url (or whose file fails to load) gets a generated placeholder
// texture under the same key, so nothing else has to change.

export const TextureKeys = {
  Seal: 'seal',
  Minnow: 'creature-minnow',
  Shrimp: 'creature-shrimp',
  Sardine: 'creature-sardine',
  Squid: 'creature-squid',
  Penguin: 'creature-penguin',
  Turtle: 'creature-turtle',
  Seabird: 'creature-seabird',
  Shark: 'predator-shark',
  Jellyfish: 'hazard-jellyfish',
  Mine: 'hazard-mine',
  Coin: 'item-coin',
  Spark: 'fx-spark',
  Vignette: 'ui-vignette',
  Arrow: 'ui-arrow',
  Bubble: 'fx-bubble',
  Droplet: 'fx-droplet',
  Ring: 'fx-ring',
  Glow: 'fx-glow',
  LightRays: 'fx-lightrays',
  Surface: 'fx-surface',
  Clouds: 'bg-clouds',
  SeabedFar: 'bg-seabed-far',
  SeabedNear: 'bg-seabed-near',
  SeabedGround: 'bg-seabed-ground',
  MarineSnow: 'bg-snow',
} as const;

export type TextureKey = (typeof TextureKeys)[keyof typeof TextureKeys];

/**
 * `resolution` = pixels per design unit of the file (default 1). Author art at ~2x its
 * on-screen size and set `resolution: 2` so it stays sharp when the camera zooms in.
 */
export type AssetEntry =
  | { type: 'image'; key: TextureKey; url?: string; resolution?: number }
  | {
      type: 'spritesheet';
      key: TextureKey;
      url?: string;
      resolution?: number;
      frameWidth: number;
      frameHeight: number;
    };

export const ASSET_MANIFEST: readonly AssetEntry[] = [
  { type: 'image', key: TextureKeys.Seal },
  { type: 'image', key: TextureKeys.Minnow },
  { type: 'image', key: TextureKeys.Shrimp },
  { type: 'image', key: TextureKeys.Sardine },
  { type: 'image', key: TextureKeys.Squid },
  { type: 'image', key: TextureKeys.Penguin },
  { type: 'image', key: TextureKeys.Turtle },
  { type: 'image', key: TextureKeys.Seabird },
  { type: 'image', key: TextureKeys.Shark },
  { type: 'image', key: TextureKeys.Jellyfish },
  { type: 'image', key: TextureKeys.Mine },
  { type: 'image', key: TextureKeys.Coin },
  { type: 'image', key: TextureKeys.Spark },
  { type: 'image', key: TextureKeys.Vignette },
  { type: 'image', key: TextureKeys.Arrow },
  { type: 'image', key: TextureKeys.Bubble },
  { type: 'image', key: TextureKeys.Droplet },
  { type: 'image', key: TextureKeys.Ring },
  { type: 'image', key: TextureKeys.Glow },
  { type: 'image', key: TextureKeys.LightRays },
  { type: 'image', key: TextureKeys.Surface },
  { type: 'image', key: TextureKeys.Clouds },
  { type: 'image', key: TextureKeys.SeabedFar },
  { type: 'image', key: TextureKeys.SeabedNear },
  { type: 'image', key: TextureKeys.SeabedGround },
  { type: 'image', key: TextureKeys.MarineSnow },
];
