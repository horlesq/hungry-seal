// Map select: a card per map (picture of the whole map, name, blurb, best score there) and
// one action, Swim!, which starts a run on the selected map. Locked maps show the score
// that opens them and how close the player's best is. Wide screens: cards side by side;
// upright phones: stacked.
// Keys: arrows / Tab + Enter, Esc = back.
import Phaser from 'phaser';
import { SceneKeys } from '../config/keys';
import { MAP_ORDER, MAPS, type MapDef, type MapId } from '../config/maps';
import { isMapUnlocked, pearlsFound } from '../services/saveData';
import { saves } from '../services/SaveService';
import { fitUiCamera, getSafeInsets, onResize, sharpenTexts } from '../services/Viewport';
import { Button } from '../ui/Button';
import { FocusNav } from '../ui/FocusNav';
import { mapThumbnail } from '../ui/mapThumb';
import { WORLD } from '../config/zones';
import { GameMap } from '../world/GameMap';
import { COLORS, CSS, EDGE, formatNumber, uiText } from '../ui/theme';
import { UiTextures } from '../ui/uiTextures';
import { addBackdrop, BACKDROPS, drawBar } from '../ui/widgets';
import { DESIGN_HEIGHT } from '../utils/viewport';

interface Card {
  def: MapDef;
  button: Button;
  thumb: Phaser.GameObjects.Image;
  status: Phaser.GameObjects.Text;
  lock: Phaser.GameObjects.Image | null;
  /** Card rectangle (for the selection ring). */
  rect: Phaser.Geom.Rectangle;
}

/** Thumbnails are fitted into this box height (maps differ in width). */
const THUMB_H = { wide: 140, tall: 124 };

export class MapScene extends Phaser.Scene {
  private cards: Card[] = [];
  private selected: MapId = 'bay';
  private swim!: Button;
  private leaving = false;

  constructor() {
    super({ key: SceneKeys.Maps });
  }

  create(): void {
    this.cards = [];
    this.leaving = false;
    this.selected = saves.data.maps.selected;
    const v = fitUiCamera(this);
    const safe = getSafeInsets();
    const cx = v.viewWidth / 2;
    const wide = !v.portrait;
    const blockH = wide ? DESIGN_HEIGHT : 1160;
    const top = wide
      ? Math.max(0, (v.viewHeight - blockH) / 2)
      : Math.max(safe.top + 10, Math.min((v.viewHeight - blockH) / 2, safe.top + 60));

    addBackdrop(this, v, BACKDROPS.deep);
    this.cameras.main.fadeIn(200, 4, 26, 49);

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
    uiText(this, cx, headerY, 'Choose a map', 'title', { size: wide ? 56 : 48 }).setOrigin(0.5);

    MAP_ORDER.forEach((id, i) => {
      const def = MAPS[id];
      this.cards.push(
        wide
          ? this.wideCard(def, cx + (i - 1) * 388, top + 330)
          : this.tallCard(def, cx, top + 250 + i * 290),
      );
    });

    this.swim = new Button(this, cx, top + (wide ? 610 : 1110), {
      width: 340,
      height: 84,
      label: 'Swim!',
      variant: 'primary',
      fontSize: 42,
      onClick: () => this.leave(SceneKeys.Game),
    }).setName('swim');

    new FocusNav(this).add(...this.cards.map((c) => c.button), this.swim, back);
    this.input.keyboard!.on('keydown-ESC', () => back.press());
    this.refresh();
    sharpenTexts(this);
    onResize(this, () => {
      if (!this.leaving) this.scene.restart();
    });
  }

  /** Side-by-side card: picture on top, text below. */
  private wideCard(def: MapDef, x: number, y: number): Card {
    const w = 364;
    const h = 420;
    const button = this.cardButton(def, x, y, w, h);
    const thumb = this.add.image(x, y - h / 2 + 20, '__DEFAULT').setOrigin(0.5, 0);
    this.fillThumb(thumb, def, w - 40, THUMB_H.wide);
    const textY = y - h / 2 + 20 + THUMB_H.wide + 18;
    uiText(this, x, textY, def.name, 'heading', { size: 32 }).setOrigin(0.5, 0);
    uiText(this, x, textY + 44, def.blurb, 'body', {
      size: 19,
      color: CSS.mist,
      align: 'center',
      wrap: w - 48,
    }).setOrigin(0.5, 0);
    const status = uiText(this, x, y + h / 2 - 38, '', 'caption', { weight: 800, size: 20 }).setOrigin(
      0.5,
    );
    const rect = new Phaser.Geom.Rectangle(x - w / 2, y - h / 2, w, h);
    return { def, button, thumb, status, lock: this.lockIcon(def, thumb), rect };
  }

