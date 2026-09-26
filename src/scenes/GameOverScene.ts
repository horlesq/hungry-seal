// Run results, shown over the (still animating) game world. Retry restarts GameScene;
// Esc goes back to the menu.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { SceneKeys } from '../config/keys';
import { UI_FONT } from '../config/layout';
import type { DeathCause, RunResult } from '../services/EventBus';
import { fitUiCamera, onResize, sharpenTexts, textureScale } from '../services/Viewport';
import { Button } from '../ui/Button';

/** Ignore input briefly so a finger still held from the run doesn't skip the screen. */
const INPUT_DELAY = 700;

const TITLES: Record<DeathCause, { title: string; subtitle: string; color: string }> = {
  starved: { title: 'STARVED!', subtitle: 'Your seal ran out of food', color: '#ff8a5c' },
  shark: { title: 'CHOMPED!', subtitle: 'A shark got you', color: '#ff5a4f' },
  mine: { title: 'KABOOM!', subtitle: 'You swam into a sea mine', color: '#ffb13c' },
  jellyfish: { title: 'STUNG!', subtitle: 'Zapped by a jellyfish', color: '#ff8ae0' },
};

export class GameOverScene extends Phaser.Scene {
  private leaving = false;

  constructor() {
    super({ key: SceneKeys.GameOver });
  }

  create(result: RunResult): void {
    this.leaving = false;
    const v = fitUiCamera(this);
    const cx = v.viewWidth / 2;
    const t = TITLES[result.cause];

    const dim = this.add.rectangle(0, 0, v.viewWidth, v.viewHeight, 0x020c18, 1).setOrigin(0);
    dim.setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 0.6, duration: 400 });

    const W = 620;
    const H = 640;
    const panel = this.add.container(cx, v.viewHeight / 2);
    const bg = this.add.graphics();
    bg.fillStyle(0x06284a, 0.92).fillRoundedRect(-W / 2, -H / 2, W, H, 28);
    bg.lineStyle(4, 0x6ff3ff, 0.9).strokeRoundedRect(-W / 2, -H / 2, W, H, 28);
    const title = this.add
      .text(0, -H / 2 + 56, t.title, {
        fontFamily: UI_FONT,
        fontSize: '64px',
        fontStyle: 'bold',
        color: t.color,
        stroke: '#2a0d06',
        strokeThickness: 10,
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(0, -H / 2 + 106, t.subtitle, {
        fontFamily: UI_FONT,
        fontSize: '20px',
        color: '#cfe9f5',
      })
      .setOrigin(0.5);
    panel.add([bg, title, subtitle]);

    // Score line, with a badge for a new best.
    const scoreY = -H / 2 + 160;
    panel.add(
      this.add
        .text(0, scoreY, String(result.score), {
          fontFamily: UI_FONT,
          fontSize: '48px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#0b3a66',
          strokeThickness: 8,
        })
        .setOrigin(0.5),
    );
    const bestLabel = result.newBest ? 'NEW BEST!' : `Best ${result.bestScore}`;
    const best = this.add
      .text(0, scoreY + 40, bestLabel, {
        fontFamily: UI_FONT,
        fontSize: result.newBest ? '24px' : '18px',
        fontStyle: 'bold',
        color: result.newBest ? '#fff27a' : '#9fc3d6',
      })
      .setOrigin(0.5);
    panel.add(best);
    if (result.newBest) {
      this.tweens.add({ targets: best, scale: 1.15, duration: 420, yoyo: true, repeat: -1 });
    }

    const rows: Array<[string, string]> = [
      ['Coins', `+${result.coins}   (${result.totalCoins} total)`],
      ['Distance', `${result.distance} m`],
      ['Deepest', `${result.maxDepth} m`],
      ['Time', formatTime(result.seconds)],
      ['Fish eaten', String(result.eaten)],
      ['Size reached', `${result.stage}`],
    ];
    const style = { fontFamily: UI_FONT, fontSize: '22px', color: '#ffffff' };
    rows.forEach(([name, value], i) => {
      const y = scoreY + 92 + i * 34;
      panel.add(this.add.text(-220, y, name, style).setOrigin(0, 0.5));
      panel.add(
        this.add
          .text(220, y, value, { ...style, fontStyle: 'bold', color: '#fff27a' })
          .setOrigin(1, 0.5),
      );
    });
    panel.add(
      this.add
        .image(-238, scoreY + 92, TextureKeys.Coin)
        .setScale(0.8 * textureScale(this, TextureKeys.Coin))
        .setOrigin(1, 0.5),
    );

    // Buttons: swim again (Enter/Space), shop (S), menu (Esc).
    const retry = new Button(this, 0, H / 2 - 110, {
      width: 330,
      height: 76,
      label: 'SWIM AGAIN',
      fontSize: 36,
      color: 0x33c46b,
      onClick: () => this.go(SceneKeys.Game),
    });
    const shop = new Button(this, -95, H / 2 - 38, {
      width: 170,
      height: 54,
      label: 'SHOP',
      fontSize: 24,
      color: 0xf2b134,
      onClick: () => this.go(SceneKeys.Shop),
    });
    const menu = new Button(this, 95, H / 2 - 38, {
      width: 170,
      height: 54,
      label: 'MENU',
      fontSize: 24,
      color: 0x5d7fa6,
      onClick: () => this.go(SceneKeys.Menu),
    });
    panel.add([retry, shop, menu]);
    const buttons = [retry, shop, menu];
    // Ignore input briefly so a click/finger still held from the run doesn't skip the screen.
    buttons.forEach((b) => b.setEnabled(false));

    panel.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 350, ease: 'Back.Out' });

    sharpenTexts(this);
    // Rebuild for the new size (skipping the entrance animation is not worth the complexity).
    onResize(this, () => {
      if (!this.leaving) this.scene.restart(result);
    });

    this.time.delayedCall(INPUT_DELAY, () => {
      buttons.forEach((b) => b.setEnabled(true));
      const kb = this.input.keyboard!;
      kb.once('keydown-ENTER', () => retry.press());
      kb.once('keydown-SPACE', () => retry.press());
      kb.once('keydown-S', () => shop.press());
      kb.once('keydown-ESC', () => menu.press());
    });
  }

  private go(target: typeof SceneKeys.Game | typeof SceneKeys.Shop | typeof SceneKeys.Menu): void {
    if (this.leaving) return;
    this.leaving = true;
    if (target === SceneKeys.Game) {
      // Restarts the running GameScene (its shutdown also stops this overlay).
      this.scene.start(SceneKeys.Game);
      return;
    }
    this.scene.stop(SceneKeys.Game);
    this.scene.start(target);
  }
}

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
