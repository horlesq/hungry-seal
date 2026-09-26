// Run results, shown over the (still animating) game world: cause of death, the score
// counting up, run stats, then Swim again / Upgrades / Menu.
// Keys: arrows / Tab + Enter, S = upgrades, Esc = menu.
import Phaser from 'phaser';
import { SoundKeys } from '../audio/sounds';
import { TextureKeys } from '../config/assets';
import { SceneKeys } from '../config/keys';
import { audio } from '../services/AudioManager';
import type { DeathCause, RunResult } from '../services/EventBus';
import { saves } from '../services/SaveService';
import { fitUiCamera, onResize, sharpenTexts, textureScale } from '../services/Viewport';
import { anyAffordable } from '../systems/UpgradeSystem';
import { Button } from '../ui/Button';
import { FocusNav } from '../ui/FocusNav';
import { COLORS, CSS, drawPanel, formatNumber, reducedMotion, uiText } from '../ui/theme';
import { DESIGN_HEIGHT } from '../utils/viewport';

/** Ignore input briefly so a click/finger still held from the run doesn't skip the screen. */
const INPUT_DELAY = 700;
const PANEL_W = 660;
const PANEL_H = 316;

const TITLES: Record<DeathCause, { title: string; subtitle: string; color: string }> = {
  starved: { title: 'Starved!', subtitle: 'Your seal ran out of food', color: '#ff9a6b' },
  shark: { title: 'Chomped!', subtitle: 'A shark got you', color: '#ff6b5f' },
  mine: { title: 'Kaboom!', subtitle: 'You swam into a sea mine', color: '#ffb13c' },
  jellyfish: { title: 'Stung!', subtitle: 'Zapped by a jellyfish', color: '#ff8ae0' },
  orca: { title: 'Crunched!', subtitle: 'An orca caught you', color: '#e8eef4' },
  anglerfish: { title: 'Lured!', subtitle: 'Never follow the pretty light', color: '#9ffcff' },
  pufferfish: { title: 'Spiked!', subtitle: 'That pufferfish was puffed up', color: '#ffd23c' },
};

type ResultsData = RunResult & { instant?: boolean };

export class GameOverScene extends Phaser.Scene {
  private leaving = false;

  constructor() {
    super({ key: SceneKeys.GameOver });
  }