  /** Stacked card for upright phones: picture on the left, text on the right. */
  private tallCard(def: MapDef, x: number, y: number): Card {
    const w = 640;
    const h = 260;
    const button = this.cardButton(def, x, y, w, h);
    const thumb = this.add.image(x - w / 2 + 20, y, '__DEFAULT').setOrigin(0, 0.5);
    this.fillThumb(thumb, def, 300, THUMB_H.tall);
    const tx = thumb.x + 300 + 20;
    uiText(this, tx, y - h / 2 + 26, def.name, 'heading', { size: 30 });
    uiText(this, tx, y - h / 2 + 68, def.blurb, 'body', {
      size: 18,
      color: CSS.mist,
      wrap: w - 360,
    });
    const status = uiText(this, tx, y + h / 2 - 34, '', 'caption', { weight: 800, size: 19 }).setOrigin(
      0,
      0.5,
    );
    const rect = new Phaser.Geom.Rectangle(x - w / 2, y - h / 2, w, h);
    return { def, button, thumb, status, lock: this.lockIcon(def, thumb), rect };
  }

  /** Shows the map's picture once its terrain is baked (in a worker, no hitch). */
  private fillThumb(thumb: Phaser.GameObjects.Image, def: MapDef, w: number, h: number): void {
    const stretch = h / ((w / def.terrain.width) * WORLD.height);
    const show = () => {
      if (!thumb.scene) return;
      thumb.setTexture(mapThumbnail(this, def.id, w, Math.round(stretch * 10) / 10));
      fitThumb(thumb, w, h);
      const lock = this.cards.find((c) => c.def.id === def.id)?.lock;
      if (lock) {
        const b = thumb.getBounds();
        lock.setPosition(b.centerX, b.centerY);
      }
    };
    thumb.setDisplaySize(w, h).setAlpha(0.3);
    if (GameMap.ready(def.id)) show();
    else void GameMap.prefetch(def.id).then(() => this.time.delayedCall(0, show));
  }

  private cardButton(def: MapDef, x: number, y: number, w: number, h: number): Button {
    return new Button(this, x, y, {
      width: w,
      height: h,
      label: '',
      variant: 'quiet',
      onClick: () => this.select(def.id),
    }).setName(`map-${def.id}`);
  }

  private lockIcon(def: MapDef, thumb: Phaser.GameObjects.Image): Phaser.GameObjects.Image | null {
    if (isMapUnlocked(saves.data, def.id)) return null;
    const b = thumb.getBounds();
    const icon = this.add.image(b.centerX, b.centerY, UiTextures.Lock);
    return icon.setScale(56 / icon.width);
  }

  private select(id: MapId): void {
    this.selected = id;
    if (isMapUnlocked(saves.data, id)) saves.selectMap(id);
    this.refresh();
  }

  private refresh(): void {
    const data = saves.data;
    const gfx = this.children.getByName('progress') as Phaser.GameObjects.Graphics | null;
    gfx?.destroy();
    const g = this.add.graphics().setName('progress');
    for (const card of this.cards) {
      const { def } = card;
      const open = isMapUnlocked(data, def.id);
      if (def.id === this.selected) {
        // Selection: a bright ring (the card keeps its dark fill so the text stays readable).
        const b = card.rect;
        g.lineStyle(5, COLORS.glacier, 1).strokeRoundedRect(b.x - 5, b.y - 5, b.width + 10, b.height + 10, 26);
      }
      card.thumb.setAlpha(open ? 1 : 0.45);
      if (open) {
        const best = data.maps.best[def.id] ?? 0;
        const pearls = `${pearlsFound(data, def.id)}/${def.pearls.length} pearls`;
        const boss = data.maps.bosses.includes(def.id) ? ', boss beaten' : '';
        card.status
          .setText(best > 0 ? `Best ${formatNumber(best)}  ${pearls}${boss}` : 'Not played yet')
          .setColor(def.id === data.maps.selected ? CSS.glacier : CSS.mist);
      } else {
        const u = def.unlock!;
        const have = pearlsFound(data, u.after);
        card.status
          .setText(`Find ${u.pearls} pearls in ${MAPS[u.after].name} (${Math.min(have, u.pearls)}/${u.pearls})`)
          .setColor(CSS.gold);
        // Progress toward the unlock, under the status line.
        const b = card.status.getBounds();
        const w = Math.max(220, b.width);
        drawBar(g, b.centerX - w / 2, b.bottom + 8, w, 10, have / u.pearls, COLORS.gold);
      }
    }
    const open = isMapUnlocked(data, this.selected);
    this.swim
      .setEnabled(open)
      .setLabel(open ? 'Swim!' : 'Locked')
      .setCaption(open ? MAPS[this.selected].name : '');
    sharpenTexts(this);
  }

  private leave(to: string): void {
    if (this.leaving) return;
    if (to === SceneKeys.Game && !isMapUnlocked(saves.data, this.selected)) return;
    this.leaving = true;
    this.cameras.main.fadeOut(200, 4, 26, 49);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(to);
    });
  }
}

/** Scales a thumbnail down (never up) to fit w x h, keeping its aspect. */
function fitThumb(img: Phaser.GameObjects.Image, w: number, h: number): void {
  img.setScale(Math.min(1, w / img.width, h / img.height));
}
