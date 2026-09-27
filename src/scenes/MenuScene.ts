// Title screen: the bitten wordmark, Play / Upgrades, best score, coin balance, sound and
// fullscreen toggles, and the seal floating on the right, watching the pointer.
// Keys: arrows / Tab + Enter, S = upgrades, M = mute, F = fullscreen.
import Phaser from 'phaser';
import { SoundKeys } from '../audio/sounds';
import { TextureKeys } from '../config/assets';
import { SceneKeys } from '../config/keys';
import { audio } from '../services/AudioManager';
import { saves } from '../services/SaveService';
import {
  fitUiCamera,
  getSafeInsets,
  onResize,
  sharpenTexts,
  textureScale,
} from '../services/Viewport';
import { anyAffordable } from '../systems/UpgradeSystem';
import { Button } from '../ui/Button';
import { FocusNav } from '../ui/FocusNav';
import { CSS, EDGE, formatNumber, reducedMotion, uiText } from '../ui/theme';
import { UiTextures, type WordmarkData } from '../ui/uiTextures';
import { addBackdrop, BACKDROPS, CoinPill } from '../ui/widgets';
import { damp } from '../utils/math';
import { DESIGN_HEIGHT, type Insets, type Viewport } from '../utils/viewport';

/** The wordmark gets bitten once per page load; later visits show it already bitten. */
let introPlayed = false;
interface MenuLayout {
  /** Wordmark's top-left (the floe's left edge). */
  mark: { x: number; y: number };
  seal: { x: number; y: number; scale: number };
  /** Centre x of Play / Upgrades, and Play's y (Upgrades sits 100 below). */
  buttonsX: number;
  playY: number;
  /** Best score / help text anchor x, and their horizontal origin. */
  textX: number;
  textOrigin: number;
}

/** How far the seal turns its head toward the pointer (radians). */
const LOOK_LIMIT = 0.38;

export class MenuScene extends Phaser.Scene {
  private leaving = false;
  private seal!: Phaser.GameObjects.Image;
  private sealScale = 1;
  private sealRotation = 0;
  private lookAt: { x: number; y: number } | null = null;

  constructor() {
    super({ key: SceneKeys.Menu });
  }

  create(): void {
    this.leaving = false;
    this.lookAt = null;
    this.sealRotation = 0;
    audio.startMusic();
    const v = fitUiCamera(this);
    const safe = getSafeInsets();
    const save = saves.data;
    const L = v.portrait ? this.portraitLayout(v, safe) : this.wideLayout(v, safe);

    addBackdrop(this, v, BACKDROPS.shallows);
    this.cameras.main.fadeIn(250, 4, 26, 49);

    const sealX = L.seal.x;
    const sealY = L.seal.y;
    this.sealScale = L.seal.scale * textureScale(this, TextureKeys.Seal);
    this.seal = this.add.image(sealX, sealY, TextureKeys.Seal).setScale(this.sealScale);
    if (!reducedMotion()) {
      this.tweens.add({
        targets: this.seal,
        y: sealY + 16,
        duration: 1700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) this.lookAt = { x: p.worldX, y: p.worldY };
    });

    this.createWordmark(L.mark.x, L.mark.y);

    const play = new Button(this, L.buttonsX, L.playY, {
      width: 340,
      height: 84,
      label: 'Play',
      variant: 'primary',
      fontSize: 42,
      onClick: () => this.leave(SceneKeys.Game),
    }).setName('play');
    const upgrades = new Button(this, L.buttonsX, L.playY + 100, {
      width: 340,
      height: 68,
      label: 'Upgrades',
      variant: 'secondary',
      fontSize: 28,
      onClick: () => this.leave(SceneKeys.Shop),
    })
      .setName('upgrades')
      .setBadge(anyAffordable(save.upgrades, save.coins));

    if (save.runs > 0) {
      uiText(this, L.textX, L.playY + 166, `Best score ${formatNumber(save.bestScore)}`, 'body', {
        color: CSS.foam,
      })
        .setOrigin(L.textOrigin, 0)
        .setName('best');
    }

    const touch = this.sys.game.device.input.touch;
    const help = touch
      ? 'Touch and drag anywhere to swim, like a joystick. Tap Boost to dash.'
      : 'Move the mouse or use WASD to swim. Click, Space or Shift to boost.';
    uiText(this, L.textX, v.viewHeight - safe.bottom - EDGE, help, 'caption', {
      size: 18,
      color: CSS.foam,
      align: v.portrait ? 'center' : 'left',
      wrap: v.viewWidth - 80,
    })
      .setOrigin(L.textOrigin, 1)
      .setAlpha(0.8);

    // Top-right: coin balance, fullscreen, sound.
    const right = v.viewWidth - safe.right - EDGE;
    const barY = safe.top + EDGE + 30;
    const sound = new Button(this, right - 30, barY, {
      width: 60,
      height: 60,
      round: true,
      icon: audio.muted ? UiTextures.SoundOff : UiTextures.SoundOn,
      variant: 'quiet',
      onClick: () => {
        audio.toggleMuted();
        sound.setIcon(audio.muted ? UiTextures.SoundOff : UiTextures.SoundOn);
        if (!audio.muted) audio.startMusic();
      },
    }).setName('sound');
    let pillRight = right - 60 - 16;
    const buttons = [play, upgrades, sound];
    if (this.scale.fullscreen.available) {
      const full = new Button(this, pillRight - 30, barY, {
        width: 60,
        height: 60,
        round: true,
        icon: this.scale.isFullscreen ? UiTextures.FullscreenExit : UiTextures.Fullscreen,
        variant: 'quiet',
        onClick: () => this.scale.toggleFullscreen(),
      }).setName('fullscreen');
      buttons.push(full);
      pillRight -= 60 + 16;
      this.input.keyboard!.on('keydown-F', () => full.press());
    }
    new CoinPill(this, pillRight, barY - 3, save.coins).setName('coins');

    new FocusNav(this).add(...buttons);
    const kb = this.input.keyboard!;
    kb.on('keydown-S', () => upgrades.press());
    kb.on('keydown-M', () => sound.press());

    sharpenTexts(this);
    onResize(this, () => {
      if (!this.leaving) this.scene.restart();
    });
  }

