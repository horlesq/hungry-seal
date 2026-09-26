// The run: the seal swims an endless ocean, eats prey to keep its hunger up, grows through
// stages, and starves when hunger hits zero. HUD state goes out over the EventBus.
import Phaser from 'phaser';
import { CAMERA, FEEDING, GROWTH, HUNGER, SEAL_MOTION } from '../config/balance';
import { RegistryKeys, SceneKeys } from '../config/keys';
import { WORLD, depthMeters, zoneAt } from '../config/zones';
import type { Creature } from '../entities/Creature';
import { startle } from '../entities/creatureAI';
import { Seal } from '../entities/Seal';
import type { SealMotionEvent } from '../entities/sealMotion';
import { EventBus, type RunResult } from '../services/EventBus';
import { Effects } from '../systems/Effects';
import { canEat, circlesOverlap } from '../systems/feeding';
import { GrowthSystem } from '../systems/GrowthSystem';
import { HungerSystem } from '../systems/HungerSystem';
import { InputController } from '../systems/InputController';
import { Spawner, type Threat } from '../systems/Spawner';
import { WorldBackground } from '../systems/WorldBackground';
import { clamp, damp } from '../utils/math';

const DEBUG_INFO_INTERVAL = 0.2;
const GAME_OVER_DELAY = 1600;
const TOO_BIG_TEXT_COOLDOWN = 1500;

export class GameScene extends Phaser.Scene {
  private seal!: Seal;
  private controls!: InputController;
  private background!: WorldBackground;
  private effects!: Effects;
  private spawner!: Spawner;
  private hunger!: HungerSystem;
  private growth!: GrowthSystem;
  private debugGfx!: Phaser.GameObjects.Graphics;

  private score = 0;
  private eaten = 0;
  private elapsed = 0;
  private dead = false;
  private hudDirty = true;
  private debugTimer = 0;
  private lastStamina = -1;
  private lastTooBigAt = -Infinity;

  private readonly lookAhead = new Phaser.Math.Vector2();
  private readonly tail = new Phaser.Math.Vector2();
  private readonly mouth = new Phaser.Math.Vector2();
  private readonly threat: Threat = { x: 0, y: 0, vx: 0, vy: 0, stage: 1 };

  constructor() {
    super({ key: SceneKeys.Game });
  }

