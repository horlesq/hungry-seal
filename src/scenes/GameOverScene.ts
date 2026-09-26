// Run results, shown over the (still animating) game world. Retry restarts GameScene;
// Esc goes back to the menu. Phase 3 adds coins, distance and best score.
import Phaser from 'phaser';
import { SceneKeys } from '../config/keys';
import { GAME_HEIGHT, GAME_WIDTH, UI_FONT } from '../config/layout';
import type { RunResult } from '../services/EventBus';

/** Ignore input briefly so a finger still held from the run doesn't skip the screen. */
const INPUT_DELAY = 700;

export class GameOverScene extends Phaser.Scene {
  private leaving = false;

  constructor() {
    super({ key: SceneKeys.GameOver });
  }

  create(result: RunResult): void {
    this.leaving = false;
    const cx = GAME_WIDTH / 2;

    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x020c18, 1).setOrigin(0);
    dim.setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 0.6, duration: 400 });

    const panel = this.add.container(cx, GAME_HEIGHT / 2);
    const bg = this.add.graphics();
    bg.fillStyle(0x06284a, 0.92).fillRoundedRect(-300, -210, 600, 420, 28);
    bg.lineStyle(4, 0x6ff3ff, 0.9).strokeRoundedRect(-300, -210, 600, 420, 28);
    const title = this.add
      .text(0, -160, 'STARVED!', {
        fontFamily: UI_FONT,
        fontSize: '64px',
        fontStyle: 'bold',
        color: '#ff8a5c',
        stroke: '#2a0d06',
        strokeThickness: 10,
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(0, -108, 'Your seal ran out of food', {
        fontFamily: UI_FONT,
        fontSize: '20px',
        color: '#cfe9f5',
      })
      .setOrigin(0.5);
    panel.add([bg, title, subtitle]);

    const rows: Array<[string, string]> = [
      ['Score', String(result.score)],
      ['Time', formatTime(result.seconds)],
      ['Fish eaten', String(result.eaten)],
      ['Size reached', String(result.stage)],
    ];
    rows.forEach(([name, value], i) => {
      const y = -50 + i * 42;
      const style = { fontFamily: UI_FONT, fontSize: '26px', color: '#ffffff' };
      panel.add(this.add.text(-200, y, name, style).setOrigin(0, 0.5));
      panel.add(
        this.add
          .text(200, y, value, { ...style, fontStyle: 'bold', color: '#fff27a' })
          .setOrigin(1, 0.5),
      );
    });

    const touch = this.sys.game.device.input.touch;
    const prompt = this.add
      .text(0, 150, touch ? 'Tap to swim again' : 'Click or press Enter to swim again', {
        fontFamily: UI_FONT,
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#7dfcff',
      })
      .setOrigin(0.5);
    const hint = this.add
      .text(0, 186, touch ? '' : 'Esc: menu', {
        fontFamily: UI_FONT,
        fontSize: '16px',
        color: '#9fc3d6',
      })
      .setOrigin(0.5);
    panel.add([prompt, hint]);
    this.tweens.add({ targets: prompt, alpha: 0.45, duration: 650, yoyo: true, repeat: -1 });

    panel.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 350, ease: 'Back.Out' });

    this.time.delayedCall(INPUT_DELAY, () => {
      this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.retry());
      const kb = this.input.keyboard!;
      kb.once('keydown-ENTER', () => this.retry());
      kb.once('keydown-SPACE', () => this.retry());
      kb.once('keydown-ESC', () => this.toMenu());
    });
  }

  private retry(): void {
    if (this.leaving) return;
    this.leaving = true;
    // Restarts the running GameScene (its shutdown also stops this overlay).
    this.scene.start(SceneKeys.Game);
  }

  private toMenu(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.stop(SceneKeys.Game);
    this.scene.start(SceneKeys.Menu);
  }
}

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
