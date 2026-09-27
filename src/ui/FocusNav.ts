// Keyboard navigation across a screen's buttons. Arrow keys move focus to the nearest button
// in that direction, Tab / Shift+Tab cycle in order, Enter / Space press. Like CSS
// :focus-visible, the ring only shows once the keyboard is used; hovering with the mouse
// moves focus silently so the two never fight.
import Phaser from 'phaser';
import { BUTTON_HOVER, type Button } from './Button';

const DIRECTIONS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

export class FocusNav {
  private readonly items: Button[] = [];
  private current: Button | null = null;
  private ringVisible = false;
  private enabled = true;

  constructor(private readonly scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) return;
    const Codes = Phaser.Input.Keyboard.KeyCodes;
    kb.addCapture([Codes.TAB, Codes.UP, Codes.DOWN, Codes.LEFT, Codes.RIGHT, Codes.SPACE]);
    kb.on('keydown', this.onKey, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown', this.onKey, this));
  }

  /** Registers buttons in Tab order. The first enabled one gets focus if nothing has it. */
  add(...buttons: Button[]): this {
    for (const b of buttons) {
      this.items.push(b);
      b.on(BUTTON_HOVER, () => this.focus(b, false));
    }
    if (!this.current || !this.current.isEnabled) this.focus(this.firstEnabled(), false);
    return this;
  }

  /** Moves focus; the ring shows only if the keyboard has been used. */
  focus(button: Button | null, keyboard = this.ringVisible): void {
    this.ringVisible = keyboard;
    this.current?.setFocused(false, false);
    this.current = button;
    button?.setFocused(true, this.ringVisible);
  }

  /** While disabled (e.g. results screen input delay) keys are ignored. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.enabled || !this.scene.sys.isActive()) return;
    const dir = DIRECTIONS[event.key];
    if (dir) {
      this.move(dir[0], dir[1]);
    } else if (event.key === 'Tab') {
      this.cycle(event.shiftKey ? -1 : 1);
    } else if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
      if (this.current?.isEnabled && this.current.visible) this.current.press();
    }
  }

  private usable(): Button[] {
    return this.items.filter((b) => b.isEnabled && b.visible && b.active);
  }

  private firstEnabled(): Button | null {
    return this.usable()[0] ?? null;
  }

  private cycle(step: number): void {
    const list = this.usable();
    if (list.length === 0) return;
    const i = this.current ? list.indexOf(this.current) : -1;
    this.focus(list[(i + step + list.length) % list.length] ?? null, true);
  }

  /** Picks the closest button in the pressed direction, favouring ones straight ahead. */
  private move(dx: number, dy: number): void {
    if (!this.current || !this.ringVisible) {
      // First key press just reveals where focus is.
      this.focus(this.current ?? this.firstEnabled(), true);
      return;
    }
    const from = center(this.current);
    let best: Button | null = null;
    let bestScore = Infinity;
    for (const b of this.usable()) {
      if (b === this.current) continue;
      const c = center(b);
      const vx = c.x - from.x;
      const vy = c.y - from.y;
      const along = vx * dx + vy * dy;
      if (along <= 4) continue;
      const across = Math.abs(vx * dy - vy * dx);
      const score = along + across * 2.5;
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    if (best) this.focus(best, true);
  }
}

function center(b: Button): { x: number; y: number } {
  const m = b.getWorldTransformMatrix();
  return { x: m.tx, y: m.ty };
}
