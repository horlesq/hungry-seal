// Settings overlay (from the title screen or the pause menu): music and sound-effect volume,
// screen shake, and high-contrast warnings. Changes apply and save immediately.
// Keys: arrows / Tab + Enter, Esc = done.
import Phaser from 'phaser';
import { SoundKeys } from '../audio/sounds';
import { SceneKeys, type SceneKey } from '../config/keys';
import type { Settings } from '../services/saveData';
import { audio } from '../services/AudioManager';
import { saves } from '../services/SaveService';
import { fitUiCamera, onResize, sharpenTexts } from '../services/Viewport';
import { Button } from '../ui/Button';
import { FocusNav } from '../ui/FocusNav';
import { COLORS, CSS, drawPanel, uiText } from '../ui/theme';
import { drawBar } from '../ui/widgets';

const PANEL = { w: 600, h: 500 };
const STEP = 0.1;

interface Slider {
  key: 'music' | 'sfx';
  bar: Phaser.GameObjects.Graphics;
  value: Phaser.GameObjects.Text;
  x: number;
  y: number;
  w: number;
}

export class SettingsScene extends Phaser.Scene {
  private from: SceneKey = SceneKeys.Menu;
  private sliders: Slider[] = [];
  private toggles: Array<{ key: 'shake' | 'highContrast'; button: Button }> = [];
  private closing = false;

  constructor() {
    super({ key: SceneKeys.Settings });
  }

  create(data: { from?: SceneKey } = {}): void {
    this.from = data.from ?? SceneKeys.Menu;
    this.sliders = [];
    this.toggles = [];
    this.closing = false;
    const v = fitUiCamera(this);
    const cx = v.viewWidth / 2;
    const cy = v.viewHeight / 2;
    const left = cx - PANEL.w / 2;
    const top = cy - PANEL.h / 2;

    this.add.rectangle(0, 0, v.viewWidth, v.viewHeight, COLORS.trench, 0.6).setOrigin(0).setInteractive();
    drawPanel(this.add.graphics(), left, top, PANEL.w, PANEL.h, { alpha: 0.96, depth: 6 });
    uiText(this, cx, top + 50, 'Settings', 'title', { size: 46 }).setOrigin(0.5);

    const buttons: Button[] = [];
    buttons.push(...this.slider('music', 'Music', left + 40, top + 130));
    buttons.push(...this.slider('sfx', 'Sound effects', left + 40, top + 210));
    buttons.push(this.toggle('shake', 'Screen shake', left + 40, top + 290));
    buttons.push(this.toggle('highContrast', 'High-contrast warnings', left + 40, top + 360));
    const done = new Button(this, cx, top + PANEL.h - 52, {
      width: 260,
      height: 68,
      label: 'Done',
      variant: 'primary',
      fontSize: 30,
      onClick: () => this.close(),
    }).setName('done');
    buttons.push(done);

    new FocusNav(this).add(...buttons);
    this.input.keyboard!.on('keydown-ESC', () => this.close());
    this.refresh();
    sharpenTexts(this);
    onResize(this, () => {
      if (!this.closing) this.scene.restart({ from: this.from });
    });
  }

  /** Label, - button, bar (click to set), + button, percentage. */
  private slider(key: Slider['key'], label: string, x: number, y: number): Button[] {
    uiText(this, x, y, label, 'body', { size: 22, weight: 800 }).setOrigin(0, 0.5);
    const barX = x + 250;
    const barW = 170;
    const minus = new Button(this, barX - 32, y, {
      width: 48,
      height: 48,
      round: true,
      label: '−',
      variant: 'quiet',
      fontSize: 28,
      onClick: () => this.nudge(key, -STEP),
    }).setName(`${key}-down`);
    const plus = new Button(this, barX + barW + 32, y, {
      width: 48,
      height: 48,
      round: true,
      label: '+',
      variant: 'quiet',
      fontSize: 28,
      onClick: () => this.nudge(key, STEP),
    }).setName(`${key}-up`);
    const bar = this.add.graphics();
    const hit = this.add.zone(barX, y - 16, barW, 32).setOrigin(0).setInteractive({ useHandCursor: true });
    const setFrom = (p: Phaser.Input.Pointer) => this.set(key, (p.worldX - barX) / barW);
    hit.on(Phaser.Input.Events.POINTER_DOWN, setFrom);
    hit.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (p.isDown) setFrom(p);
    });
    const value = uiText(this, barX + barW + 70, y, '', 'caption', { size: 18, color: CSS.mist }).setOrigin(
      0,
      0.5,
    );
    this.sliders.push({ key, bar, value, x: barX, y, w: barW });
    return [minus, plus];
  }

  private toggle(key: 'shake' | 'highContrast', label: string, x: number, y: number): Button {
    uiText(this, x, y, label, 'body', { size: 22, weight: 800 }).setOrigin(0, 0.5);
    const button = new Button(this, x + PANEL.w - 80 - 70, y, {
      width: 140,
      height: 52,
      label: '',
      variant: 'secondary',
      fontSize: 22,
      onClick: () => {
        saves.updateSettings({ [key]: !saves.data.settings[key] } as Partial<Settings>);
        this.refresh();
      },
    }).setName(key);
    this.toggles.push({ key, button });
    return button;
  }

  private nudge(key: Slider['key'], delta: number): void {
    this.set(key, saves.data.settings[key] + delta);
  }

  private set(key: Slider['key'], value: number): void {
    const v = Math.round(Phaser.Math.Clamp(value, 0, 1) * 20) / 20;
    if (v === saves.data.settings[key]) return;
    saves.updateSettings({ [key]: v });
    if (key === 'music') audio.applyVolumes();
    else audio.play(SoundKeys.Coin);
    this.refresh();
  }

  private refresh(): void {
    const s = saves.data.settings;
    for (const sl of this.sliders) {
      sl.bar.clear();
      drawBar(sl.bar, sl.x, sl.y - 9, sl.w, 18, s[sl.key], COLORS.glacier);
      sl.value.setText(`${Math.round(s[sl.key] * 100)}%`);
    }
    for (const t of this.toggles) {
      const on = s[t.key];
      t.button.setLabel(on ? 'On' : 'Off').setVariant(on ? 'secondary' : 'quiet');
    }
    sharpenTexts(this);
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    this.scene.resume(this.from);
    this.scene.stop();
  }
}
