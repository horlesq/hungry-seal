// Loads the asset manifest with a progress bar (except lazy entries: skins you don't wear and
// bosses, see services/LazyTextures.ts), then fills any missing textures with generated
// placeholders.
import Phaser from 'phaser';
import { ASSET_MANIFEST } from '../config/assets';
import { SceneKeys } from '../config/keys';
import { skinDef } from '../config/skins';
import { audio } from '../services/AudioManager';
import { finishEntry, LAZY_KEYS, queueEntry } from '../services/LazyTextures';
import { saves } from '../services/SaveService';
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

    for (const entry of this.bootEntries()) queueEntry(this.load, entry);

    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[assets] failed to load "${file.key}" (${file.url}); using placeholder`);
    });
  }

  create(): void {
    // Real art declares its pixel density in the manifest (e.g. drawn at 2x = resolution 2);
    // anything that failed gets its placeholder.
    for (const entry of this.bootEntries()) finishEntry(this, entry);
    const generated = ensurePlaceholderTextures(this, LAZY_KEYS);
    if (import.meta.env.DEV && generated.length > 0) {
      console.info(`[assets] placeholders generated: ${generated.join(', ')}`);
    }
    ensureUiTextures(this);
    audio.register(this.game);
    this.scene.start(SceneKeys.Menu);
  }

  /** Everything but the lazy entries, plus the skin the seal is wearing. */
  private bootEntries() {
    const skin = skinDef(saves.data.skins.equipped).texture;
    return ASSET_MANIFEST.filter((e) => !e.lazy || e.key === skin);
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
