// The run: the seal swims an endless ocean, eats prey to keep its hunger up, grows through
// stages, dodges hazards and predators, collects coins, and dies when hunger hits zero.
// HUD state goes out over the EventBus; results are banked in the save on death.
import Phaser from 'phaser';
import { SoundKeys } from '../audio/sounds';
import {
  CAMERA,
  COINS,
  COMBO,
  DAMAGE,
  EFFECTS,
  FEEDING,
  FRENZY,
  GROWTH,
  HITSTOP,
  HUNGER,
  PICKUPS,
  SEAL_MOTION,
} from '../config/balance';
import { RegistryKeys, SceneKeys } from '../config/keys';
import { missionDef } from '../config/missions';
import { skinDef } from '../config/skins';
import { WORLD, depthMeters, zoneAt, type ZoneId } from '../config/zones';
import { TerrainRenderer } from '../systems/TerrainRenderer';
import { TerrainShader } from '../systems/TerrainShader';
import { Decor } from '../systems/Decor';
import { Gates } from '../systems/Gates';
import { Eels } from '../systems/Eels';
import { Boats, BOATS, type BoatEvent } from '../systems/Boats';
import { Boss, BOSS, type BossEvent } from '../systems/Boss';
import type { Hazard } from '../entities/Hazard';
import { MapHazards } from '../systems/MapHazards';
import { Pearls } from '../systems/Pearls';
import { GameMap, setCurrentMap } from '../world/GameMap';
import { MAPS } from '../config/maps';
import type { Creature } from '../entities/Creature';
import { startle } from '../entities/creatureAI';
import type { Predator } from '../entities/Predator';
import { predatorBit } from '../entities/predatorAI';
import { Seal } from '../entities/Seal';
import type { SealMotionEvent } from '../entities/sealMotion';
import { audio } from '../services/AudioManager';
import {
  EventBus,
  subscribeForScene,
  type DamageSource,
  type DeathCause,
  type RunResult,
} from '../services/EventBus';
import { saves } from '../services/SaveService';
import { fitWorldCamera, getViewport, onResize, sharpenTexts } from '../services/Viewport';
import { CoinField } from '../systems/CoinField';
import { Darkness } from '../systems/Darkness';
import { Pickups, type PickupEvent } from '../systems/Pickups';
import { completedNow, emptyRunStats, type RunStats } from '../systems/progress';
import { ComboSystem } from '../systems/ComboSystem';
import { Effects } from '../systems/Effects';
import { canEat, circlesOverlap } from '../systems/feeding';
import { FrenzySystem } from '../systems/FrenzySystem';
import { GrowthSystem } from '../systems/GrowthSystem';
import { HazardField } from '../systems/HazardField';
import { HungerSystem } from '../systems/HungerSystem';
import { InputController } from '../systems/InputController';
import { Predators, type SealInfo } from '../systems/Predators';
import { Spawner } from '../systems/Spawner';
import { Tutorial, type HintId } from '../systems/Tutorial';
import { runModifiers, type RunModifiers } from '../systems/UpgradeSystem';
import { WorldBackground } from '../systems/WorldBackground';
import { clamp, damp } from '../utils/math';

const DEBUG_INFO_INTERVAL = 0.2;
const GAME_OVER_DELAY = 1600;
const TOO_BIG_TEXT_COOLDOWN = 1500;
/** Combos at least this long get a "N COMBO!" callout when they end. */
const COMBO_CALLOUT_MIN = 5;
/** Effective bite tier during a frenzy: everything is edible. */
const FRENZY_STAGE = 99;
/** Seconds before the same zone's banner can show again (no spam at zone borders). */
const ZONE_BANNER_COOLDOWN = 8;
/** Seconds between checks for missions completed mid-run (for the HUD toast). */
const MISSION_CHECK_INTERVAL = 0.5;

function hintTexts(touch: boolean): Record<HintId, string> {
  return {
    move: touch
      ? 'Touch anywhere and drag to swim, like a joystick'
      : 'Move the mouse to swim (or use WASD / arrow keys)',
    eat: 'Eat fish smaller than you! Your hunger bar drains all the time',
    boost: touch
      ? 'Tap Boost to dash. Leap out of the water to catch birds!'
      : 'Hold click or Space to boost. Leap out of the water to catch birds!',
    danger: 'Watch out for jellyfish and sea mines!',
    grow: 'You grew! Bigger fish are on the menu now',
    shark: 'Shark! Swim away: boost, or leap out of the water!',
  };
}

