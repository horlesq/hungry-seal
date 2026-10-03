// Overlay UI running in parallel with GameScene. Only listens to EventBus events; never
// reads game objects directly.
//
// Top-left status panel: hunger, size progress, boost stamina and frenzy charge.
// Top-right: score, coins, coin-magnet timer and the pause button. Top-centre: combo and
// frenzy callouts. Bottom: first-run hints; bottom-right: the touch boost button.
// Everything is inset by the device safe area.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { RegistryKeys, SceneKeys } from '../config/keys';
import { INPUT } from '../config/balance';
import { boostButtonCenter, pauseButtonCenter, stickHintCenter, TOUCH_UI } from '../config/layout';
import {
  EventBus,
  subscribeForScene,
  type BoostState,
  type ComboState,
  type DebugInfo,
  type FrenzyState,
  type GrowthState,
  type HungerState,
  type InputSource,
  type StickState,
} from '../services/EventBus';
import {
  fitUiCamera,
  getViewport,
  getSafeInsets,
  onResize,
  sharpenTexts,
  textureScale,
} from '../services/Viewport';
import { Button } from '../ui/Button';
import { COLORS, CSS, drawPanel, EDGE, formatNumber, uiText } from '../ui/theme';
import { UiTextures } from '../ui/uiTextures';
import { PEARL_KEY } from '../systems/Pearls';
import { drawBar, drawSegments } from '../ui/widgets';

/** Status panel geometry (relative to its top-left corner). */
const PANEL = { w: 436, h: 106 };
const ROW = { x: 56, right: 416 };
const HUNGER = { y: 15, h: 24 };
const GROWTH = { y: 55, h: 11, w: 262 };
const METERS = { y: 84, h: 9, boostW: 150, gap: 42 };
const COMBO_BAR = { w: 140, h: 6 };

