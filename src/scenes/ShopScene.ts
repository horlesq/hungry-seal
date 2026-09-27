// Upgrades screen: spend banked coins on permanent upgrades. Two columns of rows, each with
// an icon, the current level and a gold buy button showing the price and what you get.
// Keys: arrows / Tab + Enter, Esc = back. Play starts a run straight away.
import Phaser from 'phaser';
import { SoundKeys } from '../audio/sounds';
import { TextureKeys } from '../config/assets';
import { SceneKeys } from '../config/keys';
import { UPGRADES, type UpgradeDef, type UpgradeId } from '../config/upgrades';
import { audio } from '../services/AudioManager';
import { saves } from '../services/SaveService';
import { fitUiCamera, getSafeInsets, onResize, sharpenTexts } from '../services/Viewport';
import { maxLevel, nextCost } from '../systems/UpgradeSystem';
import { Button } from '../ui/Button';
import { FocusNav } from '../ui/FocusNav';
import { COLORS, CSS, drawPanel, EDGE, UPGRADE_HUES, uiText } from '../ui/theme';
import { UiTextures, type UiTexture } from '../ui/uiTextures';
import { addBackdrop, BACKDROPS, CoinPill, drawSegments } from '../ui/widgets';
import { DESIGN_HEIGHT } from '../utils/viewport';

const CARD_W = 596;
const CARD_H = 108;
const COL_GAP = 20;
const ROW_STEP = 120;
const FIRST_ROW_Y = 160;
const TEXT_X = -CARD_W / 2 + 108;
const SEGMENTS_W = 116;

const ICONS: Record<UpgradeId, UiTexture> = {
  speed: UiTextures.Chevrons,
  belly: UiTextures.FishPlus,
  metabolism: UiTextures.Hourglass,
  boost: UiTextures.Bolt,
  jaws: UiTextures.Jaws,
  magnet: UiTextures.Magnet,
  frenzy: UiTextures.Flame,
};

interface Card {
  def: UpgradeDef;
  root: Phaser.GameObjects.Container;
  levelGfx: Phaser.GameObjects.Graphics;
  effect: Phaser.GameObjects.Text;
  buy: Button;
  maxed: Phaser.GameObjects.Text;
}

export class ShopScene extends Phaser.Scene {
  private cards: Card[] = [];
  private coins!: CoinPill;
  private leaving = false;

  constructor() {
    super({ key: SceneKeys.Shop });
  }

  create(): void {
    this.cards = [];
    this.leaving = false;
    const v = fitUiCamera(this);
    const safe = getSafeInsets();
    const cx = v.viewWidth / 2;
    // Two columns in a 720-tall block; upright phones get one column (~1060 tall) instead.
    const columns = v.portrait ? 1 : 2;
    const rows = Math.ceil(UPGRADES.length / columns);
    const blockH = FIRST_ROW_Y + (rows - 1) * ROW_STEP + 170;
    const top = Math.max(
      v.portrait ? safe.top : 0,
      (v.viewHeight - Math.max(blockH, DESIGN_HEIGHT)) / 2,
    );

    addBackdrop(this, v, BACKDROPS.deep);
    this.cameras.main.fadeIn(200, 4, 26, 49);

    // Header: back, title, coin balance.
    const headerY = top + 54;
    const back = new Button(this, safe.left + EDGE + 72, headerY, {
      width: 144,
      height: 56,
      label: 'Back',
      icon: UiTextures.Back,
      iconSize: 24,
      variant: 'quiet',
      fontSize: 24,
      onClick: () => this.leave(SceneKeys.Menu),
    }).setName('back');
    uiText(this, cx, headerY, 'Upgrades', 'title', { size: 56 }).setOrigin(0.5);
    this.coins = new CoinPill(this, v.viewWidth - safe.right - EDGE, headerY, saves.data.coins);
    this.coins.setName('coins');

    UPGRADES.forEach((def, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = columns === 1 ? cx : cx + (col === 0 ? -1 : 1) * (CARD_W / 2 + COL_GAP / 2);
      this.cards.push(this.createCard(def, x, top + FIRST_ROW_Y + row * ROW_STEP));
    });

    const play = new Button(this, cx, top + FIRST_ROW_Y + (rows - 1) * ROW_STEP + 128, {
      width: 300,
      height: 72,
      label: 'Play',
      variant: 'primary',
      fontSize: 34,
      onClick: () => this.leave(SceneKeys.Game),
    }).setName('play');

    new FocusNav(this).add(...this.cards.map((c) => c.buy), play, back);
    this.input.keyboard!.on('keydown-ESC', () => back.press());

    this.refresh();
    sharpenTexts(this);
    onResize(this, () => {
      if (!this.leaving) this.scene.restart();
    });
  }