  create(): void {
    this.score = 0;
    this.eaten = 0;
    this.elapsed = 0;
    this.dead = false;
    this.hudDirty = true;
    this.debugTimer = 0;
    this.lastStamina = -1;
    this.lastTooBigAt = -Infinity;
    this.lookAhead.set(0, 0);

    this.hunger = new HungerSystem(HUNGER);
    this.growth = new GrowthSystem(GROWTH.stageCosts);

    this.background = new WorldBackground(this);
    this.effects = new Effects(this);
    this.spawner = new Spawner(this);
    this.seal = new Seal(this, 0, WORLD.surfaceY + 260);
    this.controls = new InputController(this);
    this.debugGfx = this.add.graphics().setDepth(50);

    const cam = this.cameras.main;
    // Endless horizontally, bounded between the sky and the seabed.
    cam.setBounds(-1e7, WORLD.ceilingY, 2e7, WORLD.height - WORLD.ceilingY);
    cam.centerOn(this.seal.x, this.seal.y);
    cam.startFollow(this.seal, false, CAMERA.lerpX, CAMERA.lerpY);
    cam.fadeIn(400, 4, 20, 37);

    this.updateThreat();
    this.spawner.populate(this.seal.x, this.seal.y, this.threat);

    this.setupDebug();
    this.input.keyboard!.on('keydown-ESC', () => {
      if (!this.dead) this.scene.start(SceneKeys.Menu);
    });

    this.scene.launch(SceneKeys.Hud);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.stop(SceneKeys.Hud);
      this.scene.stop(SceneKeys.GameOver);
    });
  }

  override update(time: number, delta: number): void {
    // Clamp dt so a background-tab stall doesn't teleport anything.
    const dt = Math.min(delta, 50) / 1000;
    const cam = this.cameras.main;

    if (!this.dead) {
      this.elapsed += dt;
      this.controls.update(this.seal.x, this.seal.y);
      const events = this.seal.step(
        {
          steerX: this.controls.steer.x,
          steerY: this.controls.steer.y,
          boost: this.controls.boost,
        },
        dt,
      );
      for (const e of events) this.handleSealEvent(e);
      this.hunger.update(dt, this.elapsed, zoneAt(this.seal.y).id);
      this.updateCamera(dt);
      this.updateTrail(dt);
    }

    this.updateThreat();
    this.spawner.update(dt, cam, this.threat);

    if (!this.dead) {
      this.checkFeeding(time);
      if (this.hunger.isStarved) this.die();
    }

    this.effects.update(dt, cam);
    this.background.update(time, cam);
    this.publishHudState(dt);
    this.drawDebug();
  }

  private updateThreat(): void {
    const m = this.seal.motion;
    this.threat.x = m.x;
    this.threat.y = m.y;
    this.threat.vx = m.vx;
    this.threat.vy = m.vy;
    // A dead seal scares nobody.
    this.threat.stage = this.dead ? 0 : this.seal.stage;
  }

  private checkFeeding(time: number): void {
    const mouth = this.seal.mouthPosition(this.mouth);
    const r = this.seal.mouthRadius;
    for (const c of this.spawner.alive) {
      if (!c.active) continue; // eaten earlier this frame
      if (!circlesOverlap(mouth.x, mouth.y, r, c.x, c.y, c.radius)) continue;
      if (canEat(this.seal.stage, c.def.tier)) this.eat(c);
      else this.bumpInto(c, time);
    }
  }

  private eat(c: Creature): void {
    const def = c.def;
    this.hunger.feed(def.nutrition);
    this.score += def.score;
    this.eaten++;
    this.effects.chomp(c.x, c.y, def.tier >= 2);
    this.effects.floatText(c.x, c.y - 24, `+${def.score}`);
    this.seal.chomp();
    c.despawn();

    if (this.growth.add(def.growth) > 0) this.onGrow();
    this.hudDirty = true;
  }

  private onGrow(): void {
    this.seal.setStage(this.growth.stage);
    this.effects.growBurst(this.seal.x, this.seal.y);
    const label = this.growth.isMaxStage ? 'MAX SIZE!' : 'BIGGER!';
    this.effects.floatText(this.seal.x, this.seal.y - 70, label, '#7dfcff', 38);
    this.cameras.main.shake(180, 0.005);
  }

  private bumpInto(c: Creature, time: number): void {
    if (c.bumpCooldown > 0) return;
    c.bumpCooldown = FEEDING.bumpCooldown;
    this.seal.bump();
    startle(c.motion, Math.random);
    this.cameras.main.shake(90, 0.003);
    if (time - this.lastTooBigAt > TOO_BIG_TEXT_COOLDOWN) {
      this.lastTooBigAt = time;
      this.effects.floatText(c.x, c.y - 30, 'Too big!', '#d8e3ea', 22);
    }
  }

  private die(): void {
    this.dead = true;
    this.seal.die();
    this.cameras.main.shake(250, 0.006);
    const result: RunResult = {
      score: this.score,
      seconds: this.elapsed,
      eaten: this.eaten,
      stage: this.growth.stage,
      cause: 'starved',
    };
    EventBus.emit('run:over', result);
    this.time.delayedCall(GAME_OVER_DELAY, () => this.scene.launch(SceneKeys.GameOver, result));
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
    EventBus.emit('run:hunger', {
      value: this.hunger.value,
      max: this.hunger.max,
      low: this.hunger.isLow,
    });
    if (this.hudDirty) {
      this.hudDirty = false;
      EventBus.emit('run:score', this.score);
      EventBus.emit('run:growth', {
        stage: this.growth.stage,
        maxStage: this.growth.maxStage,
        progress: this.growth.progress,
      });
    }
    if (Math.abs(m.stamina - this.lastStamina) > 0.001 || m.boosting) {
      this.lastStamina = m.stamina;
      EventBus.emit('seal:boost', { active: m.boosting, stamina: m.stamina });
    }

    this.debugTimer -= dt;
    if (this.debugTimer > 0 || !this.registry.get(RegistryKeys.Debug)) return;
    this.debugTimer = DEBUG_INFO_INTERVAL;
    const zone = zoneAt(m.y);
    EventBus.emit('debug:info', {
      fps: this.game.loop.actualFps,
      x: m.x,
      y: m.y,
      depthM: depthMeters(m.y),
      zone: zone.name,
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
      creatures: this.spawner.countActive(),
      stage: this.growth.stage,
      hunger: this.hunger.value,
      drain: this.hunger.drainRate(this.elapsed, zone.id),
    });
  }

  /** Hit circles: yellow = mouth, green = edible, red = too big. */
  private drawDebug(): void {
    const g = this.debugGfx;
    g.clear();
    if (!this.registry.get(RegistryKeys.Debug) || this.dead) return;
    const mouth = this.seal.mouthPosition(this.mouth);
    g.lineStyle(2, 0xffe066, 1).strokeCircle(mouth.x, mouth.y, this.seal.mouthRadius);
    for (const c of this.spawner.alive) {
      if (!c.active) continue;
      const color = canEat(this.seal.stage, c.def.tier) ? 0x5ee07a : 0xff5a4f;
      g.lineStyle(1.5, color, 0.9).strokeCircle(c.x, c.y, c.radius);
    }
  }

  private setupDebug(): void {
    this.input.keyboard!.on('keydown-BACKTICK', () => {
      const on = !this.registry.get(RegistryKeys.Debug);
      this.registry.set(RegistryKeys.Debug, on);
      EventBus.emit('debug:toggle', on);
    });
  }
}
