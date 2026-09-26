// The run. Phase 1: the seal swims in an endless ocean with camera look-ahead, surface
// leaps, splashes and parallax. Later phases add creatures, hunger and scoring.
import Phaser from 'phaser';
import { CAMERA, SEAL_MOTION } from '../config/balance';
import { RegistryKeys, SceneKeys } from '../config/keys';
import { WORLD, depthMeters, zoneAt } from '../config/zones';
import { Seal } from '../entities/Seal';
import type { SealMotionEvent } from '../entities/sealMotion';
import { EventBus } from '../services/EventBus';
import { Effects } from '../systems/Effects';
import { InputController } from '../systems/InputController';
import { WorldBackground } from '../systems/WorldBackground';
import { clamp, damp } from '../utils/math';

const DEBUG_INFO_INTERVAL = 0.2;

export class GameScene extends Phaser.Scene {
  private seal!: Seal;
  private controls!: InputController;
  private background!: WorldBackground;
  private effects!: Effects;
  private lookAhead = new Phaser.Math.Vector2();
  private readonly tail = new Phaser.Math.Vector2();
  private debugTimer = 0;
  private lastStamina = -1;

  constructor() {
    super({ key: SceneKeys.Game });
  }

  create(): void {
    this.lookAhead.set(0, 0);
    this.lastStamina = -1;

    this.background = new WorldBackground(this);
    this.effects = new Effects(this);
    this.seal = new Seal(this, 0, WORLD.surfaceY + 260);
    this.controls = new InputController(this);

    const cam = this.cameras.main;
    // Endless horizontally, bounded between the sky and the seabed.
    cam.setBounds(-1e7, WORLD.ceilingY, 2e7, WORLD.height - WORLD.ceilingY);
    cam.startFollow(this.seal, false, CAMERA.lerpX, CAMERA.lerpY);
    cam.fadeIn(400, 4, 20, 37);

    this.setupDebug();
    this.input.keyboard!.on('keydown-ESC', () => this.scene.start(SceneKeys.Menu));

    this.scene.launch(SceneKeys.Hud);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scene.stop(SceneKeys.Hud));
  }

  override update(time: number, delta: number): void {
    // Clamp dt so a background-tab stall doesn't teleport the seal.
    const dt = Math.min(delta, 50) / 1000;

    this.controls.update(this.seal.x, this.seal.y);
    const events = this.seal.step(
      { steerX: this.controls.steer.x, steerY: this.controls.steer.y, boost: this.controls.boost },
      dt,
    );
    for (const e of events) this.handleSealEvent(e);

    this.updateCamera(dt);
    this.updateTrail(dt);
    this.effects.update(dt, this.cameras.main);
    this.background.update(time, this.cameras.main);
    this.publishHudState(dt);
  }

  private handleSealEvent(e: SealMotionEvent): void {
    switch (e.type) {
      case 'breach':
      case 'splashdown':
        this.effects.splash(e.x, e.vy);
        if (e.type === 'splashdown' && e.vy > 650) this.cameras.main.shake(120, 0.004);
        break;
      case 'boostStart':
        this.cameras.main.shake(90, 0.002);
        break;
      case 'boostEnd':
        break;
    }
  }

  /** Leads the camera in the direction of travel so you can see what's coming. */
  private updateCamera(dt: number): void {
    const m = this.seal.motion;
    const tx = clamp(m.vx * CAMERA.lookAheadTime, -CAMERA.lookAheadMaxX, CAMERA.lookAheadMaxX);
    const ty = clamp(m.vy * CAMERA.lookAheadTime, -CAMERA.lookAheadMaxY, CAMERA.lookAheadMaxY);
    this.lookAhead.x = damp(this.lookAhead.x, tx, CAMERA.lookAheadRate, dt);
    this.lookAhead.y = damp(this.lookAhead.y, ty, CAMERA.lookAheadRate, dt);
    // Follow offset is subtracted from the target position.
    this.cameras.main.setFollowOffset(-this.lookAhead.x, -this.lookAhead.y);
  }

  private updateTrail(dt: number): void {
    const m = this.seal.motion;
    if (!m.inWater) return;
    const rate = m.boosting ? 1 : Math.max(0, (m.speed / SEAL_MOTION.maxSpeed - 0.6) * 1.5);
    this.seal.tailPosition(this.tail);
    this.effects.trail(this.tail.x, this.tail.y, rate, dt);
  }

  private publishHudState(dt: number): void {
    const m = this.seal.motion;
    if (Math.abs(m.stamina - this.lastStamina) > 0.001 || m.boosting) {
      this.lastStamina = m.stamina;
      EventBus.emit('seal:boost', { active: m.boosting, stamina: m.stamina });
    }

    this.debugTimer -= dt;
    if (this.debugTimer > 0 || !this.registry.get(RegistryKeys.Debug)) return;
    this.debugTimer = DEBUG_INFO_INTERVAL;
    EventBus.emit('debug:info', {
      fps: this.game.loop.actualFps,
      x: m.x,
      y: m.y,
      depthM: depthMeters(m.y),
      zone: zoneAt(m.y).name,
      speed: m.speed,
      headingDeg: Phaser.Math.RadToDeg(m.heading),
      inWater: m.inWater,
      stamina: m.stamina,
      boosting: m.boosting,
      input: this.controls.source,
      steerX: this.controls.steer.x,
      steerY: this.controls.steer.y,
      particles: this.effects.particleCount,
      objects: this.children.length,
    });
  }

  private setupDebug(): void {
    const apply = (on: boolean) => {
      this.physics.world.drawDebug = on;
      if (on && !this.physics.world.debugGraphic) this.physics.world.createDebugGraphic();
      this.physics.world.debugGraphic?.setVisible(on).clear();
    };
    apply(!!this.registry.get(RegistryKeys.Debug));

    this.input.keyboard!.on('keydown-BACKTICK', () => {
      const on = !this.registry.get(RegistryKeys.Debug);
      this.registry.set(RegistryKeys.Debug, on);
      apply(on);
      EventBus.emit('debug:toggle', on);
    });
  }
}
