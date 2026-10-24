// Textures loaded when a screen needs them instead of at boot (manifest entries with `lazy`):
// the seal skins you aren't wearing (the Skins screen loads them) and the bosses (a run loads
// its map's boss). They're half the art: boot downloads less, and phones keep ~80 MB less in
// GPU memory because the screens that loaded them release them again.
//
// In a scene: queueTextures() from preload(), finishTextures() at the top of create().
import Phaser from 'phaser';
import { ASSET_MANIFEST, type AssetEntry, type TextureKey } from '../config/assets';
import { paintPlaceholder } from '../systems/PlaceholderArt';

const ENTRIES = new Map<TextureKey, AssetEntry>(ASSET_MANIFEST.map((e) => [e.key, e]));

/** Manifest keys that boot doesn't load. */
export const LAZY_KEYS: ReadonlySet<TextureKey> = new Set(
  ASSET_MANIFEST.filter((e) => e.lazy).map((e) => e.key),
);

/** Adds a manifest entry to a loader (entries without a url get a placeholder instead). */
export function queueEntry(load: Phaser.Loader.LoaderPlugin, entry: AssetEntry): void {
  if (!entry.url) return;
  if (entry.type === 'image') load.image(entry.key, entry.url);
  else
    load.spritesheet(entry.key, entry.url, {
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
    });
}

/** After loading: tags the texture with its pixel density, or paints a placeholder if it failed. */
export function finishEntry(scene: Phaser.Scene, entry: AssetEntry): void {
  if (!scene.textures.exists(entry.key)) {
    paintPlaceholder(scene, entry.key);
    return;
  }
  const data = scene.textures.get(entry.key).customData as { resolution?: number };
  // Placeholders set their own density; only tag real files.
  if (entry.url && data.resolution === undefined) data.resolution = entry.resolution ?? 1;
}

/** Queues the textures that aren't loaded yet on the scene's loader. Returns how many. */
export function queueTextures(scene: Phaser.Scene, keys: readonly TextureKey[]): number {
  let queued = 0;
  for (const key of keys) {
    const entry = ENTRIES.get(key);
    if (!entry?.url || scene.textures.exists(key)) continue;
    queueEntry(scene.load, entry);
    queued++;
  }
  return queued;
}

/** Call once the queued textures have loaded (or failed): see finishEntry. */
export function finishTextures(scene: Phaser.Scene, keys: readonly TextureKey[]): void {
  for (const key of keys) {
    const entry = ENTRIES.get(key);
    if (entry) finishEntry(scene, entry);
  }
}

/**
 * Frees lazy textures (GPU memory on phones). Only call it for textures nothing on screen
 * uses any more; `keep` stays loaded.
 */
export function releaseTextures(
  scene: Phaser.Scene,
  keys: readonly TextureKey[],
  keep: readonly TextureKey[] = [],
): void {
  for (const key of keys) {
    if (LAZY_KEYS.has(key) && !keep.includes(key) && scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
  }
}