export class GameScene extends Phaser.Scene {
  private seal!: Seal;
  private controls!: InputController;
  private background!: WorldBackground;
  /** The map being played and its rock. */
  map!: GameMap;
  private terrainView!: TerrainRenderer | TerrainShader;
  private decor!: Decor;
  private gates!: Gates;
  private eels!: Eels;
  private boats!: Boats;
  private boss!: Boss;
  private pearls!: Pearls;
  private mapHazards!: MapHazards;
  /** Run time of the last "too strong" / "toxic" warnings. */
  private lastGateHint = -Infinity;
  private lastCloudHint = -Infinity;
  private effects!: Effects;
  private spawner!: Spawner;
  private hazards!: HazardField;
  private predators!: Predators;
  private coins!: CoinField;
  private hunger!: HungerSystem;
  private growth!: GrowthSystem;
  private combo!: ComboSystem;
  private frenzy!: FrenzySystem;
  /** Shop upgrades for this run. */
  private mods!: RunModifiers;
  private tutorial: Tutorial | null = null;
  private hintShown: string | null = null;
  private sharkNoticed = false;
  private currentZone: ZoneId = 'reef';
  private readonly zoneBannerAt = new Map<string, number>();
  private currentRegion = '';
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
  private frenzyShown = { meter: -1, active: false };
  private debugTimer = 0;
  private lastStamina = -1;
  private lastTooBigAt = -Infinity;
  /** Seconds of frozen simulation left (hit-stop). */
  private hitStop = 0;
  private lastHit: { source: DamageSource; at: number } | null = null;
  /** Camera zoom factor from the growth stage (1 = stage 1). */
  private stageZoom = 1;
  private darkness!: Darkness;
  private pickups!: Pickups;
  /** Seconds of magnet-orb power left. */
  private magnetLeft = 0;
  private magnetShown = -1;
  /** A pause has been queued (Phaser applies it on the next update). */
  private pausePending = false;
  // Progression tracking for missions, stats and achievements.
  private runGems = 0;
  private eatenBy: Record<string, number> = {};
  private chests = 0;
  private frenzies = 0;
  private missionTimer = 0;
  private readonly missionsShown = new Set<string>();
  private readonly liveRun: RunStats = emptyRunStats();

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
    this.frenzyShown = { meter: -1, active: false };
    this.debugTimer = 0;
    this.lastStamina = -1;
    this.lastTooBigAt = -Infinity;
    this.hitStop = 0;
    this.lastHit = null;
    this.lookAhead.set(0, 0);
    this.stageZoom = 1;
    this.magnetLeft = 0;
    this.magnetShown = -1;
    this.pausePending = false;
    this.runGems = 0;
    this.eatenBy = {};
    this.chests = 0;
    this.frenzies = 0;
    this.missionTimer = MISSION_CHECK_INTERVAL;
    this.missionsShown.clear();

    // Shop upgrades shape this run.
    const mods = runModifiers(saves.data.upgrades);
    this.mods = mods;
    this.hunger = new HungerSystem({
      ...HUNGER,
      max: HUNGER.max + mods.extraHunger,
      baseDrainPerSec: HUNGER.baseDrainPerSec * mods.drainMult,
    });
    this.growth = new GrowthSystem(GROWTH.stageCosts);
    this.combo = new ComboSystem(COMBO.window, COMBO.thresholds);
    this.frenzy = new FrenzySystem(FRENZY);
    const touch = this.sys.game.device.input.touch;
    this.tutorial = saves.data.tutorialDone ? null : new Tutorial(hintTexts(touch));
    this.hintShown = null;
    this.sharkNoticed = false;
    this.zoneBannerAt.clear();
    this.currentRegion = '';

    // The map: set it first, the spawners and the seal read its terrain.
    this.map = GameMap.get(saves.data.maps.selected);
    setCurrentMap(this.map);
    this.background = new WorldBackground(this, this.map);
    this.effects = new Effects(this);
    this.spawner = new Spawner(this);
    this.hazards = new HazardField(this);
    this.coins = new CoinField(this);
    this.pickups = new Pickups(this);
    this.darkness = new Darkness(this);
    const skin = skinDef(saves.data.skins.equipped);
    const start = this.map.def.start;
    this.seal = new Seal(this, start.x, start.y, mods, skin.texture);
    this.predators = new Predators(this);
    this.controls = new InputController(this);
    this.debugGfx = this.add.graphics().setDepth(50);

