// Asset manifest. Game code only ever uses the keys below.
//
// To swap a placeholder for real art: drop the file in public/assets/ and set its `url`.
// Any image entry without a url (or whose file fails to load) gets a generated placeholder
// texture under the same key, so nothing else has to change.

export const TextureKeys = {
  Seal: 'seal',
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

export type AssetEntry =
  | { type: 'image'; key: TextureKey; url?: string }
  | {
      type: 'spritesheet';
      key: TextureKey;
      url?: string;
      frameWidth: number;
      frameHeight: number;
    };

export const ASSET_MANIFEST: readonly AssetEntry[] = [
  { type: 'image', key: TextureKeys.Seal },
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
