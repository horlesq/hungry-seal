// Title screen: Play, Shop, Sound toggle, best score / coins, controls help.
// Keys: Enter/Space = play, S = shop, M = mute.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { SceneKeys } from '../config/keys';
import { UI_FONT } from '../config/layout';
import { audio } from '../services/AudioManager';
import { saves } from '../services/SaveService';
import { fitUiCamera, onResize, sharpenTexts, textureScale } from '../services/Viewport';
import { Button } from '../ui/Button';
import { DESIGN_HEIGHT } from '../utils/viewport';

export class MenuScene extends Phaser.Scene {
  private leaving = false;

  constructor() {
    super({ key: SceneKeys.Menu });
  }

  create(): void {
    this.leaving = false;
    audio.startMusic();
    const v = fitUiCamera(this);
    const cx = v.viewWidth / 2;
    // Content is authored for a 720-tall column, centered in taller views.
    const top = (v.viewHeight - DESIGN_HEIGHT) / 2;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x2ac6d8, 0x2ac6d8, 0x0c3f7a, 0x0c3f7a, 1);
    bg.fillRect(0, 0, v.viewWidth, v.viewHeight);
    // Rays fade out within one texture height; don't tile them vertically.
    const raysScale = textureScale(this, TextureKeys.LightRays);
    const rays = this.textures.getFrame(TextureKeys.LightRays);
    this.add
      .tileSprite(cx, 0, v.viewWidth, rays.height * raysScale, TextureKeys.LightRays)
      .setTileScale(raysScale, raysScale)
      .setOrigin(0.5, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.3);

    this.add
      .text(cx, top + 105, 'HUNGRY SEAL', {
        fontFamily: UI_FONT,
        fontSize: '84px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#0b3a66',
        strokeThickness: 12,
      })
      .setOrigin(0.5);

    const seal = this.add
      .image(cx, top + 255, TextureKeys.Seal)
      .setScale(1.4 * textureScale(this, TextureKeys.Seal));
    this.tweens.add({
      targets: seal,
      y: top + 272,
      angle: { from: -4, to: 4 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    const play = new Button(this, cx, top + 405, {
      width: 320,
      height: 88,
      label: 'PLAY',
      fontSize: 44,
      color: 0x33c46b,
      onClick: () => this.leave(SceneKeys.Game),
    });
    this.tweens.add({ targets: play, scale: 1.04, duration: 700, yoyo: true, repeat: -1 });

    const shop = new Button(this, cx - 125, top + 505, {
      width: 230,
      height: 64,
      label: 'SHOP',
      color: 0xf2b134,
      onClick: () => this.leave(SceneKeys.Shop),
    });
    const sound = new Button(this, cx + 125, top + 505, {
      width: 230,
      height: 64,
      label: this.soundLabel(),
      color: 0x5d7fa6,
      onClick: () => {
        audio.toggleMuted();
        sound.setLabel(this.soundLabel());
        if (!audio.muted) audio.startMusic();
      },
    });

    const save = saves.data;
    if (save.runs > 0) {
      this.add
        .text(cx, top + 580, `Best ${save.bestScore}   •   Coins ${save.coins}`, {
          fontFamily: UI_FONT,
          fontSize: '24px',
          fontStyle: 'bold',
          color: '#fff27a',
          stroke: '#0b3a66',
          strokeThickness: 6,
        })
        .setOrigin(0.5);
    }

    const touch = this.sys.game.device.input.touch;
    const help = touch
      ? 'Hold & drag to steer   •   BOOST button to dash'
      : 'Mouse or WASD / arrows to steer   •   Click, Space or Shift to boost';
    this.add
      .text(cx, top + 650, help, {
        fontFamily: UI_FONT,
        fontSize: '20px',
        color: '#e8fbff',
        align: 'center',
      })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on('keydown-ENTER', () => play.press());
    kb.on('keydown-SPACE', () => play.press());
    kb.on('keydown-S', () => shop.press());
    kb.on('keydown-M', () => sound.press());

    sharpenTexts(this);
    onResize(this, () => {
      if (!this.leaving) this.scene.restart();
    });
  }

  private soundLabel(): string {
    return audio.muted ? 'SOUND: OFF' : 'SOUND: ON';
  }

  private leave(target: typeof SceneKeys.Game | typeof SceneKeys.Shop): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(250, 4, 20, 37);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(target);
    });
  }
}