    const cam = this.cameras.main;
    // Zoomed so the 1280x720 design area fits; wide/tall screens see more world.
    fitWorldCamera(cam);
    onResize(this, () => {
      fitWorldCamera(cam);
      sharpenTexts(this);
    });
    // Bounded by the map: its width, and the sky to the seabed.
    cam.setBounds(0, WORLD.ceilingY, this.map.width, WORLD.height - WORLD.ceilingY);
    // GPU terrain where WebGL is available; canvas chunks otherwise.
    this.terrainView =
      this.renderer.type === Phaser.WEBGL && !this.registry.get(RegistryKeys.CanvasTerrain)
        ? new TerrainShader(this, this.map)
        : new TerrainRenderer(this, this.map);
    this.decor = new Decor(this, this.map);
    this.gates = new Gates(this, this.map);
    this.seal.setFlow(this.gates.flow);
    this.pearls = new Pearls(this, this.map, this.effects);
    this.mapHazards = new MapHazards(this, this.map);
    this.eels = new Eels(this, this.map.def);
    this.boats = new Boats(this, this.map.def);
    this.boss = new Boss(this, this.map.def.boss);
    this.lastGateHint = -Infinity;
    this.lastCloudHint = -Infinity;
    cam.centerOn(this.seal.x, this.seal.y);
    cam.startFollow(this.seal, false, CAMERA.lerpX, CAMERA.lerpY);
    cam.fadeIn(400, 4, 20, 37);

    this.currentZone = zoneAt(this.seal.y).id;
    this.updateMusic();
    this.updateThreat();
    this.spawner.populate(this.seal.x, this.seal.y, this.threat);

    this.setupDebug();
    this.setupPause();