  create(result: ResultsData): void {
    this.leaving = false;
    const v = fitUiCamera(this);
    const cx = v.viewWidth / 2;
    const top = (v.viewHeight - DESIGN_HEIGHT) / 2;
    const t = TITLES[result.cause];
    const animate = !result.instant && !reducedMotion();

    const dim = this.add.rectangle(0, 0, v.viewWidth, v.viewHeight, COLORS.trench, 0.66);
    dim.setOrigin(0);

    const title = uiText(this, cx, top + 92, t.title, 'title', {
      size: 76,
      color: t.color,
      outline: 12,
      shadow: 6,
    }).setOrigin(0.5);
    const subtitle = uiText(this, cx, top + 150, t.subtitle, 'body', { color: CSS.mist }).setOrigin(
      0.5,
    );

    // Results panel: score on top, six stats underneath.
    const px = cx - PANEL_W / 2;
    const py = top + 188;
    const panel = this.add.container(0, 0);
    const bg = drawPanel(this.add.graphics(), px, py, PANEL_W, PANEL_H, {
      alpha: 0.92,
      depth: 8,
    });
    bg.fillStyle(COLORS.foam, 0.1).fillRect(px + 32, py + 138, PANEL_W - 64, 2);
    panel.add(bg);
    panel.add(uiText(this, px + 36, py + 24, 'Score', 'caption'));
    const score = uiText(
      this,
      px + 34,
      py + 44,
      animate ? '0' : formatNumber(result.score),
      'number',
      {
        size: 64,
        outline: 0,
        shadow: 0,
      },
    );
    panel.add(score);

    const best = result.newBest
      ? this.newBestChip(px + PANEL_W - 36, py + 82)
      : uiText(this, px + PANEL_W - 36, py + 82, `Best ${formatNumber(result.bestScore)}`, 'body', {
          color: CSS.mist,
        }).setOrigin(1, 0.5);
    panel.add(best);

    const stats: Array<[string, string]> = [
      ['Coins earned', `+${formatNumber(result.coins)}`],
      ['Time', formatTime(result.seconds)],
      ['Size reached', String(result.stage)],
      ['Distance', `${formatNumber(result.distance)} m`],
      ['Deepest', `${formatNumber(result.maxDepth)} m`],
      ['Fish eaten', formatNumber(result.eaten)],
    ];
    const colW = (PANEL_W - 72) / 3;
    stats.forEach(([label, value], i) => {
      const x = px + 36 + (i % 3) * colW;
      const y = py + 162 + Math.floor(i / 3) * 74;
      panel.add(uiText(this, x, y, label, 'caption'));
      const coins = i === 0;
      if (coins) {
        panel.add(
          this.add
            .image(x + 13, y + 40, TextureKeys.Coin)
            .setScale(0.95 * textureScale(this, TextureKeys.Coin)),
        );
      }
      panel.add(
        uiText(this, coins ? x + 32 : x, y + 20, value, 'heading', {
          size: 30,
          color: coins ? CSS.gold : CSS.foam,
        }),
      );
    });

    // Buttons: one row under the panel.
    const save = saves.data;
    const rowY = top + 590;
    const retry = new Button(this, cx - 203, rowY, {
      width: 300,
      height: 76,
      label: 'Swim again',
      variant: 'primary',
      fontSize: 34,
      onClick: () => this.go(SceneKeys.Game),
    }).setName('retry');
    const upgrades = new Button(this, cx + 75, rowY, {
      width: 220,
      height: 64,
      label: 'Upgrades',
      variant: 'secondary',
      fontSize: 26,
      onClick: () => this.go(SceneKeys.Shop),
    })
      .setName('upgrades')
      .setBadge(anyAffordable(save.upgrades, save.coins));
    const menu = new Button(this, cx + 278, rowY, {
      width: 150,
      height: 64,
      label: 'Menu',
      variant: 'quiet',
      fontSize: 26,
      onClick: () => this.go(SceneKeys.Menu),
    }).setName('menu');
    const buttons = [retry, upgrades, menu];
    const nav = new FocusNav(this).add(...buttons);

    if (animate) {
      dim.setAlpha(0);
      this.tweens.add({ targets: dim, alpha: 1, duration: 400 });
      title.setScale(1.35).setAlpha(0);
      this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 360, ease: 'Back.Out' });
      subtitle.setAlpha(0);
      this.tweens.add({ targets: subtitle, alpha: 1, delay: 150, duration: 300 });
      const rest = [panel, ...buttons];
      rest.forEach((o) => o.setAlpha(0).setY(o.y + 24));
      this.tweens.add({
        targets: rest,
        alpha: 1,
        y: '-=24',
        delay: 180,
        duration: 380,
        ease: 'Quad.Out',
      });
      this.countUp(score, result.score, best, result.newBest);
    }

    // Ignore input briefly so a click/finger still held from the run doesn't skip the screen.
    buttons.forEach((b) => b.setEnabled(false));
    nav.setEnabled(false);
    this.time.delayedCall(result.instant ? 0 : INPUT_DELAY, () => {
      buttons.forEach((b) => b.setEnabled(true));
      nav.setEnabled(true);
      nav.focus(retry);
      const kb = this.input.keyboard!;
      kb.once('keydown-S', () => upgrades.press());
      kb.once('keydown-ESC', () => menu.press());
    });

    sharpenTexts(this);
    onResize(this, () => {
      if (!this.leaving) this.scene.restart({ ...result, instant: true });
    });
  }

  /** Rolls the score up from zero, then pops the best-score badge. */
  private countUp(
    text: Phaser.GameObjects.Text,
    score: number,
    best: Phaser.GameObjects.Container | Phaser.GameObjects.Text,
    newBest: boolean,
  ): void {
    const counter = { value: 0 };
    best.setAlpha(0);
    this.tweens.add({
      targets: counter,
      value: score,
      delay: 350,
      duration: Math.min(1400, 500 + score * 0.25),
      ease: 'Cubic.Out',
      onUpdate: () => text.setText(formatNumber(counter.value)),
      onComplete: () => {
        text.setText(formatNumber(score));
        best.setAlpha(1);
        if (!newBest) return;
        audio.play(SoundKeys.Grow);
        this.tweens.add({
          targets: best,
          scale: { from: 0.5, to: 1 },
          duration: 320,
          ease: 'Back.Out',
        });
      },
    });
  }

  private newBestChip(right: number, y: number): Phaser.GameObjects.Container {
    const label = uiText(this, 0, 1, 'New best!', 'heading', {
      size: 24,
      color: CSS.ink,
    }).setOrigin(0.5);
    const w = label.width + 36;
    const h = 44;
    const g = this.add.graphics();
    g.fillStyle(COLORS.goldEdge, 1).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, h / 2);
    g.fillStyle(COLORS.gold, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    return this.add.container(right - w / 2, y, [g, label]);
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
