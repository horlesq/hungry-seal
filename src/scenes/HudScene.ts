// Overlay UI running in parallel with GameScene. Only listens to EventBus events; never
// reads game objects directly. Hunger bar, growth meter, score, touch boost button, debug.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { RegistryKeys, SceneKeys } from '../config/keys';
import { GAME_WIDTH, TOUCH_UI, UI_FONT } from '../config/layout';
import {
  EventBus,
  subscribeForScene,
  type BoostState,
  type DebugInfo,
  type GrowthState,
  type HungerState,
  type InputSource,
} from '../services/EventBus';

const BAR = { x: 84, y: 20, w: 330, h: 26 };
const GROW = { x: 84, y: 52, w: 330, h: 10 };

export class HudScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private hungerBar!: Phaser.GameObjects.Graphics;
  private growthBar!: Phaser.GameObjects.Graphics;
  private stageText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private boostButton!: Phaser.GameObjects.Container;
  private boostRing!: Phaser.GameObjects.Graphics;
  private debugText!: Phaser.GameObjects.Text;
  private boost: BoostState = { active: false, stamina: 1 };
  private displayedScore = 0;
  private targetScore = 0;

  constructor() {
    super({ key: SceneKeys.Hud });
  }

  create(): void {
    this.boost = { active: false, stamina: 1 };
    this.displayedScore = 0;
    this.targetScore = 0;

    this.root = this.add.container(0, 0);
    this.createStatusPanel();
    this.createScore();
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
      EventBus.on('run:over', this.onRunOver, this),
      EventBus.on('seal:boost', this.onBoost, this),
      EventBus.on('input:source', this.onInputSource, this),
      EventBus.on('debug:toggle', (on) => this.debugText.setVisible(on)),
      EventBus.on('debug:info', this.onDebugInfo, this),
    ]);
  }

  override update(_time: number, delta: number): void {
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
    this.root.add([label, this.scoreText]);
  }

  private onHunger(state: HungerState): void {
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
    this.tweens.add({ targets: [this.root, this.boostButton], alpha: 0, duration: 800 });
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
        `stage     ${d.stage}`,
        `input     ${d.input}  steer ${d.steerX.toFixed(2)}, ${d.steerY.toFixed(2)}`,
        `creatures ${d.creatures}  particles ${d.particles}  objects ${d.objects}`,
        '` toggles debug',
      ].join('\n'),
    );
  }
}
