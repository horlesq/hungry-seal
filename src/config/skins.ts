// Seal skins: cosmetic only (same stats), bought on the Skins screen with coins or, for the
// premium ones, gems. The first is free and owned from the start. Art: one texture per skin
// (see systems/sealArt.ts).
import { TextureKeys, type TextureKey } from './assets';

export type SkinId =
  | 'harbor'
  | 'arctic'
  | 'sealion'
  | 'tropical'
  | 'leopard'
  | 'walrus'
  | 'elephant'
  | 'pirate'
  | 'golden';

export type Currency = 'coins' | 'gems';

export interface SkinDef {
  id: SkinId;
  name: string;
  description: string;
  texture: TextureKey;
  /** Price in `currency` (0 = free, owned from the start). */
  price: number;
  currency: Currency;
}

export const SKINS: readonly SkinDef[] = [
  {
    id: 'harbor',
    name: 'Harbor Seal',
    description: 'The classic spotted grey seal',
    texture: TextureKeys.Seal,
    price: 0,
    currency: 'coins',
  },
  {
    id: 'arctic',
    name: 'Arctic Pup',
    description: 'A fluffy white harp seal pup',
    texture: TextureKeys.SealArctic,
    price: 300,
    currency: 'coins',
  },
  {
    id: 'sealion',
    name: 'Sea Lion',
    description: 'Ear flaps and long front flippers',
    texture: TextureKeys.SealSeaLion,
    price: 450,
    currency: 'coins',
  },
  {
    id: 'tropical',
    name: 'Tropical Seal',
    description: 'A Hawaiian monk seal, flower lei included',
    texture: TextureKeys.SealTropical,
    price: 600,
    currency: 'coins',
  },
  {
    id: 'leopard',
    name: 'Leopard Seal',
    description: 'Spotted coat and a big toothy grin',
    texture: TextureKeys.SealLeopard,
    price: 800,
    currency: 'coins',
  },
  {
    id: 'walrus',
    name: 'Walrus',
    description: 'Tusks, whiskers and a lot of blubber',
    texture: TextureKeys.SealWalrus,
    price: 1000,
    currency: 'coins',
  },
  {
    id: 'elephant',
    name: 'Elephant Seal',
    description: 'The one with the famous nose',
    texture: TextureKeys.SealElephant,
    price: 1500,
    currency: 'coins',
  },
  {
    id: 'pirate',
    name: 'Pirate Seal',
    description: 'Bandana, eyepatch, no manners',
    texture: TextureKeys.SealPirate,
    price: 12,
    currency: 'gems',
  },
  {
    id: 'golden',
    name: 'Golden Seal',
    description: 'Shines even in the abyss',
    texture: TextureKeys.SealGolden,
    price: 20,
    currency: 'gems',
  },
];

export const DEFAULT_SKIN: SkinId = 'harbor';
export const SKIN_IDS: readonly SkinId[] = SKINS.map((s) => s.id);

export function skinDef(id: SkinId): SkinDef {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}
