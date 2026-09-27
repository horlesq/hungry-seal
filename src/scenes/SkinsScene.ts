// Skins: pick how your seal looks (cosmetic only). A big preview of the selected skin, a
// card per skin, and one action: Buy (gold, spends coins, then wears it) or Equip.
// Keys: arrows / Tab + Enter, Esc = back.
import Phaser from 'phaser';
import { SoundKeys } from '../audio/sounds';
import { TextureKeys } from '../config/assets';
import { SceneKeys } from '../config/keys';
import { SKINS, skinDef, type SkinDef, type SkinId } from '../config/skins';
import { audio } from '../services/AudioManager';
import { saves } from '../services/SaveService';
import {
  fitUiCamera,
  getSafeInsets,
  onResize,
  sharpenTexts,
  textureScale,
} from '../services/Viewport';
import { Button } from '../ui/Button';
import { FocusNav } from '../ui/FocusNav';
import { CSS, EDGE, formatNumber, reducedMotion, uiText } from '../ui/theme';
import { UiTextures } from '../ui/uiTextures';
import { addBackdrop, BACKDROPS, CoinPill } from '../ui/widgets';
import { DESIGN_HEIGHT } from '../utils/viewport';

const CARD = { w: 148, h: 150, gap: 14, rowStep: 196 };
/** Preview size on screen (the seal art is 176 design units wide). */
const PREVIEW_SCALE = 2;

interface Card {
  def: SkinDef;
  button: Button;
  status: Phaser.GameObjects.Text;
  coin: Phaser.GameObjects.Image;
}

export class SkinsScene extends Phaser.Scene {
  private cards: Card[] = [];
  private selected: SkinId = 'harbor';
  private preview!: Phaser.GameObjects.Image;
  private nameText!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private buy!: Button;
  private equip!: Button;
  private coins!: CoinPill;
  private leaving = false;

  constructor() {
    super({ key: SceneKeys.Skins });
  }

