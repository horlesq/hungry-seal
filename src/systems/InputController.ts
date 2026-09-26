// Unifies keyboard, mouse and touch into one steering vector + boost flag.
// Game code reads `steer` (length 0..1) and `boost`; it never touches raw input.
//
// - Keyboard: WASD / arrows steer, Space / Shift boost.
// - Mouse: the seal swims toward the cursor (no click needed); hold left button to boost.
// - Touch: hold/drag anywhere to swim toward the finger; a touch that starts on the boost
//   button (bottom-right) boosts instead.
// The most recently used device wins, so a resting mouse doesn't fight the keyboard.
import Phaser from 'phaser';
import { INPUT } from '../config/balance';
import { TOUCH_UI } from '../config/layout';
import { EventBus, type InputSource } from '../services/EventBus';

type KeyName = 'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'space' | 'shift';

export class InputController {
  readonly steer = new Phaser.Math.Vector2();
  boost = false;
  source: InputSource;

  private readonly keys: Record<KeyName, Phaser.Input.Keyboard.Key>;
  private readonly worldPoint = new Phaser.Math.Vector2();
  private mouseInside = false;

  constructor(private readonly scene: Phaser.Scene) {
    const Codes = Phaser.Input.Keyboard.KeyCodes;
    const keyboard = scene.input.keyboard!;
    this.keys = keyboard.addKeys({
      up: Codes.UP,
      down: Codes.DOWN,
      left: Codes.LEFT,
      right: Codes.RIGHT,
      w: Codes.W,
      a: Codes.A,
      s: Codes.S,
      d: Codes.D,
      space: Codes.SPACE,
      shift: Codes.SHIFT,
    }) as Record<KeyName, Phaser.Input.Keyboard.Key>;

    this.source = scene.sys.game.device.input.touch ? 'touch' : 'keyboard';

    keyboard.on('keydown', this.onKeyDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerActivity, this);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerActivity, this);
    scene.input.on(Phaser.Input.Events.GAME_OUT, this.onGameOut, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /** Recomputes `steer` and `boost` relative to the seal's world position. */
  update(originX: number, originY: number): void {
    this.steer.set(0, 0);
    this.boost = false;

    // Touch: most recent non-boost touch steers; touches that began on the button boost.
    let steerPointer: Phaser.Input.Pointer | null = null;
    let touchBoost = false;
    for (const p of this.scene.input.manager.pointers) {
      if (!p.isDown || !p.wasTouch) continue;
      if (this.isOnBoostButton(p.downX, p.downY)) touchBoost = true;
      else if (!steerPointer || p.downTime > steerPointer.downTime) steerPointer = p;
    }

    const k = this.keys;
    const kx = +(k.right.isDown || k.d.isDown) - +(k.left.isDown || k.a.isDown);
    const ky = +(k.down.isDown || k.s.isDown) - +(k.up.isDown || k.w.isDown);
    const keyBoost = k.space.isDown || k.shift.isDown;

    if (steerPointer) {
      this.steerToward(steerPointer, originX, originY);
    } else if (kx !== 0 || ky !== 0) {
      this.steer.set(kx, ky).normalize();
    } else if (this.source === 'mouse' && this.mouseInside) {
      this.steerToward(this.scene.input.mousePointer!, originX, originY);
    }

    const mouse = this.scene.input.mousePointer;
    const mouseBoost = this.source === 'mouse' && !!mouse?.isDown && mouse.leftButtonDown();
    this.boost = touchBoost || keyBoost || mouseBoost;
  }

  isOnBoostButton(x: number, y: number): boolean {
    const b = TOUCH_UI.boostButton;
    return Math.hypot(x - b.x, y - b.y) <= b.hitRadius;
  }

  private steerToward(pointer: Phaser.Input.Pointer, originX: number, originY: number): void {
    // Recompute the world point every frame: the camera moves even when the pointer doesn't.
    this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y, this.worldPoint);
    const dx = this.worldPoint.x - originX;
    const dy = this.worldPoint.y - originY;
    const dist = Math.hypot(dx, dy);
    if (dist < INPUT.pointerDeadzone) return;
    const mag = Math.min(1, dist / INPUT.pointerFullSpeedDist);
    this.steer.set((dx / dist) * mag, (dy / dist) * mag);
  }

  private onKeyDown(): void {
    this.setSource('keyboard');
  }

  private onPointerActivity(pointer: Phaser.Input.Pointer): void {
    if (pointer.wasTouch) {
      this.setSource('touch');
    } else {
      this.mouseInside = true;
      this.setSource('mouse');
    }
  }

  private onGameOut(): void {
    this.mouseInside = false;
  }

  private setSource(source: InputSource): void {
    if (source === this.source) return;
    this.source = source;
    EventBus.emit('input:source', source);
  }

  private destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.onKeyDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerActivity, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerActivity, this);
    this.scene.input.off(Phaser.Input.Events.GAME_OUT, this.onGameOut, this);
  }
}
