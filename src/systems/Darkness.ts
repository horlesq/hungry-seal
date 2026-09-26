// Deep water gets dark. A huge soft-edged overlay follows the seal: clear in a circle around
// it (the seal's "light") and dark beyond, with the darkness rising with depth. Glowing
// things (Depths.Glow) draw above it so lures, lanternfish and hazard lights stay visible.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { Depths } from '../config/depths';
import { darknessAt } from '../config/zones';
import { damp } from '../utils/math';

/** Overlay size in world units: big enough to cover the view around the seal at any zoom. */
const SIZE = 3600;

export class Darkness {
  private readonly overlay: Phaser.GameObjects.Image;
  private level = 0;

  constructor(scene: Phaser.Scene) {
    this.overlay = scene.add
      .image(0, 0, TextureKeys.Darkness)
      .setDisplaySize(SIZE, SIZE)
      .setDepth(Depths.Darkness)
      .setAlpha(0);
  }

  update(dt: number, x: number, y: number): void {
    // Smooth so a leap or a hit doesn't flicker the light.
    this.level = damp(this.level, darknessAt(y), 3, dt);
    this.overlay
      .setPosition(x, y)
      .setAlpha(this.level)
      .setVisible(this.level > 0.01);
  }
}
