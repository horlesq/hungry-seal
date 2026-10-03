// Asset manifest. Game code only ever uses the keys below.
//
// To swap a placeholder for real art: drop the file in public/assets/ and set its `url`.
// Any image entry without a url (or whose file fails to load) gets a generated placeholder
// texture under the same key, so nothing else has to change.

export const TextureKeys = {
  /** The default (harbor seal) skin; other skins below. */
  Seal: 'seal',
  SealArctic: 'seal-arctic',
  SealSeaLion: 'seal-sealion',
  SealTropical: 'seal-tropical',
  SealLeopard: 'seal-leopard',
  SealWalrus: 'seal-walrus',
  SealElephant: 'seal-elephant',
  SealPirate: 'seal-pirate',
  SealGolden: 'seal-golden',
  Minnow: 'creature-minnow',
  Shrimp: 'creature-shrimp',
  Sardine: 'creature-sardine',
  Squid: 'creature-squid',
  Penguin: 'creature-penguin',
  Turtle: 'creature-turtle',
  Seabird: 'creature-seabird',
  Pufferfish: 'creature-pufferfish',
  PufferfishPuffed: 'creature-pufferfish-puffed',
  Crab: 'creature-crab',
  Lanternfish: 'creature-lanternfish',
  Darkness: 'fx-darkness',
  Chest: 'item-chest',
  ChestOpen: 'item-chest-open',
  MagnetOrb: 'item-magnet',
  Shark: 'predator-shark',
  Orca: 'predator-orca',
  Anglerfish: 'predator-anglerfish',
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

/**
 * Frame layout of an animated seal sheet (rendered by tools/blender/seal.py). Skins drawn as a
 * single image fall back to the squash-and-wiggle effects.
 */
export const SEAL_SHEET = {
  /** One full swim undulation. */
  swim: [0, 1, 2, 3, 4, 5, 6, 7],
  /** Mouth opening, from slightly to fully open. */
  bite: [8, 9, 10],
  /** Turning toward the camera: 22.5, 45 and 67.5 degrees (mirrored for the second half). */
  turn: [11, 12, 13],
  frameCount: 14,
} as const;

/** Pixels per design unit of the Blender-rendered sheets (tools/blender). */
const SHEET_RES = 3;

/** A Blender-rendered animation sheet: `<key>-sheet.png`, frames of w x h design units. */
function sheet(key: TextureKey, w: number, h: number, file = `${key}-sheet.png`): AssetEntry {
  return {
    type: 'spritesheet',
    key,
    url: `assets/${file}`,
    resolution: SHEET_RES,
    frameWidth: w * SHEET_RES,
    frameHeight: h * SHEET_RES,
  };
}

/** Seal skins share one frame size and the SEAL_SHEET layout. */
const sealSheet = (key: TextureKey, file?: string) => sheet(key, 176, 88, file);

/**
 * Looping animation speed (frames per second) of creature sheets; anything not listed plays
 * at DEFAULT_ANIM_FPS. A texture with a single frame doesn't animate.
 */
export const ANIM_FPS: Partial<Record<TextureKey, number>> = {
  [TextureKeys.Seabird]: 9,
  [TextureKeys.Turtle]: 5,
  [TextureKeys.Jellyfish]: 4,
  [TextureKeys.PufferfishPuffed]: 5,
  [TextureKeys.Orca]: 7,
};
export const DEFAULT_ANIM_FPS = 8;

export const ASSET_MANIFEST: readonly AssetEntry[] = [
  sealSheet(TextureKeys.Seal, 'seal-sheet.png'),
  sealSheet(TextureKeys.SealArctic),
  sealSheet(TextureKeys.SealSeaLion),
  sealSheet(TextureKeys.SealTropical),
  sealSheet(TextureKeys.SealLeopard),
  sealSheet(TextureKeys.SealWalrus),
  sealSheet(TextureKeys.SealElephant),
  sealSheet(TextureKeys.SealPirate),
  sealSheet(TextureKeys.SealGolden),
  sheet(TextureKeys.Minnow, 48, 26),
  sheet(TextureKeys.Shrimp, 44, 32),
  sheet(TextureKeys.Sardine, 60, 26),
  sheet(TextureKeys.Squid, 70, 36),
  sheet(TextureKeys.Penguin, 60, 34),
  sheet(TextureKeys.Turtle, 86, 58),
  sheet(TextureKeys.Seabird, 72, 44),
  sheet(TextureKeys.Pufferfish, 40, 32),
  sheet(TextureKeys.PufferfishPuffed, 40, 40),
  sheet(TextureKeys.Crab, 52, 36),
  sheet(TextureKeys.Lanternfish, 38, 20),
  { type: 'image', key: TextureKeys.Darkness },
  { type: 'image', key: TextureKeys.Chest },
  { type: 'image', key: TextureKeys.ChestOpen },
  { type: 'image', key: TextureKeys.MagnetOrb },
  sheet(TextureKeys.Shark, 220, 104),
  sheet(TextureKeys.Orca, 250, 120),
  sheet(TextureKeys.Anglerfish, 130, 96),
  sheet(TextureKeys.Jellyfish, 60, 80),
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
