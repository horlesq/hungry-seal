// The run: the seal swims an endless ocean, eats prey to keep its hunger up, grows through
// stages, dodges hazards and predators, collects coins, and dies when hunger hits zero.
// HUD state goes out over the EventBus; results are banked in the save on death.
import Phaser from 'phaser';
import {
  CAMERA,
  COINS,
  COMBO,
  DAMAGE,
  FEEDING,
  GROWTH,
  HITSTOP,
  HUNGER,
  SEAL_MOTION,
} from '../config/balance';
import { RegistryKeys, SceneKeys } from '../config/keys';
import { WORLD, depthMeters, zoneAt } from '../config/zones';
import type { Creature } from '../entities/Creature';
import { startle } from '../entities/creatureAI';
import type { Predator } from '../entities/Predator';
import { predatorBit } from '../entities/predatorAI';
import { Seal } from '../entities/Seal';
import type { SealMotionEvent } from '../entities/sealMotion';
import { EventBus, type DamageSource, type DeathCause, type RunResult } from '../services/EventBus';
import { saves } from '../services/SaveService';
import { CoinField } from '../systems/CoinField';
import { ComboSystem } from '../systems/ComboSystem';
import { Effects } from '../systems/Effects';
import { canEat, circlesOverlap } from '../systems/feeding';
import { GrowthSystem } from '../systems/GrowthSystem';
import { HazardField } from '../systems/HazardField';
import { HungerSystem } from '../systems/HungerSystem';
import { InputController } from '../systems/InputController';
import { Predators, type SealInfo } from '../systems/Predators';
import { Spawner } from '../systems/Spawner';
import { WorldBackground } from '../systems/WorldBackground';
import { clamp, damp } from '../utils/math';

const DEBUG_INFO_INTERVAL = 0.2;
const GAME_OVER_DELAY = 1600;
const TOO_BIG_TEXT_COOLDOWN = 1500;
/** Combos at least this long get a "N COMBO!" callout when they end. */
const COMBO_CALLOUT_MIN = 5;

export class GameScene extends Phaser.Scene {
  private seal!: Seal;
  private controls!: InputController;
  private background!: WorldBackground;
  private effects!: Effects;
  private spawner!: Spawner;
  private hazards!: HazardField;
  private predators!: Predators;
  private coins!: CoinField;
  private hunger!: HungerSystem;
  private growth!: GrowthSystem;
  private combo!: ComboSystem;
  private debugGfx!: Phaser.GameObjects.Graphics;

  private score = 0;
  private eaten = 0;
  private runCoins = 0;
  private elapsed = 0;
  private distance = 0;
  private maxDepth = 0;
  private dead = false;
  private hudDirty = true;
  private comboShown = 0;
  private debugTimer = 0;
  private lastStamina = -1;
  private lastTooBigAt = -Infinity;
  /** Seconds of frozen simulation left (hit-stop). */
  private hitStop = 0;
  private lastHit: { source: DamageSource; at: number } | null = null;

  private readonly lookAhead = new Phaser.Math.Vector2();
  private readonly tail = new Phaser.Math.Vector2();
  private readonly mouth = new Phaser.Math.Vector2();
  private readonly predatorMouth = new Phaser.Math.Vector2();
  private readonly threat: SealInfo = { x: 0, y: 0, vx: 0, vy: 0, stage: 1, inWater: true };

  constructor() {
    super({ key: SceneKeys.Game });
  }

  create(): void {
    this.score = 0;
    this.eaten = 0;
    this.runCoins = 0;
    this.elapsed = 0;
    this.distance = 0;
    this.maxDepth = 0;
    this.dead = false;
    this.hudDirty = true;
    this.comboShown = 0;
    this.debugTimer = 0;
    this.lastStamina = -1;
    this.lastTooBigAt = -Infinity;
    this.hitStop = 0;
    this.lastHit = null;
    this.lookAhead.set(0, 0);

    this.hunger = new HungerSystem(HUNGER);
    this.growth = new GrowthSystem(GROWTH.stageCosts);
    this.combo = new ComboSystem(COMBO.window, COMBO.thresholds);

    this.background = new WorldBackground(this);
    this.effects = new Effects(this);
    this.spawner = new Spawner(this);
    this.hazards = new HazardField(this);
    this.coins = new CoinField(this);
    this.seal = new Seal(this, 0, WORLD.surfaceY + 260);
    this.predators = new Predators(this);
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
    // Hit-stop: freeze the simulation for a few frames on big impacts.
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return;
    }
    const cam = this.cameras.main;

    if (!this.dead) {
      this.elapsed += dt;
      this.controls.update(this.seal.x, this.seal.y);
      const stunned = this.seal.isStunned;
      const events = this.seal.step(
        {
          steerX: stunned ? 0 : this.controls.steer.x,
          steerY: stunned ? 0 : this.controls.steer.y,
          boost: !stunned && this.controls.boost,
        },
        dt,
      );
      for (const e of events) this.handleSealEvent(e);
      this.hunger.update(dt, this.elapsed, zoneAt(this.seal.y).id);
      this.trackDistance(dt);
      const ended = this.combo.update(dt);
      if (ended >= COMBO_CALLOUT_MIN) {
        this.effects.floatText(this.seal.x, this.seal.y - 80, `${ended} COMBO!`, '#ffb3ff', 34);
      }
      this.updateCamera(dt);
      this.updateTrail(dt);
    }

