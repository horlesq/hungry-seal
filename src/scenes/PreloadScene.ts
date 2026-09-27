// Loads everything in the asset manifest with a progress bar, then fills any missing
// textures with generated placeholders.
import Phaser from 'phaser';
import { ASSET_MANIFEST } from '../config/assets';
import { SceneKeys } from '../config/keys';
import { audio } from '../services/AudioManager';
import { fitUiCamera } from '../services/Viewport';
import { ensurePlaceholderTextures } from '../systems/PlaceholderArt';
import { COLORS, uiText } from '../ui/theme';
import { ensureUiTextures } from '../ui/uiTextures';
import { drawBar } from '../ui/widgets';

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
    // Real art declares its pixel density in the manifest (e.g. drawn at 2x = resolution 2).
    for (const entry of ASSET_MANIFEST) {
      if (entry.url && this.textures.exists(entry.key)) {
        const data = this.textures.get(entry.key).customData as { resolution?: number };
        data.resolution = entry.resolution ?? 1;
      }
    }
    const generated = ensurePlaceholderTextures(this);
    if (import.meta.env.DEV && generated.length > 0) {
      console.info(`[assets] placeholders generated: ${generated.join(', ')}`);
    }
    ensureUiTextures(this);
    audio.register(this.game);
    this.scene.start(SceneKeys.Menu);
  }

  private createProgressBar(): void {
    const v = fitUiCamera(this);
    const w = 360;
    const h = 14;
    const x = (v.viewWidth - w) / 2;
    const y = v.viewHeight / 2;

    uiText(this, v.viewWidth / 2, y - 34, 'Hungry Seal', 'heading', { size: 32 }).setOrigin(0.5);
    const bar = this.add.graphics();
    const draw = (value: number) => {
      bar.clear();
      drawBar(bar, x, y, w, h, value, COLORS.glacier);
    };
    draw(0);
    this.load.on(Phaser.Loader.Events.PROGRESS, draw);
  }
}
