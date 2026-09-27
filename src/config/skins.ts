// Seal skins: cosmetic only (same stats), bought with coins on the Skins screen. The first
// one is free and owned from the start. Art: one texture per skin (see systems/sealArt.ts).
import { TextureKeys, type TextureKey } from './assets';

export type SkinId =
  'harbor' | 'arctic' | 'sealion' | 'tropical' | 'leopard' | 'walrus' | 'elephant';

export interface SkinDef {
  id: SkinId;
  name: string;
  description: string;
  texture: TextureKey;
  /** Coin price (0 = free, owned from the start). */
  price: number;
}

export const SKINS: readonly SkinDef[] = [
  {
    id: 'harbor',
    name: 'Harbor Seal',
    description: 'The classic spotted grey seal',
    texture: TextureKeys.Seal,
    price: 0,
  },
  {
    id: 'arctic',
    name: 'Arctic Pup',
    description: 'A fluffy white harp seal pup',
    texture: TextureKeys.SealArctic,
    price: 300,
  },
  {
    id: 'sealion',
    name: 'Sea Lion',
    description: 'Ear flaps and long front flippers',
    texture: TextureKeys.SealSeaLion,
    price: 450,
  },
  {
    id: 'tropical',
    name: 'Tropical Seal',
    description: 'A Hawaiian monk seal, flower lei included',
    texture: TextureKeys.SealTropical,
    price: 600,
  },
  {
    id: 'leopard',
    name: 'Leopard Seal',
    description: 'Spotted coat and a big toothy grin',
    texture: TextureKeys.SealLeopard,
    price: 800,
  },
  {
    id: 'walrus',
    name: 'Walrus',
    description: 'Tusks, whiskers and a lot of blubber',
    texture: TextureKeys.SealWalrus,
    price: 1000,
  },
  {
    id: 'elephant',
    name: 'Elephant Seal',
    description: 'The one with the famous nose',
    texture: TextureKeys.SealElephant,
    price: 1500,
  },
];

export const DEFAULT_SKIN: SkinId = 'harbor';
export const SKIN_IDS: readonly SkinId[] = SKINS.map((s) => s.id);

export function skinDef(id: SkinId): SkinDef {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}
