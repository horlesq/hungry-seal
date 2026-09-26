// Upgrade shop: spend banked coins on permanent upgrades. Esc/Back returns to the menu,
// Play starts a run straight away.
import Phaser from 'phaser';
import { SoundKeys } from '../audio/sounds';
import { TextureKeys } from '../config/assets';
import { SceneKeys } from '../config/keys';
import { UI_FONT } from '../config/layout';
import { UPGRADES, type UpgradeDef } from '../config/upgrades';
import { audio } from '../services/AudioManager';
import { saves } from '../services/SaveService';
import { fitUiCamera, onResize, sharpenTexts, textureScale } from '../services/Viewport';
import { maxLevel, nextCost } from '../systems/UpgradeSystem';
import { Button } from '../ui/Button';
import { DESIGN_HEIGHT } from '../utils/viewport';

// Two rows of compact cards (4 + 3) so all upgrades fit in the 1280x720 design area.
const CARD_W = 270;
const CARD_H = 240;
const CARD_GAP = 16;
const PER_ROW = 4;
const ROW_Y = [225, 490];
const PIP_Y = -14;

interface Card {
  def: UpgradeDef;
  pips: Phaser.GameObjects.Graphics;
  now: Phaser.GameObjects.Text;
  next: Phaser.GameObjects.Text;
  buy: Button;
  root: Phaser.GameObjects.Container;
}

export class ShopScene extends Phaser.Scene {
  private cards: Card[] = [];
  private coinText!: Phaser.GameObjects.Text;
  private leaving = false;

  constructor() {
    super({ key: SceneKeys.Shop });
  }

  create(): void {
    this.cards = [];
    this.leaving = false;
    const v = fitUiCamera(this);
    const cx = v.viewWidth / 2;
    const top = (v.viewHeight - DESIGN_HEIGHT) / 2;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a86bd, 0x1a86bd, 0x0b2e5c, 0x0b2e5c, 1);
    bg.fillRect(0, 0, v.viewWidth, v.viewHeight);

    this.add
      .text(cx, top + 58, 'UPGRADES', {
        fontFamily: UI_FONT,
        fontSize: '56px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#0b3a66',
        strokeThickness: 12,
      })
      .setOrigin(0.5);

    // Banked coins, top-right.
    this.coinText = this.add
      .text(v.viewWidth - 30, top + 50, '', {
        fontFamily: UI_FONT,
        fontSize: '38px',
        fontStyle: 'bold',
        color: '#ffe066',
        stroke: '#0b3a66',
        strokeThickness: 8,
      })
      .setOrigin(1, 0.5);
    this.add
      .image(0, top + 50, TextureKeys.Coin)
      .setScale(1.3 * textureScale(this, TextureKeys.Coin))
      .setName('coinIcon');

    UPGRADES.forEach((def, i) => {
      const row = Math.floor(i / PER_ROW);
      const inRow = Math.min(PER_ROW, UPGRADES.length - row * PER_ROW);
      const rowW = inRow * CARD_W + (inRow - 1) * CARD_GAP;
      const col = i % PER_ROW;
      const x = cx - rowW / 2 + CARD_W / 2 + col * (CARD_W + CARD_GAP);
      this.cards.push(this.createCard(def, x, top + ROW_Y[row]));
    });

    const back = new Button(this, cx - 160, top + 668, {
      width: 230,
      height: 60,
      label: 'BACK',
      color: 0x5d7fa6,
      onClick: () => this.leave(SceneKeys.Menu),
    });
    const play = new Button(this, cx + 160, top + 668, {
      width: 230,
      height: 60,
      label: 'PLAY',
      color: 0x33c46b,
      onClick: () => this.leave(SceneKeys.Game),
    });

    this.input.keyboard!.on('keydown-ESC', () => back.press());
    this.input.keyboard!.on('keydown-ENTER', () => play.press());

    this.refresh();
    sharpenTexts(this);
    onResize(this, () => {
      if (!this.leaving) this.scene.restart();
    });
  }

  private createCard(def: UpgradeDef, x: number, y: number): Card {
    const root = this.add.container(x, y);
    const panel = this.add.graphics();
    panel.fillStyle(0x06284a, 0.9).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 24);
    panel
      .lineStyle(3, 0x6ff3ff, 0.8)
      .strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 24);
    const name = this.add
      .text(0, -CARD_H / 2 + 26, def.name, {
        fontFamily: UI_FONT,
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    const desc = this.add
      .text(0, -CARD_H / 2 + 48, def.description, {
        fontFamily: UI_FONT,
        fontSize: '16px',
        color: '#bfe3f2',
        align: 'center',
        wordWrap: { width: CARD_W - 24 },
      })
      .setOrigin(0.5, 0);
    const pips = this.add.graphics();
    const now = this.add
      .text(0, 20, '', { fontFamily: UI_FONT, fontSize: '18px', color: '#fff27a' })
      .setOrigin(0.5);
    const next = this.add
      .text(0, 44, '', { fontFamily: UI_FONT, fontSize: '15px', color: '#9fd9ee' })
      .setOrigin(0.5);
    const buy = new Button(this, 0, CARD_H / 2 - 34, {
      width: CARD_W - 50,
      height: 48,
      label: '',
      fontSize: 22,
      color: 0xf2b134,
      onClick: () => this.buy(def),
    });
    root.add([panel, name, desc, pips, now, next, buy]);
    return { def, pips, now, next, buy, root };
  }

  private buy(def: UpgradeDef): void {
    if (!saves.buyUpgrade(def.id)) return;
    audio.play(SoundKeys.Buy);
    const card = this.cards.find((c) => c.def.id === def.id);
    if (card) {
      this.tweens.add({ targets: card.root, scale: { from: 1.06, to: 1 }, duration: 220 });
    }
    this.refresh();
  }

  /** Redraws every card for the current levels and coin balance. */
  private refresh(): void {
    const data = saves.data;
    this.coinText.setText(String(data.coins));
    const icon = this.children.getByName('coinIcon') as Phaser.GameObjects.Image | null;
    icon?.setX(this.coinText.x - this.coinText.width - 30);

    for (const card of this.cards) {
      const level = data.upgrades[card.def.id];
      const max = maxLevel(card.def.id);
      const cost = nextCost(card.def.id, level);

      const g = card.pips;
      g.clear();
      const spacing = 30;
      for (let i = 0; i < max; i++) {
        const px = (i - (max - 1) / 2) * spacing;
        g.fillStyle(i < level ? 0x6ff3ff : 0x1c4a6e, 1).fillCircle(px, PIP_Y, 10);
        g.lineStyle(3, 0xffffff, 0.8).strokeCircle(px, PIP_Y, 10);
      }
      card.now.setText(level > 0 ? card.def.effect(level) : 'Not upgraded');
      card.next.setText(cost === null ? 'Fully upgraded!' : `Next: ${card.def.effect(level + 1)}`);
      if (cost === null) card.buy.setLabel('MAX').setEnabled(false);
      else card.buy.setLabel(`BUY  ${cost}`).setEnabled(data.coins >= cost);
    }
  }

  private leave(target: typeof SceneKeys.Menu | typeof SceneKeys.Game): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(200, 4, 20, 37);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(target);
    });
  }
}