    sharpenTexts(this);
    this.scene.launch(SceneKeys.Hud);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.terrainView.destroy();
      this.decor.destroy();
      this.gates.destroy();
      this.pearls.destroy();
      this.mapHazards.destroy();
      this.eels.destroy();
      this.boats.destroy();
      this.boss.destroy();
      EventBus.emit('boss:hp', { name: '', hp: 0, max: 1, show: false });
      this.scene.stop(SceneKeys.Hud);
      this.scene.stop(SceneKeys.GameOver);
      this.scene.stop(SceneKeys.Pause);
    });
  }

  /** Esc / P / the HUD button pause; so does leaving the tab or window mid-run. */
  private setupPause(): void {
    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => this.pauseRun());
    kb.on('keydown-P', () => this.pauseRun());
    subscribeForScene(this, [EventBus.on('ui:pause', () => this.pauseRun())]);
    const onAway = () => this.pauseRun();
    // Keys released while paused never reached this scene: don't let them stick.
    const onResume = () => {
      this.pausePending = false;
      this.input.keyboard?.resetKeys();
    };
    this.game.events.on(Phaser.Core.Events.BLUR, onAway);
    this.game.events.on(Phaser.Core.Events.HIDDEN, onAway);
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, onAway);
      this.game.events.off(Phaser.Core.Events.HIDDEN, onAway);
      this.events.off(Phaser.Scenes.Events.RESUME, onResume);
    });
  }

  private pauseRun(): void {
    // Phaser applies pause on its next update, so several triggers in one frame (switching
    // tabs fires both BLUR and HIDDEN) must only queue it once.
    if (this.dead || this.pausePending || !this.scene.isActive()) return;
    this.pausePending = true;
    this.scene.pause();
    this.scene.pause(SceneKeys.Hud);
    this.scene.launch(SceneKeys.Pause);
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
      this.hunger.update(
        dt,
        this.elapsed,
        zoneAt(this.seal.y).id,
        this.mapHazards.drainAt(this.seal.x, this.seal.y),
      );
      this.updateMapWarnings();
      this.trackDistance(dt);
      const ended = this.combo.update(dt);
      if (ended >= COMBO_CALLOUT_MIN) {
        this.effects.floatText(this.seal.x, this.seal.y - 80, `${ended} COMBO!`, '#ffb3ff', 34);
        audio.play(SoundKeys.Combo);
      }
      if (this.frenzy.update(dt)) this.endFrenzy();
      this.updateZone();
      this.updateTutorial(dt);
      this.missionTimer -= dt;
      if (this.missionTimer <= 0) {
        this.missionTimer = MISSION_CHECK_INTERVAL;
        this.checkMissions();
      }
      this.updateCamera(dt);
      this.updateTrail(dt);
    }

    this.updateThreat();
    this.spawner.update(dt, cam, this.threat);
    // Danger ramps with run time; `?calm` keeps it at zero.
    const dangerTime = this.registry.get(RegistryKeys.Calm) ? 0 : this.elapsed;
    this.hazards.update(dt, cam, this.threat, dangerTime);
    for (const e of this.predators.update(dt, time, cam, this.threat, dangerTime)) {
      if (e.event === 'notice') {
        audio.play(SoundKeys.SharkAlert);
        this.sharkNoticed = true;
      }
    }
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
      this.magnetRadius,
    );
    if (collected > 0) {
      this.runCoins += collected;
      this.effects.coinPickup(this.seal.x, this.seal.y);
      audio.play(SoundKeys.Coin);
      this.hudDirty = true;
    }
    const sealBody = {
      x: this.seal.x,
      y: this.seal.y,
      vx: this.threat.vx,
      vy: this.threat.vy,
      radius: this.seal.radius,
    };
    for (const e of this.pickups.update(dt, cam, sealBody, !this.dead)) this.onPickup(e);
    if (this.pearls.update(dt, sealBody, !this.dead)) this.hudDirty = true;
    this.gates.update(dt, this.seal.stage, cam);
    const vulnerable = !this.dead && !this.seal.isInvulnerable && !this.frenzy.active;
    for (const e of this.eels.update(dt, sealBody, this.biteStage, vulnerable, cam.worldView)) {
      if (e.type === 'zap') this.effects.zap(e.x, e.y);
      if (e.type === 'bite') this.effects.bite(this.seal.x, this.seal.y);
      if (e.type === 'bite' || e.hit) this.hurt(e.source, e.x, e.y, e.damage, e.knockback, e.stun);
    }
    const boatSeal = { ...sealBody, inWater: this.seal.motion.inWater };
    for (const e of this.boats.update(dt, time, boatSeal, this.seal.stage, vulnerable)) {
      this.onBoatEvent(e);
    }
    for (const e of this.boss.update(dt, sealBody, vulnerable)) this.onBossEvent(e);
    this.mapHazards.update(dt, cam);
    this.magnetLeft = Math.max(0, this.magnetLeft - dt);
    this.darkness.update(dt, this.seal.x, this.seal.y);

    if (!this.dead) {
      this.checkFeeding(time);
      this.checkHazards();
      this.checkPredatorBites();
      if (this.hunger.isStarved) this.die();
    }

    this.effects.update(dt, cam);
    this.terrainView.update(cam);
    this.decor.update(dt, cam);
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
    // A dead seal scares nobody and can't be hunted; a frenzied one scares everything.
    this.threat.stage = this.dead ? 0 : this.biteStage;
  }

  /** Coin magnet reach: the upgraded base, or the frenzy's big pull. */
  private get magnetRadius(): number {
    let r = COINS.magnetRadius * this.mods.magnetMult;
    if (this.frenzy.active) r = Math.max(r, FRENZY.magnetRadius);
    if (this.magnetLeft > 0) r = Math.max(r, PICKUPS.magnetRadius);
    return r;
  }

  private onPickup(e: PickupEvent): void {
    if (e.kind === 'chest') {
      this.chests++;
      if (Math.random() < PICKUPS.chestGemChance) {
        this.runGems++;
        this.effects.floatText(e.x, e.y - 95, '+1 GEM', '#ff8ae0', 34);
        this.time.delayedCall(250, () => audio.play(SoundKeys.Gem));
      }
      const [min, max] = PICKUPS.chestCoins;
      this.coins.drop(e.x, e.y - 12, Phaser.Math.Between(min, max));
      this.score += PICKUPS.chestScore;
      this.effects.growBurst(e.x, e.y);
      this.effects.floatText(e.x, e.y - 50, 'TREASURE!', '#ffd23c', 40);
      audio.play(SoundKeys.ChestOpen);
    } else {
      this.magnetLeft = PICKUPS.magnetDuration;
      this.effects.coinPickup(e.x, e.y);
      this.effects.floatText(e.x, e.y - 40, 'COIN MAGNET!', '#ff8a7a', 34);
      audio.play(SoundKeys.Magnet);
    }
    this.hudDirty = true;
  }

  /** Bright music up top, the dark loop in the deep and the abyss. */
  private updateMusic(): void {
    const deep = this.currentZone === 'deep' || this.currentZone === 'abyss';
    audio.setMusic(deep ? SoundKeys.MusicDeep : SoundKeys.MusicShallows);
  }

  /** Camera shake, unless the player turned it off in Settings. */
  private shake(duration: number, intensity: number): void {
    if (saves.data.settings.shake) this.cameras.main.shake(duration, intensity);
  }

  /** Bite tier for eating checks: the growth stage, or anything during a frenzy. */
  private get biteStage(): number {
    return this.frenzy.active ? FRENZY_STAGE : this.seal.stage;
  }

  /**
   * Depth zones drive the music; regions drive the banner (name, blurb, danger), shown when
   * swimming into a new region, rate-limited per region.
   */
  private updateZone(): void {
    const zone = zoneAt(this.seal.y);
    if (zone.id !== this.currentZone && zone.id !== 'surface') {
      this.currentZone = zone.id;
      this.updateMusic();
    }
    const region = this.map.regionAt(this.seal.x, this.seal.y);
    if (region.id === this.currentRegion) return;
    const first = this.currentRegion === '';
    this.currentRegion = region.id;
    const last = this.zoneBannerAt.get(region.id) ?? -Infinity;
    if (this.elapsed - last < ZONE_BANNER_COOLDOWN) return;
    this.zoneBannerAt.set(region.id, this.elapsed);
    EventBus.emit('zone:enter', { name: region.name, blurb: region.blurb, danger: region.danger });
    if (!first) audio.play(SoundKeys.Zone);
  }

  private updateTutorial(dt: number): void {
    if (!this.tutorial) return;
    const hint = this.tutorial.update(dt, {
      elapsed: this.elapsed,
      distance: this.distance,
      eaten: this.eaten,
      stage: this.growth.stage,
      sharkNoticed: this.sharkNoticed,
    });
    if (hint !== this.hintShown) {
      this.hintShown = hint;
      EventBus.emit('hint', hint);
    }
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
    const stage = this.biteStage;
    for (const c of this.spawner.alive) {
      if (!c.active) continue; // eaten earlier this frame
      if (!circlesOverlap(mouth.x, mouth.y, r, c.x, c.y, c.radius)) continue;
      if (canEat(stage, c.def.tier)) this.eat(c);
      else this.bumpInto(c, time);
    }
    for (const p of this.predators.alive) {
      if (!p.active || !canEat(stage, p.def.tier)) continue;
      if (circlesOverlap(mouth.x, mouth.y, r, p.x, p.y, p.radius)) this.eatPredator(p);
    }
    // The boss can't be eaten: biting it while it's exposed takes a heart.
    const b = this.boss.body;
    if (b.exposed && circlesOverlap(mouth.x, mouth.y, r, b.x, b.y, b.r)) {
      this.boss.hit();
      for (const e of this.boss.drainEvents()) this.onBossEvent(e);
    }
    for (const h of this.eels.heads()) {
      if (!canEat(stage, h.tier) || !circlesOverlap(mouth.x, mouth.y, r, h.x, h.y, h.r)) continue;
      this.feed(h.x, h.y, this.eels.eat(h.eel));
      this.effects.chomp(h.x, h.y, true);
      audio.play(SoundKeys.ChompBig);
    }
  }

  /**
   * Shared rewards for any meal. Score = base x combo x frenzy. Also charges the frenzy
   * meter. Returns the points scored.
   */
  private feed(
    x: number,
    y: number,
    reward: { nutrition: number; score: number; growth: number },
  ): number {
    const comboMult = this.combo.hit();
    const points = reward.score * comboMult * (this.frenzy.active ? FRENZY.scoreMult : 1);
    this.hunger.feed(reward.nutrition);
    this.score += points;
    this.eaten++;
    this.seal.chomp();
    this.effects.floatText(x, y - 24, `+${points}`);
    if (this.growth.add(reward.growth * this.mods.growthMult) > 0) this.onGrow();
    if (this.frenzy.feed(comboMult * this.mods.frenzyChargeMult)) this.startFrenzy();
    this.hudDirty = true;
    return points;
  }

  private startFrenzy(): void {
    this.frenzies++;
    this.seal.setFrenzy(true);
    this.seal.setSpeedBonus(FRENZY.speedMult);
    audio.play(SoundKeys.Frenzy);
    this.effects.floatText(this.seal.x, this.seal.y - 90, 'FRENZY!', '#ffb13c', 56);
    this.cameras.main.flash(250, 255, 210, 120);
    this.shake(250, 0.008);
  }

  private endFrenzy(): void {
    this.seal.setFrenzy(false);
    this.seal.setSpeedBonus(1);
  }

  private eat(c: Creature): void {
    const def = c.def;
    // A puffed-up pufferfish still gets eaten, but the spikes hurt.
    if (c.puffed && !this.frenzy.active && !this.seal.isInvulnerable) {
      this.hurt(
        'pufferfish',
        c.x,
        c.y,
        FEEDING.pufferDamage,
        FEEDING.pufferKnockback,
        FEEDING.pufferStun,
      );
    }
    const big = def.tier >= 2;
    this.effects.chomp(c.x, c.y, big);
    audio.play(big ? SoundKeys.ChompBig : SoundKeys.Chomp);
    if (big) this.hitStop = HITSTOP.eatBig;
    const chance = COINS.dropChanceByTier[Math.min(def.tier, COINS.dropChanceByTier.length - 1)];
    if (Math.random() < chance) this.coins.drop(c.x, c.y, 1);
    this.countMeal(def.id);
    this.feed(c.x, c.y, def);
    c.despawn();
  }

  private eatPredator(p: Predator): void {
    const def = p.def;
    this.effects.chomp(p.x, p.y, true);
    this.effects.growBurst(p.x, p.y);
    audio.play(SoundKeys.ChompBig);
    this.coins.drop(p.x, p.y, def.coins);
    this.hitStop = HITSTOP.explode;
    this.shake(260, 0.01);
    this.countMeal(def.id);
    this.feed(p.x, p.y, def);
    p.despawn();
  }

  private countMeal(id: string): void {
    this.eatenBy[id] = (this.eatenBy[id] ?? 0) + 1;
  }

  /** What this run has achieved so far (reuses one object; copy it to keep it). */
  private runStats(cause: DeathCause): RunStats {
    const r = this.liveRun;
    r.score = this.score;
    r.coins = this.runCoins;
    r.gems = this.runGems;
    r.seconds = this.elapsed;
    r.distance = this.distance;
    r.maxDepth = Math.max(0, this.maxDepth);
    r.eaten = this.eaten;
    r.eatenBy = this.eatenBy;
    r.chests = this.chests;
    r.frenzies = this.frenzies;
    r.maxStage = this.growth.stage;
    r.cause = cause;
    return r;
  }

  /** Toast missions the moment they're done (they're paid when the run ends). */
  private checkMissions(): void {
    for (const id of completedNow(saves.data.missions.active, this.runStats('starved'))) {
      if (this.missionsShown.has(id)) continue;
      this.missionsShown.add(id);
      const def = missionDef(id);
      if (!def) continue;
      EventBus.emit('mission:complete', { text: def.text, coins: def.coins, gems: def.gems ?? 0 });
      audio.play(SoundKeys.Mission);
      audio.play(SoundKeys.Buy);
    }
  }

  private onGrow(): void {
    this.seal.setStage(this.growth.stage);
    this.effects.growBurst(this.seal.x, this.seal.y);
    const label = this.growth.isMaxStage ? 'MAX SIZE!' : 'BIGGER!';
    this.effects.floatText(this.seal.x, this.seal.y - 70, label, '#7dfcff', 38);
    audio.play(SoundKeys.Grow);
    this.shake(180, 0.005);
  }

  private bumpInto(c: Creature, time: number): void {
    if (c.bumpCooldown > 0) return;
    c.bumpCooldown = FEEDING.bumpCooldown;
    this.seal.bump();
    startle(c.motion, Math.random);
    audio.play(SoundKeys.Bump);
    this.shake(90, 0.003);
    if (time - this.lastTooBigAt > TOO_BIG_TEXT_COOLDOWN) {
      this.lastTooBigAt = time;
      this.effects.floatText(c.x, c.y - 30, 'Too big!', '#d8e3ea', 22);
    }
  }

  // ---------------------------------------------------------------------------------------
  // Danger
  // ---------------------------------------------------------------------------------------

  private checkHazards(): void {
    if (this.checkHazardList(this.hazards.alive)) return;
    this.checkHazardList(this.mapHazards.alive);
  }

  /** Contact with any hazard in the list. Returns true if one hit the seal. */
  private checkHazardList(list: readonly Hazard[]): boolean {
    const s = this.seal;
    const frenzied = this.frenzy.active;
    if (s.isInvulnerable && !frenzied) return false;
    for (const h of list) {
      if (!h.active || !circlesOverlap(s.x, s.y, s.radius, h.x, h.y, h.radius)) continue;
      const def = h.def;
      if (frenzied) {
        // Frenzy: smash straight through hazards for points.
        if (def.explodes) this.effects.explosion(h.x, h.y);
        else this.effects.zap(h.x, h.y);
        audio.play(def.explodes ? SoundKeys.Explode : SoundKeys.Zap);
        this.score += FRENZY.hazardScore;
        this.effects.floatText(h.x, h.y - 30, `+${FRENZY.hazardScore}`, '#ffb13c');
        this.hudDirty = true;
        h.despawn();
        continue;
      }
      this.hurt(def.id, h.x, h.y, def.damage, def.knockback, def.stun);
      if (def.explodes) {
        this.effects.explosion(h.x, h.y);
        audio.play(SoundKeys.Explode);
        this.shake(320, 0.014);
        this.hitStop = HITSTOP.explode;
        h.despawn();
      } else {
        this.effects.zap(s.x, s.y);
        audio.play(SoundKeys.Zap);
      }
      return true;
    }
    return false;
  }

  private onBossEvent(e: BossEvent): void {
    switch (e.type) {
      case 'hp':
        EventBus.emit('boss:hp', { name: e.name, hp: e.hp, max: e.max, show: e.show });
        break;
      case 'hit-seal':
        this.hurt('boss', e.x, e.y, BOSS.damage, BOSS.knockback, 0.4);
        break;
      case 'hurt':
        this.seal.chomp();
        this.effects.chomp(e.x, e.y, true);
        this.effects.bubbleBurst(e.x, e.y, 18);
        this.effects.floatText(e.x, e.y - 120, e.hp > 0 ? 'OUCH!' : 'GOT IT!', '#ff9ad5', 40);
        audio.play(SoundKeys.ChompBig);
        this.shake(200, 0.008);
        this.hitStop = Math.max(this.hitStop, 0.08);
        break;
      case 'defeated': {
        const first = saves.defeatBoss(this.map.id);
        this.score += BOSS.reward.score;
        this.coins.drop(e.x, e.y, BOSS.reward.coins / 4);
        if (first) this.runGems += BOSS.reward.gems;
        this.effects.growBurst(e.x, e.y);
        this.effects.floatText(
          e.x,
          e.y - 160,
          first ? `BOSS DEFEATED! +${BOSS.reward.gems} gems` : 'BOSS DEFEATED!',
          '#ffe08a',
          46,
        );
        audio.play(SoundKeys.Unlock);
        this.cameras.main.flash(300, 255, 240, 200);
        this.shake(400, 0.016);
        this.hudDirty = true;
        break;
      }
    }
  }

  private onBoatEvent(e: BoatEvent): void {
    switch (e.type) {
      case 'net':
        this.seal.trap(BOATS.netTrap);
        this.hurt('net', e.x, e.y, BOATS.netDamage, 120, 0.2);
        this.effects.floatText(this.seal.x, this.seal.y - 60, 'Tangled!', '#e8d6b0', 30);
        break;
      case 'harpoon':
        this.hurt('harpoon', e.x, e.y, BOATS.harpoonDamage, BOATS.harpoonKnockback, 0.3);
        break;
      case 'rammed':
        this.effects.splash(e.x, -600);
        this.shake(220, 0.01);
        this.effects.floatText(e.x, e.y - 90, 'CATCH OVERBOARD!', '#ffe08a', 34);
        break;
      case 'crate': {
        const c = BOATS.crate;
        this.feed(e.x, e.y, c);
        this.runCoins += c.coins;
        this.effects.coinPickup(e.x, e.y);
        audio.play(SoundKeys.ChompBig);
        break;
      }
    }
  }

  /** "Too strong!" when a gate holds the seal back; "Toxic water!" in a cloud. */
  private updateMapWarnings(): void {
    const s = this.seal;
    const gate = this.gates.blocking(s.x, s.y);
    if (gate && this.elapsed - this.lastGateHint > 4) {
      this.lastGateHint = this.elapsed;
      this.effects.floatText(s.x, s.y - 70, `Too strong! Grow to size ${gate.minStage}`, '#ffe08a', 30);
      audio.play(SoundKeys.Bump);
    }
    const cloud = this.mapHazards.cloudAt(s.x, s.y);
    if (cloud && this.elapsed - this.lastCloudHint > 5) {
      this.lastCloudHint = this.elapsed;
      const text = cloud === 'toxic' ? 'Toxic water! Hunger drains fast' : 'Hot water! Hunger drains fast';
      this.effects.floatText(s.x, s.y - 70, text, cloud === 'toxic' ? '#9dff6a' : '#ffae6a', 28);
    }
  }

  private checkPredatorBites(): void {
    if (this.seal.isInvulnerable || this.frenzy.active) return;
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
    audio.play(SoundKeys.Hurt);
    this.combo.reset();
    this.lastHit = { source, at: this.elapsed };
    this.hitStop = Math.max(this.hitStop, HITSTOP.hurt);
    this.shake(220, 0.01);
    this.effects.floatText(this.seal.x, this.seal.y - 40, `-${damage}`, '#ff6b5b', 30);
    this.hudDirty = true;
    EventBus.emit('seal:hurt', { source, damage });
  }

  private die(): void {
    this.dead = true;
    if (this.frenzy.active) this.endFrenzy();
    this.seal.die();
    audio.play(SoundKeys.GameOver);
    // One run is enough of an introduction.
    saves.completeTutorial();
    if (this.hintShown) EventBus.emit('hint', null);
    this.shake(250, 0.006);
    const recent = this.lastHit && this.elapsed - this.lastHit.at <= DAMAGE.killWindow;
    const cause: DeathCause = recent && this.lastHit ? this.lastHit.source : 'starved';
    const distance = Math.round(this.distance);
    const settled = saves.recordRun({ ...this.runStats(cause), eatenBy: { ...this.eatenBy } });
    const { data, newBest } = settled;
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
      gems: this.runGems,
      rewardCoins: settled.rewardCoins,
      rewardGems: settled.rewardGems,
      totalGems: data.gems,
      missions: settled.missions.map((m) => ({ text: m.text, coins: m.coins, gems: m.gems ?? 0 })),
      achievements: settled.achievements.map((a) => ({ name: a.name, gems: a.gems })),
      rank: settled.rank,
      unlockedMaps: settled.unlockedMaps.map((id) => MAPS[id].name),
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
        if (Math.abs(e.vy) >= EFFECTS.splashMinSpeed) audio.play(SoundKeys.Splash);
        if (e.type === 'splashdown' && e.vy > 650) this.shake(120, 0.004);
        break;
      case 'boostStart':
        audio.play(SoundKeys.Boost);
        this.shake(90, 0.002);
        break;
      case 'boostEnd':
        break;
      case 'wallHit': {
        // Bonk: a thud, a little shake and some grit.
        const k = Math.min(1, e.speed / 600);
        audio.play(SoundKeys.Thud, { volume: 0.3 + 0.5 * k });
        this.effects.bubbleBurst(e.x, e.y, Math.round(3 + 6 * k));
        if (k > 0.5) this.shake(100, 0.003 * k);
        break;
      }
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
    // Ease the camera back as the seal grows (on top of the screen-fit zoom).
    const target = GROWTH.stages[this.seal.stage - 1].zoom;
    this.stageZoom = damp(this.stageZoom, target, 1.2, dt);
    this.cameras.main.setZoom(getViewport().worldZoom * this.stageZoom);
  }

  private updateTrail(dt: number): void {
    const m = this.seal.motion;
    if (!m.inWater) return;
    const rate =
      m.boosting || this.frenzy.active
        ? 1
        : Math.max(0, (m.speed / SEAL_MOTION.maxSpeed - 0.6) * 1.5);
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
    const magnet = Math.ceil(this.magnetLeft);
    if (magnet !== this.magnetShown) {
      this.magnetShown = magnet;
      EventBus.emit('run:magnet', magnet);
    }
    const f = this.frenzy;
    if (
      f.active !== this.frenzyShown.active ||
      Math.abs(f.meter - this.frenzyShown.meter) > 0.002
    ) {
      this.frenzyShown = { meter: f.meter, active: f.active };
      EventBus.emit('run:frenzy', { meter: f.meter, active: f.active });
    }
    if (this.hudDirty) {
      this.hudDirty = false;
      EventBus.emit('run:score', this.score);
      EventBus.emit('run:coins', this.runCoins);
      EventBus.emit('run:pearls', { found: this.pearls.found, total: this.pearls.total });
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
      zone: this.map.zone(zone).name,
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
