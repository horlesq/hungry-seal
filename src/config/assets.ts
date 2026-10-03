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
  MorayEel: 'creature-moray',
  ElectricEel: 'creature-eel-electric',
  Boat: 'boat-fishing',
  Net: 'hazard-net',
  Harpoon: 'hazard-harpoon',
  Crate: 'item-crate',
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
  // Map decorations (Blender-rendered, tools/blender/decor.py).
  DecorKelp: 'decor-kelp',
  DecorSeaweed: 'decor-seaweed',
  DecorCoralBranch: 'decor-coral-branch',
  DecorCoralBrain: 'decor-coral-brain',
  DecorCoralFan: 'decor-coral-fan',
  DecorAnemone: 'decor-anemone',
  DecorBoulder: 'decor-boulder',
  DecorStarfish: 'decor-starfish',
  DecorShell: 'decor-shell',
  DecorUrchin: 'decor-urchin',
  DecorAnchor: 'decor-anchor',
  DecorBarrel: 'decor-barrel',
  DecorShipwreck: 'decor-shipwreck',
  DecorLighthouse: 'decor-lighthouse',
  DecorPalm: 'decor-palm',
  DecorColumn: 'decor-column',
  DecorStatue: 'decor-statue',
  DecorIceChunk: 'decor-ice-chunk',
  DecorIcicle: 'decor-icicle',
  DecorIgloo: 'decor-igloo',
  DecorSkeleton: 'decor-skeleton',
  DecorVent: 'decor-vent',
  DecorClam: 'decor-clam',
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
  /** Eyes squeezed shut, "ouch" (stunned). */
  hurt: 14,
  frameCount: 15,
} as const;

/** Pixels per design unit of the Blender-rendered sheets (tools/blender). */
const SHEET_RES = 3;

/** A Blender-rendered animation sheet: `<key>-sheet.png`, frames of w x h design units. */
function sheet(
  key: TextureKey,
  w: number,
  h: number,
  file = `${key}-sheet.png`,
  res = SHEET_RES,
): AssetEntry {
  return {
    type: 'spritesheet',
    key,
    url: `assets/${file}`,
    resolution: res,
    frameWidth: w * res,
    frameHeight: h * res,
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
  [TextureKeys.DecorKelp]: 3,
  [TextureKeys.DecorSeaweed]: 3.5,
  [TextureKeys.DecorAnemone]: 3,
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
  sheet(TextureKeys.Chest, 64, 52),
  sheet(TextureKeys.ChestOpen, 64, 52),
  sheet(TextureKeys.MagnetOrb, 40, 40),
  sheet(TextureKeys.Shark, 220, 104),
  sheet(TextureKeys.Orca, 250, 120),
  sheet(TextureKeys.Anglerfish, 130, 96),
  sheet(TextureKeys.Jellyfish, 60, 80),
  sheet(TextureKeys.Mine, 68, 68),
  sheet(TextureKeys.Coin, 30, 30),
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
  sheet(TextureKeys.DecorKelp, 60, 260),
  sheet(TextureKeys.DecorSeaweed, 60, 80),
  sheet(TextureKeys.DecorCoralBranch, 90, 90),
  sheet(TextureKeys.DecorCoralBrain, 80, 56),
  sheet(TextureKeys.DecorCoralFan, 90, 100),
  sheet(TextureKeys.DecorAnemone, 64, 60),
  sheet(TextureKeys.DecorBoulder, 120, 80),
  sheet(TextureKeys.DecorStarfish, 40, 30),
  sheet(TextureKeys.DecorShell, 36, 30),
  sheet(TextureKeys.DecorUrchin, 40, 34),
  sheet(TextureKeys.DecorAnchor, 80, 100),
  sheet(TextureKeys.DecorBarrel, 50, 60),
  sheet(TextureKeys.DecorShipwreck, 900, 360, undefined, 2),
  sheet(TextureKeys.DecorLighthouse, 140, 300),
  sheet(TextureKeys.DecorPalm, 180, 260),
  sheet(TextureKeys.DecorColumn, 70, 220),
  sheet(TextureKeys.DecorStatue, 130, 160),
  sheet(TextureKeys.DecorIceChunk, 120, 80),
  sheet(TextureKeys.DecorIcicle, 40, 120),
  sheet(TextureKeys.DecorIgloo, 160, 100),
  sheet(TextureKeys.DecorSkeleton, 140, 60),
  sheet(TextureKeys.DecorVent, 80, 120),
  sheet(TextureKeys.DecorClam, 90, 60),
];