    this.updateThreat();
    this.spawner.update(dt, cam, this.threat);
    // Danger ramps with run time; `?calm` keeps it at zero.
    const dangerTime = this.registry.get(RegistryKeys.Calm) ? 0 : this.elapsed;
    this.hazards.update(dt, cam, this.threat, dangerTime);
    this.predators.update(dt, time, cam, this.threat, dangerTime);
    const collected = this.coins.update(
      dt,
      cam,
      {
        x: this.seal.x,
        y: this.seal.y,
        vx: this.threat.vx,
        vy: this.threat.vy,
        radius: this.seal.radius,
      },
      !this.dead,
    );
    if (collected > 0) {
      this.runCoins += collected;
      this.effects.coinPickup(this.seal.x, this.seal.y);
      this.hudDirty = true;
    }

    if (!this.dead) {
      this.checkFeeding(time);
      this.checkHazards();
      this.checkPredatorBites();
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
    this.threat.inWater = m.inWater;
    // A dead seal scares nobody and can't be hunted.
    this.threat.stage = this.dead ? 0 : this.seal.stage;
  }

  private trackDistance(dt: number): void {
    const m = this.seal.motion;
    this.distance += (Math.hypot(m.vx + m.kx, m.vy + m.ky) * dt) / WORLD.pxPerMeter;
    this.maxDepth = Math.max(this.maxDepth, depthMeters(m.y));
  }

  // ---------------------------------------------------------------------------------------
  // Eating
  // ---------------------------------------------------------------------------------------

  private checkFeeding(time: number): void {
    const mouth = this.seal.mouthPosition(this.mouth);
    const r = this.seal.mouthRadius;
    for (const c of this.spawner.alive) {
      if (!c.active) continue; // eaten earlier this frame
      if (!circlesOverlap(mouth.x, mouth.y, r, c.x, c.y, c.radius)) continue;
      if (canEat(this.seal.stage, c.def.tier)) this.eat(c);
      else this.bumpInto(c, time);
    }
    for (const p of this.predators.alive) {
      if (!p.active || !canEat(this.seal.stage, p.def.tier)) continue;
      if (circlesOverlap(mouth.x, mouth.y, r, p.x, p.y, p.radius)) this.eatPredator(p);
    }
  }

  /** Shared rewards for any meal. Returns the points scored (after the combo multiplier). */
  private feed(
    x: number,
    y: number,
    reward: { nutrition: number; score: number; growth: number },
  ): number {
    const points = reward.score * this.combo.hit();
    this.hunger.feed(reward.nutrition);
    this.score += points;
    this.eaten++;
    this.seal.chomp();
    this.effects.floatText(x, y - 24, `+${points}`);
    if (this.growth.add(reward.growth) > 0) this.onGrow();
    this.hudDirty = true;
    return points;
  }

  private eat(c: Creature): void {
    const def = c.def;
    const big = def.tier >= 2;
    this.effects.chomp(c.x, c.y, big);
    if (big) this.hitStop = HITSTOP.eatBig;
    const chance = COINS.dropChanceByTier[Math.min(def.tier, COINS.dropChanceByTier.length - 1)];
    if (Math.random() < chance) this.coins.drop(c.x, c.y, 1);
    this.feed(c.x, c.y, def);
    c.despawn();
  }

