// Chunky rounded button (menu, shop). A Zone handles input so hit areas are exact; the
// visual is a Graphics + Text inside a Container. Hover grows, press squashes, disabled greys.
import Phaser from 'phaser';
import { SoundKeys } from '../audio/sounds';
import { UI_FONT } from '../config/layout';
import { audio } from '../services/AudioManager';

export interface ButtonOptions {
  width: number;
  height: number;
  label: string;
  onClick: () => void;
  color?: number;
  textColor?: string;
  fontSize?: number;
}

export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private readonly zone: Phaser.GameObjects.Zone;
  private enabled = true;
  private readonly opts: Required<ButtonOptions>;

  constructor(scene: Phaser.Scene, x: number, y: number, options: ButtonOptions) {
    super(scene, x, y);
    this.opts = {
      color: 0x2bb3e6,
      textColor: '#ffffff',
      fontSize: 30,
      ...options,
    };
    const { width, height } = this.opts;

    this.bg = scene.add.graphics();
    this.text = scene.add
      .text(0, 0, this.opts.label, {
        fontFamily: UI_FONT,
        fontSize: `${this.opts.fontSize}px`,
        fontStyle: 'bold',
        color: this.opts.textColor,
        stroke: '#0b3a66',
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.zone = scene.add.zone(0, 0, width, height).setInteractive({ useHandCursor: true });
    this.add([this.bg, this.text, this.zone]);
    this.setSize(width, height);
    this.draw(false);

    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      if (this.enabled) this.setScale(1.05);
    });
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.setScale(1));
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      if (this.enabled) this.setScale(0.95);
    });
    this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (!this.enabled) return;
      this.setScale(1.05);
      audio.play(SoundKeys.Click);
      this.opts.onClick();
    });

    scene.add.existing(this);
  }

  setLabel(label: string): this {
    this.text.setText(label);
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.draw(!enabled);
    this.text.setAlpha(enabled ? 1 : 0.6);
    if (!enabled) this.setScale(1);
    return this;
  }

  /** Triggers the click as if pressed (keyboard shortcuts). */
  press(): void {
    if (!this.enabled) return;
    audio.play(SoundKeys.Click);
    this.opts.onClick();
  }

  private draw(disabled: boolean): void {
    const { width: w, height: h } = this.opts;
    const color = disabled ? 0x5d6b78 : this.opts.color;
    const r = Math.min(22, h / 2);
    const g = this.bg;
    g.clear();
    g.fillStyle(0x0b3a66, 1).fillRoundedRect(-w / 2, -h / 2 + 5, w, h, r);
    g.fillStyle(color, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
    g.fillStyle(0xffffff, 0.22).fillRoundedRect(-w / 2 + 8, -h / 2 + 5, w - 16, h * 0.32, r * 0.6);
    g.lineStyle(4, 0xffffff, 0.9).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  }
}
