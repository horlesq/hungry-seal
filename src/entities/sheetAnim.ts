// Looping frame playback for the Blender-rendered creature sheets. Textures with a single
// frame (placeholders, static art) are left alone.
import type Phaser from 'phaser';
import { ANIM_FPS, DEFAULT_ANIM_FPS, type TextureKey } from '../config/assets';

/** Shows the frame for `time` seconds into the loop of the sprite's current texture. */
export function loopFrames(sprite: Phaser.GameObjects.Sprite, time: number): void {
  const texture = sprite.texture;
  const count = texture.frameTotal - 1; // minus the whole-texture __BASE frame
  if (count <= 1) return;
  const fps = ANIM_FPS[texture.key as TextureKey] ?? DEFAULT_ANIM_FPS;
  const frame = Math.floor(time * fps) % count;
  if (sprite.frame.name !== String(frame)) sprite.setFrame(frame);
}