  private createCard(def: UpgradeDef, x: number, y: number): Card {
    const root = this.add.container(x, y);
    const bg = drawPanel(this.add.graphics(), -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, {
      radius: 22,
      alpha: 0.88,
      line: 0.14,
    });
    // Icon well in the upgrade's own hue.
    const wellX = -CARD_W / 2 + 56;
    bg.fillStyle(COLORS.trench, 0.6).fillCircle(wellX, 3, 36);
    bg.fillStyle(UPGRADE_HUES[def.id], 1).fillCircle(wellX, 0, 36);
    const icon = this.add.image(wellX, 0, ICONS[def.id]);
    icon.setScale(40 / icon.frame.width).setTint(COLORS.ink);

    const name = uiText(this, TEXT_X, -28, def.name, 'heading', { size: 26 }).setOrigin(0, 0.5);
    const desc = uiText(this, TEXT_X, 0, def.description, 'caption').setOrigin(0, 0.5);
    const levelGfx = this.add.graphics();
    const effect = uiText(this, TEXT_X + SEGMENTS_W + 14, 27, '', 'caption', {
      weight: 700,
    }).setOrigin(0, 0.5);

    const buyX = CARD_W / 2 - 18 - 82;
    const buy = new Button(this, buyX, -3, {
      width: 164,
      height: 70,
      label: '',
      icon: TextureKeys.Coin,
      iconTint: null,
      iconSize: 28,
      caption: '',
      variant: 'gold',
      fontSize: 28,
      onClick: () => this.buy(def),
    }).setName(`buy-${def.id}`);
    const maxed = uiText(this, buyX, 0, 'Maxed', 'heading', { size: 26, color: CSS.gold })
      .setOrigin(0.5)
      .setVisible(false);
    root.add([bg, icon, name, desc, levelGfx, effect, buy, maxed]);
    return { def, root, levelGfx, effect, buy, maxed };
  }

  private buy(def: UpgradeDef): void {
    if (!saves.buyUpgrade(def.id)) return;
    audio.play(SoundKeys.Buy);
    const card = this.cards.find((c) => c.def.id === def.id);
    if (card) {
      this.tweens.add({ targets: card.root, scale: { from: 1.03, to: 1 }, duration: 220 });
    }
    this.tweens.add({ targets: this.coins, scale: { from: 1.12, to: 1 }, duration: 220 });
    this.refresh();
  }

  /** Redraws every card for the current levels and coin balance. */
  private refresh(): void {
    const data = saves.data;
    this.coins.setCoins(data.coins);

    for (const card of this.cards) {
      const level = data.upgrades[card.def.id];
      const max = maxLevel(card.def.id);
      const cost = nextCost(card.def.id, level);

      card.levelGfx.clear();
      drawSegments(card.levelGfx, TEXT_X, 22, SEGMENTS_W, 10, max, level, COLORS.glacier);
      card.effect
        .setText(level > 0 ? card.def.effect(level) : 'Not upgraded yet')
        .setColor(level > 0 ? CSS.gold : CSS.mist);

      card.buy.setVisible(cost !== null);
      card.maxed.setVisible(cost === null);
      if (cost === null) continue;
      const short = cost - data.coins;
      card.buy
        .setLabel(String(cost))
        .setCaption(short > 0 ? `Need ${short} more` : card.def.effect(level + 1))
        .setEnabled(short <= 0);
    }
    sharpenTexts(this);
  }

  private leave(target: typeof SceneKeys.Menu | typeof SceneKeys.Game): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(200, 4, 26, 49);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(target);
    });
  }
}
