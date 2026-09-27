// Chunky pressable button: a flat face on a darker edge; pressing sinks the face onto the
// edge. Variants: primary (buoy orange, the one main action per screen), gold (spending
// coins), secondary (foam) and quiet (ink); any of them can be round (icon buttons).
// A Zone handles input so hit areas are exact. FocusNav drives the keyboard focus ring.
import Phaser from 'phaser';
import { SoundKeys } from '../audio/sounds';
import { audio } from '../services/AudioManager';
import { BUTTON_DEPTH, COLORS, CSS, uiText } from './theme';

export type ButtonVariant = 'primary' | 'gold' | 'secondary' | 'quiet';

interface VariantStyle {
  face: number;
  edge: number;
  text: string;
  /** Label shadow (primary only: lifts foam text off the orange). */
  shadow?: string;
  /** Hairline alpha around the face. */
  line: number;
}

const VARIANTS: Record<ButtonVariant, VariantStyle> = {
  primary: {
    face: COLORS.buoy,
    edge: COLORS.buoyEdge,
    text: CSS.foam,
    shadow: CSS.buoyEdge,
    line: 0,
  },
  gold: { face: COLORS.gold, edge: COLORS.goldEdge, text: CSS.ink, line: 0 },
  secondary: { face: COLORS.foam, edge: 0x7fa7bd, text: CSS.ink, line: 0 },
  quiet: { face: COLORS.inkRaised, edge: COLORS.trench, text: CSS.foam, line: 0.2 },
};
const DISABLED: VariantStyle = { face: 0x1d3c5a, edge: COLORS.trench, text: CSS.mist, line: 0.1 };

/** Emitted on the button when the pointer moves over it (FocusNav follows the mouse). */
export const BUTTON_HOVER = 'button-hover';

export interface ButtonOptions {
  width: number;
  height: number;
  label?: string;
  /** Texture key of an icon shown left of the label, or alone. */
  icon?: string;
  /** Tint for the white UI icons (default: the label color); null keeps the texture's colors. */
  iconTint?: number | null;
  iconSize?: number;
  /** Small second line under the label. */
  caption?: string;
  variant?: ButtonVariant;
  /** Circle of diameter `width` (icon buttons). */
  round?: boolean;
  fontSize?: number;
  onClick: () => void;
}

