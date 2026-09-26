// Title screen (placeholder until the Phase 4 menu): tap/click/any key to start.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { SceneKeys } from '../config/keys';
import { GAME_HEIGHT, GAME_WIDTH, UI_FONT } from '../config/layout';

export class MenuScene extends Phaser.Scene {
  private started = false;

  constructor() {
    super({ key: SceneKeys.Menu });
  }

  create(): void {
    this.started = false;
    const cx = GAME_WIDTH / 2;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x2ac6d8, 0x2ac6d8, 0x0c3f7a, 0x0c3f7a, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // Rays fade out within one texture height; don't tile them vertically.
    const rays = this.textures.getFrame(TextureKeys.LightRays);
    this.add
      .tileSprite(cx, 0, GAME_WIDTH, rays.height, TextureKeys.LightRays)
      .setOrigin(0.5, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.3);

    const seal = this.add.image(cx, 330, TextureKeys.Seal).setScale(1.6);
    this.tweens.add({
      targets: seal,
      y: 350,
      angle: { from: -4, to: 4 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    this.add
      .text(cx, 150, 'HUNGRY SEAL', {
        fontFamily: UI_FONT,
        fontSize: '84px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#0b3a66',
        strokeThickness: 12,
      })
      .setOrigin(0.5);

    const touch = this.sys.game.device.input.touch;
    const prompt = this.add
      .text(cx, 500, touch ? 'Tap to swim' : 'Click or press any key to swim', {
        fontFamily: UI_FONT,
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#fff6b0',
        stroke: '#0b3a66',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });

    const help = touch
      ? 'Hold & drag to steer   •   BOOST button to dash'
      : 'Mouse or WASD / arrows to steer   •   Click, Space or Shift to boost   •   ` debug';
    this.add
      .text(cx, 590, help, {
        fontFamily: UI_FONT,
        fontSize: '20px',
        color: '#e8fbff',
        align: 'center',
      })
      .setOrigin(0.5);

    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.startGame());
    this.input.keyboard!.once('keydown', () => this.startGame());
  }

  private startGame(): void {
    if (this.started) return;
    this.started = true;
    this.cameras.main.fadeOut(250, 4, 20, 37);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SceneKeys.Game);
    });
  }
}