export class HudScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private status!: Phaser.GameObjects.Container;
  private hungerBar!: Phaser.GameObjects.Graphics;
  private growthBar!: Phaser.GameObjects.Graphics;
  private meters!: Phaser.GameObjects.Graphics;
  private stageText!: Phaser.GameObjects.Text;
  private frenzyLabel!: Phaser.GameObjects.Text;
  private frenzy: FrenzyState = { meter: 0, active: false };
  private hintRoot!: Phaser.GameObjects.Container;
  private hintBg!: Phaser.GameObjects.Graphics;
  private hintText!: Phaser.GameObjects.Text;
  private bannerRoot!: Phaser.GameObjects.Container;
  private bannerTitle!: Phaser.GameObjects.Text;
  private bannerBlurb!: Phaser.GameObjects.Text;
  /** Five pips under the banner: how dangerous the region is. */
  private bannerDanger!: Phaser.GameObjects.Graphics;
  private bannerY = 0;
  private scoreRoot!: Phaser.GameObjects.Container;
  private scoreText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private coinIcon!: Phaser.GameObjects.Image;
  private pearlText!: Phaser.GameObjects.Text;
  private pearlIcon!: Phaser.GameObjects.Image;
  private bossRoot: Phaser.GameObjects.Container | null = null;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossName!: Phaser.GameObjects.Text;
  private coins = 0;
  private magnetRoot!: Phaser.GameObjects.Container;
  private magnetText!: Phaser.GameObjects.Text;
  private magnetBg!: Phaser.GameObjects.Graphics;
  private pauseButton!: Button;
  private comboRoot!: Phaser.GameObjects.Container;
  private comboText!: Phaser.GameObjects.Text;
  private comboCount!: Phaser.GameObjects.Text;
  private comboBar!: Phaser.GameObjects.Graphics;
  private vignette!: Phaser.GameObjects.Image;
  private boostButton!: Phaser.GameObjects.Container;
  /** Touch joystick: faint at its hint spot when idle, under the finger while steering. */
  private stick!: Phaser.GameObjects.Container;
  private stickKnob!: Phaser.GameObjects.Graphics;
  private stickActive = false;
  /** "Mission complete" toasts, shown one after another. */
  private toast!: Phaser.GameObjects.Container;
  private toastBg!: Phaser.GameObjects.Graphics;
  private toastText!: Phaser.GameObjects.Text;
  private toastReward!: Phaser.GameObjects.Text;
  private toastQueue: Array<{ text: string; coins: number; gems: number }> = [];
  private toastBusy = false;
  private toastY = 0;
  private boostRing!: Phaser.GameObjects.Graphics;
  private debugText!: Phaser.GameObjects.Text;
  private boost: BoostState = { active: false, stamina: 1 };
  private hunger: HungerState | null = null;
  private displayedScore = 0;
  private targetScore = 0;
  private lowHunger = false;
  /** Red damage flash strength, decays to 0. */
  private hurtFlash = 0;
  private lastMultiplier = 1;

  constructor() {
    super({ key: SceneKeys.Hud });
  }

  create(): void {
    this.boost = { active: false, stamina: 1 };
    this.hunger = null;
    this.displayedScore = 0;
    this.targetScore = 0;
    this.lowHunger = false;
    this.hurtFlash = 0;
    this.lastMultiplier = 1;
    this.coins = 0;
    this.frenzy = { meter: 0, active: false };

    // Behind the rest of the HUD so bars stay readable.
    this.vignette = this.add.image(0, 0, TextureKeys.Vignette).setOrigin(0).setAlpha(0);
    this.root = this.add.container(0, 0);
    this.createStatusPanel();
    this.createScore();
    this.createCombo();
    this.createHintAndBanner();
    this.createBoostButton();
    this.createStick();
    this.createToast();
    this.pauseButton = new Button(this, 0, 0, {
      width: 60,
      height: 60,
      round: true,
      icon: UiTextures.Pause,
      variant: 'quiet',
      onClick: () => EventBus.emit('ui:pause'),
    }).setName('pause');
    this.root.add(this.pauseButton);
    this.debugText = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#e8fbff',
        backgroundColor: 'rgba(0, 20, 40, 0.6)',
        padding: { x: 8, y: 6 },
      })
      .setDepth(100)
      .setVisible(!!this.registry.get(RegistryKeys.Debug));

    subscribeForScene(this, [
      EventBus.on('run:hunger', this.onHunger, this),
      EventBus.on('run:growth', this.onGrowth, this),
      EventBus.on('run:score', (score) => (this.targetScore = score)),
      EventBus.on('run:coins', this.onCoins, this),
      EventBus.on('run:pearls', this.onPearls, this),
      EventBus.on('boss:hp', this.onBossHp, this),
      EventBus.on('run:magnet', this.onMagnet, this),
      EventBus.on('run:combo', this.onCombo, this),
      EventBus.on('run:frenzy', (state) => (this.frenzy = state)),
      EventBus.on('hint', this.onHint, this),
      EventBus.on('zone:enter', this.onZone, this),
      EventBus.on('seal:hurt', () => (this.hurtFlash = 0.9)),
      EventBus.on('run:over', this.onRunOver, this),
      EventBus.on('seal:boost', this.onBoost, this),
      EventBus.on('input:source', this.onInputSource, this),
      EventBus.on('input:stick', this.onStick, this),
      EventBus.on('mission:complete', this.onMission, this),
      EventBus.on('debug:toggle', (on) => this.debugText.setVisible(on)),
      EventBus.on('debug:info', this.onDebugInfo, this),
    ]);

    this.layout();
    onResize(this, () => this.layout());
  }

  /** Anchors everything to the current view edges, inside the device safe area. */
  private layout(): void {
    const v = fitUiCamera(this);
    const safe = getSafeInsets();
    const left = safe.left + EDGE;
    const top = safe.top + EDGE;
    this.vignette.setDisplaySize(v.viewWidth, v.viewHeight);
    this.status.setPosition(left, top);
    const pause = pauseButtonCenter(v.viewWidth, safe);
    this.pauseButton.setPosition(pause.x, pause.y - 3);
    this.scoreRoot.setPosition(pause.x - TOUCH_UI.pauseButton.radius - 22, safe.top + 8);
    // Upright phones: no room beside the status panel, so the centre column starts below it,
    // and hints sit above the joystick and Boost button.
    const narrow = v.portrait;
    const column = narrow ? top + PANEL.h + 30 : top;
    this.comboRoot.setPosition(v.viewWidth / 2, column + 26);
    this.frenzyLabel.setPosition(v.viewWidth / 2, column + 118);
    const hintBottom = narrow ? 300 : 64;
    this.hintRoot.setPosition(v.viewWidth / 2, v.viewHeight - safe.bottom - hintBottom);
    this.hintText.setWordWrapWidth(Math.min(1100, v.viewWidth - 120), true);
    this.bannerBlurb.setWordWrapWidth(v.viewWidth - 80, true);
    this.bannerY = column + 150;
    this.toastY = column + 262;
    this.toast.setPosition(v.viewWidth / 2, this.toastY);
    this.bannerRoot.setPosition(v.viewWidth / 2, this.bannerY);
    this.debugText.setPosition(left, top + PANEL.h + 14);
    const b = boostButtonCenter(v.viewWidth, v.viewHeight, safe);
    this.boostButton.setPosition(b.x, b.y);
    if (!this.stickActive) this.placeStickHint();
    sharpenTexts(this);
    this.onCoins(this.coins);
  }

  override update(time: number, delta: number): void {
    // Red edges: pulse while starving, flash when hurt.
    this.hurtFlash = Math.max(0, this.hurtFlash - delta / 450);
    const low = this.lowHunger ? 0.35 + 0.25 * Math.sin(time * 0.006) : 0;
    this.vignette.setAlpha(Math.max(low, this.hurtFlash));
    this.drawMeters(time);
    if (this.hunger?.low) this.drawHunger(time);

    // Roll the score up instead of jumping.
    if (this.displayedScore !== this.targetScore) {
      const step = Math.max(1, Math.ceil((this.targetScore - this.displayedScore) * delta * 0.012));
      this.displayedScore = Math.min(this.targetScore, this.displayedScore + step);
      this.scoreText.setText(formatNumber(this.displayedScore));
    }
  }

  private createStatusPanel(): void {
    const bg = drawPanel(this.add.graphics(), 0, 0, PANEL.w, PANEL.h, {
      radius: 22,
      alpha: 0.55,
      line: 0.14,
    });
    const icon = (key: string, y: number, size: number) => {
      const img = this.add.image(30, y, key).setTint(COLORS.foam);
      return img.setScale(size / img.frame.width);
    };
    this.hungerBar = this.add.graphics();
    this.growthBar = this.add.graphics();
    this.meters = this.add.graphics();
    this.stageText = uiText(this, ROW.x + GROWTH.w + 14, GROWTH.y + GROWTH.h / 2, '', 'caption', {
      weight: 800,
      color: CSS.foam,
    }).setOrigin(0, 0.5);
    const meterY = METERS.y + METERS.h / 2;
    const flame = this.add
      .image(ROW.x + METERS.boostW + METERS.gap / 2, meterY, UiTextures.Flame)
      .setTint(COLORS.buoy);
    flame.setScale(22 / flame.frame.width);
    this.status = this.add.container(0, 0, [
      bg,
      this.hungerBar,
      this.growthBar,
      this.meters,
      icon(UiTextures.Fish, HUNGER.y + HUNGER.h / 2, 32),
      icon(UiTextures.Grow, GROWTH.y + GROWTH.h / 2, 24),
      icon(UiTextures.Bolt, meterY, 22).setTint(COLORS.glacier),
      flame,
      this.stageText,
    ]);
    this.root.add(this.status);

    this.frenzyLabel = uiText(this, 0, 0, 'Frenzy!', 'title', {
      size: 44,
      color: CSS.buoy,
      outline: 8,
      shadow: 4,
    })
      .setOrigin(0.5)
      .setVisible(false);
    this.root.add(this.frenzyLabel);
  }

  private drawHunger(time: number): void {
    const state = this.hunger;
    if (!state) return;
    const frac = Phaser.Math.Clamp(state.value / state.max, 0, 1);
    const color = frac > 0.5 ? COLORS.kelp : frac > 0.25 ? COLORS.gold : COLORS.coral;
    // Flash when low.
    const alpha = state.low ? 0.55 + 0.45 * Math.sin(time * 0.015) : 1;
    this.hungerBar.clear();
    drawBar(this.hungerBar, ROW.x, HUNGER.y, ROW.right - ROW.x, HUNGER.h, frac, color, alpha);
  }

  /** Boost stamina and frenzy charge (bottom row); the frenzy bar pulses while active. */
  private drawMeters(time: number): void {
    const g = this.meters;
    const f = this.frenzy;
    g.clear();
    const boostColor = this.boost.active ? COLORS.gold : COLORS.glacier;
    drawBar(g, ROW.x, METERS.y, METERS.boostW, METERS.h, this.boost.stamina, boostColor);
    const fx = ROW.x + METERS.boostW + METERS.gap;
    const pulse = f.active && Math.floor(time / 120) % 2 === 0;
    drawBar(g, fx, METERS.y, ROW.right - fx, METERS.h, f.meter, pulse ? COLORS.gold : COLORS.buoy);
    this.frenzyLabel.setVisible(f.active).setScale(1 + 0.06 * Math.sin(time * 0.02));
  }

  private createScore(): void {
    this.scoreText = uiText(this, 0, 0, '0', 'number', { size: 46 }).setOrigin(1, 0);
    this.coinText = uiText(this, 0, 62, '0', 'heading', {
      size: 28,
      color: CSS.gold,
      outline: 6,
    }).setOrigin(1, 0);
    this.coinIcon = this.add
      .image(0, 0, TextureKeys.Coin)
      .setScale(0.95 * textureScale(this, TextureKeys.Coin));
    // Pearls found on this map.
    this.pearlText = uiText(this, 0, 100, '', 'heading', {
      size: 24,
      color: '#ffd6f5',
      outline: 6,
    }).setOrigin(1, 0);
    this.pearlIcon = this.add.image(0, 0, PEARL_KEY);
    this.pearlIcon.setScale(26 / this.pearlIcon.width);

    // Coin-magnet timer chip (hidden until a magnet orb is grabbed).
    this.magnetBg = this.add.graphics();
    const magnet = this.add.image(0, 0, UiTextures.Magnet).setTint(0xff8a3d);
    magnet.setScale(22 / magnet.frame.width).setName('icon');
    this.magnetText = uiText(this, 0, 0, '', 'caption', { weight: 800, color: CSS.foam }).setOrigin(
      1,
      0.5,
    );
    this.magnetRoot = this.add
      .container(0, 160, [this.magnetBg, magnet, this.magnetText])
      .setVisible(false);
    this.scoreRoot = this.add.container(0, 0, [
      this.scoreText,
      this.coinIcon,
      this.coinText,
      this.pearlIcon,
      this.pearlText,
      this.magnetRoot,
    ]);
    this.root.add(this.scoreRoot);
    this.onCoins(0);
  }

  private onCoins(coins: number): void {
    this.coins = coins;
    this.coinText.setText(formatNumber(coins));
    // Keep the icon just left of the right-aligned number as it grows.
    this.coinIcon.setPosition(-this.coinText.width - 18, 62 + this.coinText.height / 2);
  }

  /** Boss health bar, top centre, while the seal is in the lair. */
  private onBossHp(b: { name: string; hp: number; max: number; show: boolean }): void {
    if (!this.bossRoot) {
      this.bossBar = this.add.graphics();
      this.bossName = uiText(this, 0, 0, '', 'heading', { size: 26, outline: 6 }).setOrigin(0.5, 1);
      this.bossRoot = this.add.container(0, 0, [this.bossBar, this.bossName]);
    }
    const v = getViewport();
    this.bossRoot.setPosition(v.viewWidth / 2, getSafeInsets().top + 168).setVisible(b.show);
    if (!b.show) return;
    this.bossName.setText(b.name);
    const w = 360;
    const g = this.bossBar.clear();
    drawBar(g, -w / 2, 6, w, 18, b.hp / b.max, COLORS.coral);
    // Heart notches.
    g.lineStyle(2, COLORS.trench, 0.9);
    for (let i = 1; i < b.max; i++) g.lineBetween(-w / 2 + (w * i) / b.max, 6, -w / 2 + (w * i) / b.max, 24);
  }

  private onPearls(p: { found: number; total: number }): void {
    this.pearlText.setText(`${p.found}/${p.total}`);
    this.pearlIcon.setPosition(-this.pearlText.width - 18, 100 + this.pearlText.height / 2);
  }

  private onMagnet(seconds: number): void {
    this.magnetRoot.setVisible(seconds > 0);
    if (seconds <= 0) return;
    this.magnetText.setText(`${seconds}s`);
    const w = this.magnetText.width + 58;
    const h = 34;
    this.magnetBg.clear();
    drawPanel(this.magnetBg, -w, -h / 2, w, h, { radius: h / 2, alpha: 0.6, line: 0.18 });
    this.magnetText.setX(-14);
    (this.magnetRoot.getByName('icon') as Phaser.GameObjects.Image).setX(-w + 22);
  }

  /** Bottom-centre tutorial hint and the zone banner (both hidden at start). */
  private createHintAndBanner(): void {
    this.hintBg = this.add.graphics();
    this.hintText = uiText(this, 0, 0, '', 'body', { size: 22, weight: 700, align: 'center' });
    this.hintText.setOrigin(0.5);
    this.hintRoot = this.add.container(0, 0, [this.hintBg, this.hintText]).setAlpha(0);

    this.bannerTitle = uiText(this, 0, 0, '', 'title', { size: 52 }).setOrigin(0.5);
    // Top-anchored so a blurb that wraps onto two lines grows downward, away from the title.
    this.bannerBlurb = uiText(this, 0, 32, '', 'body', {
      weight: 700,
      align: 'center',
      color: CSS.foam,
      outline: 5,
    }).setOrigin(0.5, 0);
    this.bannerDanger = this.add.graphics();
    this.bannerRoot = this.add
      .container(0, 0, [this.bannerTitle, this.bannerBlurb, this.bannerDanger])
      .setAlpha(0);
  }

  private onHint(text: string | null): void {
    this.tweens.killTweensOf(this.hintRoot);
    if (!text) {
      this.tweens.add({ targets: this.hintRoot, alpha: 0, duration: 250 });
      return;
    }
    this.hintText.setText(text);
    const w = this.hintText.width + 56;
    const h = Math.max(56, this.hintText.height + 22);
    this.hintBg.clear();
    drawPanel(this.hintBg, -w / 2, -h / 2, w, h, {
      radius: Math.min(h / 2, 28),
      alpha: 0.84,
      line: 0,
    });
    this.hintBg.lineStyle(2, COLORS.glacier, 0.45).strokeRoundedRect(-w / 2, -h / 2, w, h, 28);
    this.hintRoot.setAlpha(0).setScale(0.94);
    this.tweens.add({
      targets: this.hintRoot,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: 'Back.Out',
    });
  }

  private onZone(zone: { name: string; blurb: string; danger?: number }): void {
    this.bannerTitle.setText(zone.name);
    this.bannerBlurb.setText(zone.blurb);
    this.drawDanger(zone.danger ?? 0);
    this.tweens.killTweensOf(this.bannerRoot);
    const y = this.bannerY;
    this.bannerRoot.setAlpha(0).setY(y - 20);
    this.tweens.chain({
      targets: this.bannerRoot,
      tweens: [
        { alpha: 1, y, duration: 350, ease: 'Quad.Out' },
        { alpha: 0, y: y - 10, delay: 2200, duration: 500 },
      ],
    });
  }

  /** Danger rating as 5 pips (calm green, gold, coral red), under the blurb. */
  private drawDanger(danger: number): void {
    const g = this.bannerDanger.clear();
    if (danger <= 0) return;
    const color = danger <= 2 ? COLORS.kelp : danger === 3 ? COLORS.gold : COLORS.coral;
    const y = this.bannerBlurb.y + this.bannerBlurb.height + 18;
    const gap = 26;
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * gap;
      g.fillStyle(COLORS.trench, 0.75).fillCircle(x, y, 10);
      if (i < danger) g.fillStyle(color, 1).fillCircle(x, y, 7);
      else g.lineStyle(2, COLORS.mist, 0.5).strokeCircle(x, y, 6);
    }
  }

  /** Top-centre combo readout: multiplier, meal count and a shrinking timer bar. */
  private createCombo(): void {
    this.comboText = uiText(this, 0, 0, 'x2', 'number', {
      size: 48,
      color: CSS.gold,
    }).setOrigin(0.5, 0.5);
    this.comboCount = uiText(this, 0, 36, '', 'caption', {
      weight: 800,
      color: CSS.foam,
      outline: 4,
    }).setOrigin(0.5, 0.5);
    this.comboBar = this.add.graphics();
    this.comboRoot = this.add
      .container(0, 0, [this.comboBar, this.comboText, this.comboCount])
      .setVisible(false);
    this.root.add(this.comboRoot);
  }

  private onCombo(state: ComboState): void {
    if (state.count === 0) {
      this.comboRoot.setVisible(false);
      this.lastMultiplier = 1;
      return;
    }
    this.comboRoot.setVisible(true);
    this.comboText.setText(`x${state.multiplier}`);
    this.comboCount.setText(`${state.count} combo`);
    if (state.multiplier > this.lastMultiplier) {
      this.tweens.add({ targets: this.comboText, scale: { from: 1.6, to: 1 }, duration: 250 });
    }
    this.lastMultiplier = state.multiplier;
    this.comboBar.clear();
    drawBar(
      this.comboBar,
      -COMBO_BAR.w / 2,
      52,
      COMBO_BAR.w,
      COMBO_BAR.h,
      state.remaining,
      COLORS.gold,
    );
  }

  private onHunger(state: HungerState): void {
    this.hunger = state;
    this.lowHunger = state.low;
    this.drawHunger(this.time.now);
  }

  private onGrowth(state: GrowthState): void {
    const segments = state.maxStage - 1;
    const max = state.stage >= state.maxStage;
    const filled = max ? segments : state.stage - 1 + state.progress;
    this.growthBar.clear();
    drawSegments(
      this.growthBar,
      ROW.x,
      GROWTH.y,
      GROWTH.w,
      GROWTH.h,
      segments,
      filled,
      max ? COLORS.gold : COLORS.glacier,
    );
    this.stageText
      .setText(max ? 'Max size' : `Size ${state.stage}`)
      .setColor(max ? CSS.gold : CSS.foam);
  }

  private onRunOver(): void {
    this.lowHunger = false;
    // The results screen lists completed missions; don't keep toasting over it.
    this.toastQueue = [];
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, alpha: 0, duration: 300 });
    this.tweens.add({
      targets: [this.root, this.boostButton, this.stick, this.hintRoot, this.bannerRoot],
      alpha: 0,
      duration: 800,
    });
  }

  private createBoostButton(): void {
    const b = TOUCH_UI.boostButton;
    const bg = this.add.graphics();
    // Positioned in layout().
    bg.fillStyle(COLORS.ink, 0.5).fillCircle(0, 0, b.radius);
    bg.lineStyle(3, COLORS.foam, 0.55).strokeCircle(0, 0, b.radius);
    const bolt = this.add.image(0, -12, UiTextures.Bolt).setTint(COLORS.foam);
    bolt.setScale(44 / bolt.frame.width);
    const label = uiText(this, 0, 28, 'Boost', 'caption', { weight: 800, color: CSS.foam });
    label.setOrigin(0.5);
    this.boostRing = this.add.graphics();
    this.boostButton = this.add.container(0, 0, [bg, this.boostRing, bolt, label]);
    this.boostButton.setVisible(this.sys.game.device.input.touch);
    this.drawBoostRing();
  }

  private drawBoostRing(): void {
    const r = TOUCH_UI.boostButton.radius + 9;
    const g = this.boostRing;
    g.clear();
    g.lineStyle(8, COLORS.trench, 0.45).strokeCircle(0, 0, r);
    g.lineStyle(8, this.boost.active ? COLORS.gold : COLORS.glacier, 1);
    g.beginPath();
    g.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.boost.stamina);
    g.strokePath();
  }

  private onBoost(state: BoostState): void {
    this.boost = state;
    this.boostButton.setScale(state.active ? 0.92 : 1);
    this.drawBoostRing();
  }

  private createToast(): void {
    this.toastQueue = [];
    this.toastBusy = false;
    this.toastBg = this.add.graphics();
    const check = this.add.image(0, 0, UiTextures.Check).setTint(COLORS.gold).setName('check');
    check.setScale(28 / check.frame.width);
    const label = uiText(this, 0, -14, 'Mission complete', 'caption', {
      size: 14,
      weight: 800,
      color: CSS.gold,
    })
      .setOrigin(0, 0.5)
      .setName('label');
    this.toastText = uiText(this, 0, 10, '', 'body', { size: 20, weight: 800 }).setOrigin(0, 0.5);
    this.toastReward = uiText(this, 0, 0, '', 'heading', { size: 22, color: CSS.gold }).setOrigin(
      1,
      0.5,
    );
    this.toast = this.add
      .container(0, 0, [this.toastBg, check, label, this.toastText, this.toastReward])
      .setAlpha(0);
  }

  private onMission(info: { text: string; coins: number; gems: number }): void {
    this.toastQueue.push(info);
    if (!this.toastBusy) this.nextToast();
  }

  private nextToast(): void {
    const info = this.toastQueue.shift();
    if (!info) {
      this.toastBusy = false;
      return;
    }
    this.toastBusy = true;
    this.toastText.setText(info.text);
    this.toastReward.setText(
      `+${formatNumber(info.coins)} coins${info.gems ? `  +${info.gems} gem${info.gems > 1 ? 's' : ''}` : ''}`,
    );
    const label = this.toast.getByName('label') as Phaser.GameObjects.Text;
    const textW = Math.max(label.width, this.toastText.width);
    const w = 20 + 30 + 14 + textW + 28 + this.toastReward.width + 22;
    const h = 66;
    this.toastBg.clear();
    drawPanel(this.toastBg, -w / 2, -h / 2, w, h, { radius: 22, alpha: 0.9, line: 0 });
    this.toastBg.lineStyle(2, COLORS.gold, 0.8).strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
    const left = -w / 2 + 20;
    (this.toast.getByName('check') as Phaser.GameObjects.Image).setX(left + 15);
    label.setX(left + 44);
    this.toastText.setX(left + 44);
    this.toastReward.setX(w / 2 - 22);
    this.toast.setAlpha(0).setY(this.toastY - 14);
    this.tweens.chain({
      targets: this.toast,
      tweens: [
        { alpha: 1, y: this.toastY, duration: 260, ease: 'Back.Out' },
        { alpha: 0, delay: 2400, duration: 320 },
      ],
      onComplete: () => this.nextToast(),
    });
  }

  private createStick(): void {
    const r = INPUT.stick.radius;
    const base = this.add.graphics();
    base.fillStyle(COLORS.ink, 0.35).fillCircle(0, 0, r);
    base.lineStyle(3, COLORS.foam, 0.5).strokeCircle(0, 0, r);
    this.stickKnob = this.add.graphics();
    this.stickKnob.fillStyle(COLORS.ink, 0.5).fillCircle(0, 3, TOUCH_UI.stickKnob);
    this.stickKnob.fillStyle(COLORS.foam, 0.9).fillCircle(0, 0, TOUCH_UI.stickKnob);
    this.stick = this.add.container(0, 0, [base, this.stickKnob]);
    this.stick.setVisible(this.sys.game.device.input.touch);
    this.stickActive = false;
    this.placeStickHint();
  }

  private placeStickHint(): void {
    const v = getViewport();
    const c = stickHintCenter(v.viewHeight, getSafeInsets());
    this.stick.setPosition(c.x, c.y).setAlpha(0.35);
    this.stickKnob.setPosition(0, 0);
  }

  private onStick(state: StickState): void {
    this.stickActive = state.active;
    if (!state.active) {
      this.placeStickHint();
      return;
    }
    const r = INPUT.stick.radius;
    this.stick.setVisible(true).setPosition(state.x, state.y).setAlpha(0.9);
    this.stickKnob.setPosition(state.dx * r, state.dy * r);
  }

  private onInputSource(source: InputSource): void {
    if (source === 'touch') {
      this.boostButton.setVisible(true);
      this.stick.setVisible(true);
    }
  }

  private onDebugInfo(d: DebugInfo): void {
    if (!this.debugText.visible) return;
    this.debugText.setText(
      [
        `FPS       ${d.fps.toFixed(0)}`,
        `pos       ${d.x.toFixed(0)}, ${d.y.toFixed(0)}`,
        `depth     ${d.depthM.toFixed(1)} m  (${d.zone})`,
        `speed     ${d.speed.toFixed(0)} px/s  hdg ${d.headingDeg.toFixed(0)}°`,
        `water     ${d.inWater ? 'in' : 'AIR'}`,
        `stamina   ${(d.stamina * 100).toFixed(0)}%${d.boosting ? '  BOOST' : ''}`,
        `hunger    ${d.hunger.toFixed(1)}  -${d.drain.toFixed(2)}/s`,
        `stage     ${d.stage}   run ${d.elapsed.toFixed(0)}s`,
        `input     ${d.input}  steer ${d.steerX.toFixed(2)}, ${d.steerY.toFixed(2)}`,
        `creatures ${d.creatures}  hazards ${d.hazards}  coins ${d.coins}`,
        `predators ${d.predators}`,
        `particles ${d.particles}  objects ${d.objects}`,
        '` toggles debug',
      ].join('\n'),
    );
  }
}
