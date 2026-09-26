// Loads everything in the asset manifest with a progress bar, then fills any missing
// textures with generated placeholders.
import Phaser from 'phaser';
import { ASSET_MANIFEST } from '../config/assets';
import { SceneKeys } from '../config/keys';
import { GAME_HEIGHT, GAME_WIDTH, UI_FONT } from '../config/layout';
import { ensurePlaceholderTextures } from '../systems/PlaceholderArt';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKeys.Preload });
  }

  preload(): void {
    this.createProgressBar();

    for (const entry of ASSET_MANIFEST) {
      if (!entry.url) continue;
      switch (entry.type) {
        case 'image':
          this.load.image(entry.key, entry.url);
          break;
        case 'spritesheet':
          this.load.spritesheet(entry.key, entry.url, {
            frameWidth: entry.frameWidth,
            frameHeight: entry.frameHeight,
          });
          break;
      }
    }

    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[assets] failed to load "${file.key}" (${file.url}); using placeholder`);
    });
  }

  create(): void {
    const generated = ensurePlaceholderTextures(this);
    if (import.meta.env.DEV && generated.length > 0) {
      console.info(`[assets] placeholders generated: ${generated.join(', ')}`);
    }
    this.scene.start(SceneKeys.Menu);
  }

  private createProgressBar(): void {
    const w = 420;
    const h = 22;
    const x = (GAME_WIDTH - w) / 2;
    const y = GAME_HEIGHT / 2;

    this.add
      .text(GAME_WIDTH / 2, y - 40, 'Loading...', {
        fontFamily: UI_FONT,
        fontSize: '26px',
        color: '#e8fbff',
      })
      .setOrigin(0.5);
    const frame = this.add.graphics();
    frame.lineStyle(3, 0xe8fbff, 1).strokeRoundedRect(x - 4, y - 4, w + 8, h + 8, 8);
    const bar = this.add.graphics();

    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      bar
        .clear()
        .fillStyle(0x6ff3ff, 1)
        .fillRoundedRect(x, y, Math.max(h, w * value), h, 6);
    });
  }
}