  /** Desktop and landscape: wordmark and buttons in a left column, the seal on the right. */
  private wideLayout(v: Viewport, safe: Insets): MenuLayout {
    // Content is authored for a 720-tall column, centered in taller views.
    const top = (v.viewHeight - DESIGN_HEIGHT) / 2;
    const left = safe.left + Math.max(EDGE * 2, Math.min(110, v.viewWidth * 0.07));
    return {
      mark: { x: left, y: top + 34 },
      seal: { x: left + (v.viewWidth - left) * 0.64, y: top + 330, scale: 2.1 },
      buttonsX: left + 170,
      playY: top + 446,
      textX: left + 4,
      textOrigin: 0,
    };
  }

  /** Upright phones: everything stacked and centred, the seal between title and buttons. */
  private portraitLayout(v: Viewport, safe: Insets): MenuLayout {
    const cx = v.viewWidth / 2;
    const frame = this.textures.getFrame(UiTextures.WordmarkBitten);
    const scale =
      1 / (this.textures.get(UiTextures.WordmarkBitten).customData as WordmarkData).resolution;
    const markW = frame.width * scale;
    const markH = frame.height * scale;
    // Title, seal and buttons take ~1050 units: centre them below the top-right buttons.
    const top = Math.max(safe.top + 120, (v.viewHeight - 1050) / 2);
    const sealY = top + markH + 130;
    return {
      // createWordmark() offsets by the texture margin (8); cancel it to centre the texture.
      mark: { x: cx - markW / 2 + 8, y: top },
      seal: { x: cx, y: sealY, scale: 1.7 },
      buttonsX: cx,
      playY: sealY + 190,
      textX: cx,
      textOrigin: 0.5,
    };
  }

  override update(time: number, delta: number): void {
    // Turn the seal's head toward the mouse; idle sway otherwise (touch, or before it moves).
    let target = Math.sin(time * 0.0011) * 0.08;
    let flip = this.seal.flipX;
    if (this.lookAt) {
      const dx = this.lookAt.x - this.seal.x;
      const dy = this.lookAt.y - this.seal.y;
      // Hysteresis so it doesn't flicker when the pointer is right above it.
      if (dx < -40) flip = true;
      else if (dx > 40) flip = false;
      const angle = Math.atan2(dy, Math.abs(dx) + 60);
      target = Phaser.Math.Clamp(angle, -LOOK_LIMIT, LOOK_LIMIT) * (flip ? -1 : 1);
    }
    this.seal.setFlipX(flip);
    this.sealRotation = damp(this.sealRotation, target, 6, delta / 1000);
    this.seal.setRotation(this.sealRotation);
  }

  /** Wordmark; on the first visit it drops in, then gets a bite taken out of it. */
  private createWordmark(x: number, y: number): void {
    const bitten = this.textures.get(UiTextures.WordmarkBitten);
    const data = bitten.customData as WordmarkData;
    const scale = 1 / data.resolution;
    // The painted texture has a small margin; line the floe's left edge up with `x`.
    const mark = this.add
      .image(x - 8, y, UiTextures.WordmarkBitten)
      .setOrigin(0, 0)
      .setScale(scale)
      .setAngle(-2)
      .setName('wordmark');
    if (introPlayed || reducedMotion()) {
      introPlayed = true;
      return;
    }
    introPlayed = true;
    mark
      .setTexture(UiTextures.Wordmark)
      .setAlpha(0)
      .setY(y - 28);
    this.tweens.add({ targets: mark, alpha: 1, y, duration: 450, ease: 'Back.Out' });
    this.time.delayedCall(820, () => {
      mark.setTexture(UiTextures.WordmarkBitten);
      audio.play(SoundKeys.Chomp);
      this.tweens.add({
        targets: mark,
        scaleY: { from: scale * 0.94, to: scale },
        duration: 160,
        ease: 'Quad.Out',
      });
      this.crumbs(mark.x + data.bite.x, mark.y + data.bite.y);
    });
  }

  /** A few wordmark crumbs tumbling down from the bite. */
  private crumbs(x: number, y: number): void {
    const ts = textureScale(this, UiTextures.Crumb);
    for (let i = 0; i < 8; i++) {
      const crumb = this.add
        .image(x, y, UiTextures.Crumb)
        .setScale(Phaser.Math.FloatBetween(0.7, 1.3) * ts)
        .setRotation(Math.random() * Math.PI);
      const dx = Phaser.Math.Between(-20, 90);
      this.tweens.add({
        targets: crumb,
        x: x + dx,
        duration: 1100,
        ease: 'Quad.Out',
      });
      this.tweens.add({
        targets: crumb,
        y: y + Phaser.Math.Between(140, 260),
        rotation: crumb.rotation + Phaser.Math.FloatBetween(-4, 4),
        alpha: 0,
        duration: 1100,
        ease: 'Quad.In',
        onComplete: () => crumb.destroy(),
      });
    }
  }

  private leave(target: typeof SceneKeys.Game | typeof SceneKeys.Shop): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(220, 4, 26, 49);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(target);
    });
  }
}