export class Button extends Phaser.GameObjects.Container {
  private readonly opts: ButtonOptions;
  private readonly edge: Phaser.GameObjects.Graphics;
  private readonly face: Phaser.GameObjects.Container;
  private readonly faceGfx: Phaser.GameObjects.Graphics;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly badge: Phaser.GameObjects.Graphics;
  private readonly zone: Phaser.GameObjects.Zone;
  private label: Phaser.GameObjects.Text | null = null;
  private caption: Phaser.GameObjects.Text | null = null;
  private icon: Phaser.GameObjects.Image | null = null;
  private enabled = true;
  private hovered = false;
  /** Pointer went down on this button (a release elsewhere, or a held finger, doesn't click). */
  private armed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, options: ButtonOptions) {
    super(scene, x, y);
    this.opts = { variant: 'secondary', ...options };
    const { width: w, height: h } = this.opts;

    this.edge = scene.add.graphics();
    this.faceGfx = scene.add.graphics();
    this.ring = scene.add.graphics().setVisible(false);
    this.badge = scene.add.graphics().setVisible(false);
    this.face = scene.add.container(0, 0, [this.faceGfx]);
    this.zone = scene.add
      .zone(0, BUTTON_DEPTH / 2, w + 8, h + BUTTON_DEPTH + 8)
      .setInteractive({ useHandCursor: true });
    this.add([this.ring, this.edge, this.face, this.zone]);
    this.setSize(w, h + BUTTON_DEPTH);

    if (this.opts.icon) this.setIcon(this.opts.icon);
    if (this.opts.label) this.setLabel(this.opts.label);
    if (this.opts.caption) this.setCaption(this.opts.caption);
    this.face.add(this.badge);
    this.redraw();

    const E = Phaser.Input.Events;
    this.zone.on(E.GAMEOBJECT_POINTER_OVER, () => {
      this.hovered = true;
      this.emit(BUTTON_HOVER, this);
      this.settle();
    });
    this.zone.on(E.GAMEOBJECT_POINTER_OUT, () => {
      this.hovered = false;
      this.armed = false;
      this.settle();
    });
    this.zone.on(E.GAMEOBJECT_POINTER_DOWN, () => {
      if (!this.enabled) return;
      this.armed = true;
      this.face.y = BUTTON_DEPTH - 1;
    });
    this.zone.on(E.GAMEOBJECT_POINTER_UP, () => {
      const click = this.armed && this.enabled;
      this.armed = false;
      this.settle();
      if (click) this.fire();
    });

    scene.add.existing(this);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  setLabel(text: string): this {
    if (!this.label) {
      // Created with shadow padding; layoutContent() turns the shadow on for primary only.
      this.label = uiText(this.scene, 0, 0, text, 'button', {
        size: this.opts.fontSize ?? 30,
        shadow: 2,
      }).setOrigin(0, 0.5);
      this.face.add(this.label);
    } else {
      this.label.setText(text);
    }
    this.redraw();
    return this;
  }

  setCaption(text: string | null): this {
    if (text === null) {
      this.caption?.destroy();
      this.caption = null;
    } else if (!this.caption) {
      this.caption = uiText(this.scene, 0, 0, text, 'caption', { size: 14, weight: 700 }).setOrigin(
        0.5,
      );
      this.face.add(this.caption);
    } else {
      this.caption.setText(text);
    }
    this.redraw();
    return this;
  }

  setIcon(key: string): this {
    const size = this.opts.iconSize ?? Math.round(this.opts.height * 0.5);
    if (!this.icon) {
      this.icon = this.scene.add.image(0, 0, key);
      this.face.add(this.icon);
    } else {
      this.icon.setTexture(key);
    }
    const frame = this.icon.frame;
    this.icon.setScale(size / Math.max(frame.width, frame.height));
    this.redraw();
    return this;
  }

  setVariant(variant: ButtonVariant): this {
    this.opts.variant = variant;
    this.redraw();
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    if (this.zone.input) this.zone.input.cursor = enabled ? 'pointer' : 'default';
    if (!enabled) this.armed = false;
    this.settle();
    this.redraw();
    return this;
  }

  /** Small gold dot at the top-right corner ("something new here"). */
  setBadge(on: boolean): this {
    const { width: w, height: h } = this.opts;
    const bx = this.opts.round ? w * 0.35 : w / 2 - 8;
    const by = this.opts.round ? -h * 0.35 : -h / 2 + 6;
    this.badge.clear().setVisible(on);
    this.badge.fillStyle(COLORS.ink, 1).fillCircle(bx, by, 11);
    this.badge.fillStyle(COLORS.gold, 1).fillCircle(bx, by, 8);
    return this;
  }

  /** Keyboard focus. The ring is only drawn when `showRing` (keyboard in use). */
  setFocused(focused: boolean, showRing: boolean): this {
    this.ring.setVisible(focused && showRing);
    return this;
  }

  /** Activates as if clicked (keyboard, shortcuts), with a quick press animation. */
  press(): void {
    if (!this.enabled) return;
    this.scene.tweens.killTweensOf(this.face);
    this.face.y = BUTTON_DEPTH - 1;
    this.scene.tweens.add({ targets: this.face, y: this.restY(), duration: 120, ease: 'Quad.Out' });
    this.fire();
  }

  private fire(): void {
    audio.play(SoundKeys.Click);
    this.opts.onClick();
  }

  private restY(): number {
    return this.hovered && this.enabled ? -2 : 0;
  }

  private settle(): void {
    this.face.y = this.restY();
  }

  private style(): VariantStyle {
    return this.enabled ? VARIANTS[this.opts.variant ?? 'secondary'] : DISABLED;
  }

  private redraw(): void {
    const { width: w, height: h, round } = this.opts;
    const st = this.style();
    const r = round ? h / 2 : Math.min(18, h / 2);

    this.edge.clear().fillStyle(st.edge, 1);
    this.faceGfx.clear().fillStyle(st.face, 1);
    this.ring.clear().lineStyle(4, COLORS.glacier, 1);
    if (round) {
      this.edge.fillCircle(0, BUTTON_DEPTH, w / 2);
      this.faceGfx.fillCircle(0, 0, w / 2);
      if (st.line > 0) this.faceGfx.lineStyle(2, COLORS.foam, st.line).strokeCircle(0, 0, w / 2);
      this.ring.strokeCircle(0, BUTTON_DEPTH / 2, w / 2 + 8);
    } else {
      this.edge.fillRoundedRect(-w / 2, -h / 2 + BUTTON_DEPTH, w, h, r);
      this.faceGfx.fillRoundedRect(-w / 2, -h / 2, w, h, r);
      if (st.line > 0) {
        this.faceGfx.lineStyle(2, COLORS.foam, st.line).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
      }
      this.ring.strokeRoundedRect(-w / 2 - 7, -h / 2 - 7, w + 14, h + BUTTON_DEPTH + 14, r + 7);
    }
    this.layoutContent(st);
  }

  /** Centers icon + label as a group, with the caption underneath. */
  private layoutContent(st: VariantStyle): void {
    const h = this.opts.height;
    const labelY = this.caption ? -h * 0.13 : 0;
    const gap = 10;
    const iconW = this.icon ? this.icon.displayWidth : 0;
    const labelW = this.label ? this.label.width : 0;
    const total = iconW + labelW + (this.icon && this.label ? gap : 0);
    let x = -total / 2;
    if (this.icon) {
      this.icon.setPosition(x + iconW / 2, labelY);
      if (this.opts.iconTint === null) this.icon.clearTint();
      else this.icon.setTint(this.iconColor(st));
      this.icon.setAlpha(this.enabled ? 1 : 0.7);
      x += iconW + gap;
    }
    if (this.label) {
      // Rounded display faces sit a touch high in their line box.
      this.label.setPosition(x, labelY + 1).setColor(st.text);
      if (st.shadow && this.enabled) this.label.setShadow(0, 2, st.shadow, 0, false, true);
      else this.label.setShadow(0, 0, CSS.ink, 0, false, false);
    }
    if (this.caption) {
      this.caption.setPosition(0, h * 0.26).setColor(this.enabled ? st.text : CSS.mist);
      this.caption.setAlpha(this.enabled ? 0.8 : 1);
    }
  }

  private iconColor(st: VariantStyle): number {
    if (this.enabled && this.opts.iconTint !== undefined && this.opts.iconTint !== null) {
      return this.opts.iconTint;
    }
    return Phaser.Display.Color.HexStringToColor(st.text).color;
  }
}