  private eatPredator(p: Predator): void {
    const def = p.def;
    this.effects.chomp(p.x, p.y, true);
    this.effects.growBurst(p.x, p.y);
    this.coins.drop(p.x, p.y, def.coins);
    this.hitStop = HITSTOP.explode;
    this.cameras.main.shake(260, 0.01);
    this.feed(p.x, p.y, def);
    p.despawn();
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

  // ---------------------------------------------------------------------------------------
  // Danger
  // ---------------------------------------------------------------------------------------

  private checkHazards(): void {
    if (this.seal.isInvulnerable) return;
    const s = this.seal;
    for (const h of this.hazards.alive) {
      if (!h.active || !circlesOverlap(s.x, s.y, s.radius, h.x, h.y, h.radius)) continue;
      const def = h.def;
      this.hurt(def.id, h.x, h.y, def.damage, def.knockback, def.stun);
      if (def.explodes) {
        this.effects.explosion(h.x, h.y);
        this.cameras.main.shake(320, 0.014);
        this.hitStop = HITSTOP.explode;
        h.despawn();
      } else {
        this.effects.zap(s.x, s.y);
      }
      return;
    }
  }

  private checkPredatorBites(): void {
    if (this.seal.isInvulnerable) return;
    const s = this.seal;
    for (const p of this.predators.alive) {
      if (!p.active || canEat(s.stage, p.def.tier)) continue;
      const state = p.motion.state;
      if (state === 'recover' || state === 'flee') continue;
      const mouth = p.mouthPosition(this.predatorMouth);
      if (!circlesOverlap(mouth.x, mouth.y, p.def.mouthRadius, s.x, s.y, s.radius)) continue;
      predatorBit(p.motion, p.def);
      this.effects.bite(s.x, s.y);
      this.hurt(p.def.id, p.x, p.y, p.def.damage, p.def.knockback, 0.25);
      return;
    }
  }

  private hurt(
    source: DamageSource,
    fromX: number,
    fromY: number,
    damage: number,
    knockback: number,
    stun: number,
  ): void {
    this.hunger.damage(damage);
    this.seal.hurt(fromX, fromY, knockback, stun, DAMAGE.invulnTime);
    this.combo.reset();
    this.lastHit = { source, at: this.elapsed };
    this.hitStop = Math.max(this.hitStop, HITSTOP.hurt);
    this.cameras.main.shake(220, 0.01);
    this.effects.floatText(this.seal.x, this.seal.y - 40, `-${damage}`, '#ff6b5b', 30);
    this.hudDirty = true;
    EventBus.emit('seal:hurt', { source, damage });
  }

  private die(): void {
    this.dead = true;
    this.seal.die();
    this.cameras.main.shake(250, 0.006);
    const recent = this.lastHit && this.elapsed - this.lastHit.at <= DAMAGE.killWindow;
    const cause: DeathCause = recent && this.lastHit ? this.lastHit.source : 'starved';
    const distance = Math.round(this.distance);
    const { data, newBest } = saves.recordRun({
      score: this.score,
      coins: this.runCoins,
      distance,
    });
    const result: RunResult = {
      score: this.score,
      seconds: this.elapsed,
      eaten: this.eaten,
      stage: this.growth.stage,
      coins: this.runCoins,
      distance,
      maxDepth: Math.max(0, Math.round(this.maxDepth)),
      cause,
      newBest,
      bestScore: data.bestScore,
      totalCoins: data.coins,
    };
    EventBus.emit('run:over', result);
    this.time.delayedCall(GAME_OVER_DELAY, () => this.scene.launch(SceneKeys.GameOver, result));
  }

  // ---------------------------------------------------------------------------------------
  // Movement feel
  // ---------------------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------------------
  // HUD + debug
  // ---------------------------------------------------------------------------------------

  private publishHudState(dt: number): void {
    const m = this.seal.motion;
    EventBus.emit('run:hunger', {
      value: this.hunger.value,
      max: this.hunger.max,
      low: this.hunger.isLow,
    });
    if (this.combo.active || this.comboShown !== 0) {
      const count = this.combo.active ? this.combo.count : 0;
      EventBus.emit('run:combo', {
        count,
        multiplier: this.combo.multiplier,
        remaining: this.combo.remaining,
      });
      this.comboShown = count;
    }
    if (this.hudDirty) {
      this.hudDirty = false;
      EventBus.emit('run:score', this.score);
      EventBus.emit('run:coins', this.runCoins);
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
      hazards: this.hazards.alive.length,
      predators: this.predators.alive.map((p) => p.motion.state).join(',') || '-',
      coins: this.coins.countActive(),
      stage: this.growth.stage,
      hunger: this.hunger.value,
      drain: this.hunger.drainRate(this.elapsed, zone.id),
      elapsed: this.elapsed,
    });
  }

  /** Hit circles: yellow = mouth, green = edible, red = too big, orange = hazard. */
  private drawDebug(): void {
    const g = this.debugGfx;
    g.clear();
    if (!this.registry.get(RegistryKeys.Debug) || this.dead) return;
    const mouth = this.seal.mouthPosition(this.mouth);
    g.lineStyle(2, 0xffe066, 1).strokeCircle(mouth.x, mouth.y, this.seal.mouthRadius);
    g.lineStyle(1.5, 0xffffff, 0.6).strokeCircle(this.seal.x, this.seal.y, this.seal.radius);
    for (const c of this.spawner.alive) {
      if (!c.active) continue;
      const color = canEat(this.seal.stage, c.def.tier) ? 0x5ee07a : 0xff5a4f;
      g.lineStyle(1.5, color, 0.9).strokeCircle(c.x, c.y, c.radius);
    }
    for (const h of this.hazards.alive) {
      if (h.active) g.lineStyle(2, 0xff9a3c, 1).strokeCircle(h.x, h.y, h.radius);
    }
    for (const p of this.predators.alive) {
      if (!p.active) continue;
      const mouthP = p.mouthPosition(this.predatorMouth);
      g.lineStyle(2, 0xd48cff, 1).strokeCircle(p.x, p.y, p.radius);
      g.lineStyle(2, 0xff3b30, 1).strokeCircle(mouthP.x, mouthP.y, p.def.mouthRadius);
      g.lineStyle(1, 0xff3b30, 0.25).strokeCircle(p.x, p.y, p.def.noticeRadius);
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