  create(): void {
    this.cards = [];
    this.leaving = false;
    this.selected = saves.data.skins.equipped;
    const v = fitUiCamera(this);
    const safe = getSafeInsets();
    const cx = v.viewWidth / 2;
    // All cards in one row on wide screens; three per row on upright phones.
    const columns = v.portrait ? 3 : SKINS.length;
    const rows = Math.ceil(SKINS.length / columns);
    const gridTop = 400;
    const actionY = gridTop + (rows - 1) * CARD.rowStep + CARD.h + 88;
    const blockH = actionY + 60;
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
      onClick: () => this.leave(),
    }).setName('back');
    uiText(this, cx, headerY, 'Skins', 'title', { size: 56 }).setOrigin(0.5);
    this.coins = new CoinPill(this, v.viewWidth - safe.right - EDGE, headerY, saves.data.coins);
    this.coins.setName('coins');

    // Preview of the selected skin, gently bobbing.
    const previewY = top + 210;
    this.preview = this.add.image(cx, previewY, TextureKeys.Seal).setName('preview');
    if (!reducedMotion()) {
      this.tweens.add({
        targets: this.preview,
        y: previewY + 10,
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
    this.nameText = uiText(this, cx, top + 322, '', 'heading', { size: 34 }).setOrigin(0.5);
    this.descText = uiText(this, cx, top + 360, '', 'body', { color: CSS.mist }).setOrigin(0.5);

    SKINS.forEach((def, i) => {
      const row = Math.floor(i / columns);
      const inRow = Math.min(columns, SKINS.length - row * columns);
      const col = i % columns;
      const x = cx + (col - (inRow - 1) / 2) * (CARD.w + CARD.gap);
      const y = top + gridTop + CARD.h / 2 + row * CARD.rowStep;
      this.cards.push(this.createCard(def, x, y));
    });

    this.buy = new Button(this, cx, top + actionY, {
      width: 320,
      height: 72,
      label: '',
      icon: TextureKeys.Coin,
      iconTint: null,
      iconSize: 30,
      caption: '',
      variant: 'gold',
      fontSize: 30,
      onClick: () => this.buySelected(),
    }).setName('buy');
    this.equip = new Button(this, cx, top + actionY, {
      width: 320,
      height: 72,
      label: 'Equip',
      variant: 'primary',
      fontSize: 34,
      onClick: () => this.equipSelected(),
    }).setName('equip');

    new FocusNav(this).add(...this.cards.map((c) => c.button), this.buy, this.equip, back);
    this.input.keyboard!.on('keydown-ESC', () => back.press());

    this.refresh();
    sharpenTexts(this);
    onResize(this, () => {
      if (!this.leaving) this.scene.restart();
    });
  }

  private createCard(def: SkinDef, x: number, y: number): Card {
    const button = new Button(this, x, y, {
      width: CARD.w,
      height: CARD.h,
      icon: def.texture,
      iconTint: null,
      iconSize: 122,
      caption: def.name,
      variant: 'quiet',
      onClick: () => this.select(def.id),
    }).setName(`skin-${def.id}`);
    const status = uiText(this, x, y + CARD.h / 2 + 24, '', 'caption', { weight: 800 }).setOrigin(
      0,
      0.5,
    );
    const coin = this.add
      .image(0, status.y, TextureKeys.Coin)
      .setScale(0.72 * textureScale(this, TextureKeys.Coin));
    return { def, button, status, coin };
  }

  private select(id: SkinId): void {
    this.selected = id;
    this.refresh();
  }

  private buySelected(): void {
    if (!saves.buySkin(this.selected)) return;
    audio.play(SoundKeys.Buy);
    this.tweens.add({ targets: this.coins, scale: { from: 1.12, to: 1 }, duration: 220 });
    this.celebrate();
    this.refresh();
  }

  private equipSelected(): void {
    if (!saves.equipSkin(this.selected)) return;
    this.celebrate();
    this.refresh();
  }

  /** A little hop of the preview when a skin is bought or equipped. */
  private celebrate(): void {
    const s = PREVIEW_SCALE * textureScale(this, this.preview.texture.key);
    this.tweens.add({ targets: this.preview, scale: { from: s * 1.12, to: s }, duration: 260 });
  }

  /** Redraws cards, preview and the action button for the selection and the save. */
  private refresh(): void {
    const data = saves.data;
    const def = skinDef(this.selected);
    const owned = data.skins.owned.includes(def.id);
    const equipped = data.skins.equipped === def.id;
    this.coins.setCoins(data.coins);

    this.preview.setTexture(def.texture);
    this.preview.setScale(PREVIEW_SCALE * textureScale(this, def.texture));
    this.nameText.setText(def.name);
    this.descText.setText(def.description);

    for (const card of this.cards) {
      const id = card.def.id;
      card.button.setVariant(id === this.selected ? 'secondary' : 'quiet');
      const cardOwned = data.skins.owned.includes(id);
      const label =
        data.skins.equipped === id
          ? 'Equipped'
          : cardOwned
            ? 'Owned'
            : formatNumber(card.def.price);
      card.status
        .setText(label)
        .setColor(data.skins.equipped === id ? CSS.glacier : cardOwned ? CSS.mist : CSS.gold);
      // Price: coin icon + number, centred under the card together.
      const priced = !cardOwned;
      card.coin.setVisible(priced);
      const w = card.status.width + (priced ? 24 : 0);
      const left = card.button.x - w / 2;
      card.coin.setX(left + 9);
      card.status.setX(left + (priced ? 24 : 0));
    }

    this.buy.setVisible(!owned);
    this.equip.setVisible(owned);
    if (owned) {
      this.equip.setLabel(equipped ? 'Equipped' : 'Equip').setEnabled(!equipped);
    } else {
      const short = def.price - data.coins;
      this.buy
        .setLabel(formatNumber(def.price))
        .setCaption(short > 0 ? `Need ${formatNumber(short)} more` : 'Buy and wear')
        .setEnabled(short <= 0);
    }
    sharpenTexts(this);
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(200, 4, 26, 49);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SceneKeys.Menu);
    });
  }
}
