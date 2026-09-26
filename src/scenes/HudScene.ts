// Overlay UI running in parallel with GameScene. Only listens to EventBus events; never
// reads game objects directly. Hunger bar, growth meter, score, coins, combo, damage
// vignette, touch boost button, debug.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { RegistryKeys, SceneKeys } from '../config/keys';
import { GAME_HEIGHT, GAME_WIDTH, TOUCH_UI, UI_FONT } from '../config/layout';
import {
  EventBus,
  subscribeForScene,
  type BoostState,
  type ComboState,
  type DebugInfo,
  type GrowthState,
  type HungerState,
  type InputSource,
} from '../services/EventBus';

const BAR = { x: 84, y: 20, w: 330, h: 26 };
const GROW = { x: 84, y: 52, w: 330, h: 10 };
const COMBO_BAR = { w: 150, h: 8 };

export class HudScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private hungerBar!: Phaser.GameObjects.Graphics;
  private growthBar!: Phaser.GameObjects.Graphics;
  private stageText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private coinIcon!: Phaser.GameObjects.Image;
  private comboRoot!: Phaser.GameObjects.Container;
  private comboText!: Phaser.GameObjects.Text;
  private comboCount!: Phaser.GameObjects.Text;
  private comboBar!: Phaser.GameObjects.Graphics;
  private vignette!: Phaser.GameObjects.Image;
  private boostButton!: Phaser.GameObjects.Container;
  private boostRing!: Phaser.GameObjects.Graphics;
  private debugText!: Phaser.GameObjects.Text;
  private boost: BoostState = { active: false, stamina: 1 };
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
    this.displayedScore = 0;
    this.targetScore = 0;
    this.lowHunger = false;
    this.hurtFlash = 0;
    this.lastMultiplier = 1;

    // Behind the rest of the HUD so bars stay readable.
    this.vignette = this.add
      .image(0, 0, TextureKeys.Vignette)
      .setOrigin(0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(0);
    this.root = this.add.container(0, 0);
    this.createStatusPanel();
    this.createScore();
    this.createCombo();
    this.createBoostButton();
    this.debugText = this.add
      .text(12, 82, '', {
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
      EventBus.on('run:combo', this.onCombo, this),
      EventBus.on('seal:hurt', () => (this.hurtFlash = 0.9)),
      EventBus.on('run:over', this.onRunOver, this),
      EventBus.on('seal:boost', this.onBoost, this),
      EventBus.on('input:source', this.onInputSource, this),
      EventBus.on('debug:toggle', (on) => this.debugText.setVisible(on)),
      EventBus.on('debug:info', this.onDebugInfo, this),
    ]);
  }

  override update(time: number, delta: number): void {
    // Red edges: pulse while starving, flash when hurt.
    this.hurtFlash = Math.max(0, this.hurtFlash - delta / 450);
    const low = this.lowHunger ? 0.35 + 0.25 * Math.sin(time * 0.006) : 0;
    this.vignette.setAlpha(Math.max(low, this.hurtFlash));

    // Roll the score up instead of jumping.
    if (this.displayedScore !== this.targetScore) {
      const step = Math.max(1, Math.ceil((this.targetScore - this.displayedScore) * delta * 0.012));
      this.displayedScore = Math.min(this.targetScore, this.displayedScore + step);
      this.scoreText.setText(String(this.displayedScore));
    }
  }

  private createStatusPanel(): void {
    const icon = this.add.image(44, 40, TextureKeys.Seal).setScale(0.36);
    const label = this.add.text(BAR.x + 10, BAR.y + BAR.h / 2, 'HUNGER', {
      fontFamily: UI_FONT,
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#0b3a66',
      strokeThickness: 4,
    });
    label.setOrigin(0, 0.5);
    this.hungerBar = this.add.graphics();
    this.growthBar = this.add.graphics();
    this.stageText = this.add.text(GROW.x + GROW.w + 10, GROW.y + GROW.h / 2, '', {
      fontFamily: UI_FONT,
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#7dfcff',
      stroke: '#0b3a66',
      strokeThickness: 4,
    });
    this.stageText.setOrigin(0, 0.5);
    this.root.add([this.hungerBar, this.growthBar, icon, label, this.stageText]);
  }

  private createScore(): void {
    const label = this.add
      .text(GAME_WIDTH - 24, 14, 'SCORE', {
        fontFamily: UI_FONT,
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#d8f6ff',
        stroke: '#0b3a66',
        strokeThickness: 4,
      })
      .setOrigin(1, 0);
    this.scoreText = this.add
      .text(GAME_WIDTH - 24, 32, '0', {
        fontFamily: UI_FONT,
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#0b3a66',
        strokeThickness: 8,
      })
      .setOrigin(1, 0);
    this.coinText = this.add
      .text(GAME_WIDTH - 24, 84, '0', {
        fontFamily: UI_FONT,
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffe066',
        stroke: '#0b3a66',
        strokeThickness: 6,
      })
      .setOrigin(1, 0);
    this.coinIcon = this.add.image(0, 0, TextureKeys.Coin).setScale(0.9);
    this.onCoins(0);
    this.root.add([label, this.scoreText, this.coinIcon, this.coinText]);
  }

  private onCoins(coins: number): void {
    this.coinText.setText(String(coins));
    // Keep the icon just left of the right-aligned number as it grows.
    this.coinIcon.setPosition(this.coinText.x - this.coinText.width - 18, 101);
  }

  /** Top-centre combo readout: multiplier, meal count and a shrinking timer bar. */
  private createCombo(): void {
    this.comboText = this.add
      .text(0, 0, 'x2', {
        fontFamily: UI_FONT,
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#ffb3ff',
        stroke: '#3a0b4a',
        strokeThickness: 8,
      })
      .setOrigin(0.5, 0.5);
    this.comboCount = this.add
      .text(0, 30, '', {
        fontFamily: UI_FONT,
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#3a0b4a',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0.5);
    this.comboBar = this.add.graphics();
    this.comboRoot = this.add
      .container(GAME_WIDTH / 2, 40, [this.comboBar, this.comboText, this.comboCount])
      .setVisible(false);
  }

  private onCombo(state: ComboState): void {
    if (state.count === 0) {
      this.comboRoot.setVisible(false);
      this.lastMultiplier = 1;
      return;
    }
    this.comboRoot.setVisible(true);
    this.comboText.setText(`x${state.multiplier}`);
    this.comboCount.setText(`${state.count} COMBO`);
    if (state.multiplier > this.lastMultiplier) {
      this.tweens.add({ targets: this.comboText, scale: { from: 1.6, to: 1 }, duration: 250 });
    }
    this.lastMultiplier = state.multiplier;
    const g = this.comboBar;
    g.clear();
    g.fillStyle(0x3a0b4a, 0.6).fillRoundedRect(-COMBO_BAR.w / 2, 46, COMBO_BAR.w, COMBO_BAR.h, 4);
    g.fillStyle(0xffb3ff, 1).fillRoundedRect(
      -COMBO_BAR.w / 2,
      46,
      Math.max(COMBO_BAR.h, COMBO_BAR.w * state.remaining),
      COMBO_BAR.h,
      4,
    );
  }

  private onHunger(state: HungerState): void {
    this.lowHunger = state.low;
    const frac = Phaser.Math.Clamp(state.value / state.max, 0, 1);
    const color = frac > 0.5 ? 0x5ee07a : frac > 0.25 ? 0xffd84d : 0xff5a4f;
    // Flash when low.
    const alpha = state.low ? 0.55 + 0.45 * Math.sin(this.time.now * 0.015) : 1;

    const g = this.hungerBar;
    g.clear();
    g.fillStyle(0x03203a, 0.7).fillRoundedRect(BAR.x - 3, BAR.y - 3, BAR.w + 6, BAR.h + 6, 10);
    if (frac > 0) {
      const w = Math.max(BAR.h, BAR.w * frac);
      g.fillStyle(color, alpha).fillRoundedRect(BAR.x, BAR.y, w, BAR.h, 8);
      g.fillStyle(0xffffff, 0.25 * alpha).fillRoundedRect(BAR.x + 4, BAR.y + 3, w - 8, 6, 3);
    }
    g.lineStyle(2, 0xffffff, 0.85).strokeRoundedRect(
      BAR.x - 3,
      BAR.y - 3,
      BAR.w + 6,
      BAR.h + 6,
      10,
    );
  }

  private onGrowth(state: GrowthState): void {
    const g = this.growthBar;
    g.clear();
    g.fillStyle(0x03203a, 0.7).fillRoundedRect(GROW.x - 2, GROW.y - 2, GROW.w + 4, GROW.h + 4, 6);
    if (state.progress > 0) {
      g.fillStyle(0x6ff3ff, 1).fillRoundedRect(
        GROW.x,
        GROW.y,
        Math.max(GROW.h, GROW.w * state.progress),
        GROW.h,
        5,
      );
    }
    this.stageText.setText(
      state.stage >= state.maxStage ? `SIZE MAX` : `SIZE ${state.stage}/${state.maxStage}`,
    );
  }

  private onRunOver(): void {
    this.lowHunger = false;
    this.tweens.add({
      targets: [this.root, this.boostButton, this.comboRoot],
      alpha: 0,
      duration: 800,
    });
  }

  private createBoostButton(): void {
    const b = TOUCH_UI.boostButton;
    const bg = this.add.graphics();
    bg.fillStyle(0x03203a, 0.45).fillCircle(0, 0, b.radius);
    bg.lineStyle(4, 0xffffff, 0.8).strokeCircle(0, 0, b.radius);
    const label = this.add
      .text(0, 0, 'BOOST', {
        fontFamily: UI_FONT,
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.boostRing = this.add.graphics();
    this.boostButton = this.add.container(b.x, b.y, [bg, this.boostRing, label]);
    this.boostButton.setVisible(this.sys.game.device.input.touch);
    this.drawBoostRing();
  }

  private drawBoostRing(): void {
    const r = TOUCH_UI.boostButton.radius + 9;
    const g = this.boostRing;
    g.clear();
    g.lineStyle(8, 0x000000, 0.25).strokeCircle(0, 0, r);
    const color = this.boost.active ? 0xffe066 : 0x6ff3ff;
    g.lineStyle(8, color, 1);
    g.beginPath();
    g.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.boost.stamina);
    g.strokePath();
  }

  private onBoost(state: BoostState): void {
    this.boost = state;
    this.boostButton.setScale(state.active ? 0.92 : 1);
    this.drawBoostRing();
  }

  private onInputSource(source: InputSource): void {
    if (source === 'touch') this.boostButton.setVisible(true);
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
