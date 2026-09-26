// Overlay UI running in parallel with GameScene. Only listens to EventBus events; never
// reads game objects directly. Phase 1: touch boost button + debug overlay.
import Phaser from 'phaser';
import { RegistryKeys, SceneKeys } from '../config/keys';
import { TOUCH_UI, UI_FONT } from '../config/layout';
import {
  EventBus,
  subscribeForScene,
  type BoostState,
  type DebugInfo,
  type InputSource,
} from '../services/EventBus';

export class HudScene extends Phaser.Scene {
  private boostButton!: Phaser.GameObjects.Container;
  private boostRing!: Phaser.GameObjects.Graphics;
  private debugText!: Phaser.GameObjects.Text;
  private boost: BoostState = { active: false, stamina: 1 };

  constructor() {
    super({ key: SceneKeys.Hud });
  }

  create(): void {
    this.createBoostButton();
    this.debugText = this.add
      .text(12, 10, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#e8fbff',
        backgroundColor: 'rgba(0, 20, 40, 0.6)',
        padding: { x: 8, y: 6 },
      })
      .setDepth(100)
      .setVisible(!!this.registry.get(RegistryKeys.Debug));

    subscribeForScene(this, [
      EventBus.on('seal:boost', this.onBoost, this),
      EventBus.on('input:source', this.onInputSource, this),
      EventBus.on('debug:toggle', (on) => this.debugText.setVisible(on)),
      EventBus.on('debug:info', this.onDebugInfo, this),
    ]);
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
        `input     ${d.input}  steer ${d.steerX.toFixed(2)}, ${d.steerY.toFixed(2)}`,
        `particles ${d.particles}   objects ${d.objects}`,
        '` toggles debug',
      ].join('\n'),
    );
  }
}
