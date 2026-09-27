// Typed, game-wide event bus used for scene-to-scene communication (e.g. Game -> HUD).
// Subscribers must unsubscribe on scene shutdown; `on` returns the unsubscribe function.
import Phaser from 'phaser';
import type { HazardId } from '../config/hazards';
import type { PredatorId } from '../config/predators';

export type InputSource = 'keyboard' | 'mouse' | 'touch';

export interface BoostState {
  active: boolean;
  stamina: number;
}

export interface HungerState {
  value: number;
  max: number;
  low: boolean;
}

/** Touch joystick for the HUD: base position and steering (design units, length 0..1). */
export interface StickState {
  active: boolean;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export interface GrowthState {
  stage: number;
  maxStage: number;
  /** 0..1 toward the next stage. */
  progress: number;
}

export type DamageSource = HazardId | PredatorId | 'pufferfish';
export type DeathCause = 'starved' | DamageSource;

export interface ComboState {
  /** Meals in the combo; 0 = no combo. */
  count: number;
  multiplier: number;
  /** 0..1 time left in the combo window. */
  remaining: number;
}

export interface FrenzyState {
  /** 0..1 fill, or time left while active. */
  meter: number;
  active: boolean;
}

export interface RunResult {
  score: number;
  seconds: number;
  eaten: number;
  stage: number;
  /** Coins collected this run. */
  coins: number;
  /** Meters swum this run. */
  distance: number;
  /** Deepest point reached, meters. */
  maxDepth: number;
  cause: DeathCause;
  newBest: boolean;
  bestScore: number;
  /** Banked coins after this run. */
  totalCoins: number;
  /** Gems found this run (treasure chests). */
  gems: number;
  /** Paid by missions and achievements completed this run. */
  rewardCoins: number;
  rewardGems: number;
  totalGems: number;
  missions: Array<{ text: string; coins: number; gems: number }>;
  achievements: Array<{ name: string; gems: number }>;
  /** Place on the top-runs list (1-5), or null. */
  rank: number | null;
}

export interface DebugInfo {
  fps: number;
  x: number;
  y: number;
  depthM: number;
  zone: string;
  speed: number;
  headingDeg: number;
  inWater: boolean;
  stamina: number;
  boosting: boolean;
  input: InputSource;
  steerX: number;
  steerY: number;
  particles: number;
  objects: number;
  creatures: number;
  hazards: number;
  predators: string;
  coins: number;
  stage: number;
  hunger: number;
  drain: number;
  elapsed: number;
}

export interface GameEvents {
  'input:source': [source: InputSource];
  'seal:boost': [state: BoostState];
  'input:stick': [state: StickState];
  'run:hunger': [state: HungerState];
  'run:growth': [state: GrowthState];
  'run:score': [score: number];
  'run:coins': [coins: number];
  'run:combo': [state: ComboState];
  'run:frenzy': [state: FrenzyState];
  /** Whole seconds of coin-magnet power left (0 = none). */
  'run:magnet': [seconds: number];
  'run:over': [result: RunResult];
  'seal:hurt': [info: { source: DamageSource; damage: number }];
  /** First-run hint text to show at the bottom of the screen (null = hide). */
  hint: [text: string | null];
  'zone:enter': [zone: { name: string; blurb: string }];
  /** An active mission was just completed mid-run (paid when the run ends). */
  'mission:complete': [mission: { text: string; coins: number; gems: number }];
  /** The HUD's pause button was pressed. */
  'ui:pause': [];
  'debug:toggle': [enabled: boolean];
  'debug:info': [info: DebugInfo];
}

class TypedEventBus {
  private readonly emitter = new Phaser.Events.EventEmitter();

  on<K extends keyof GameEvents>(
    event: K,
    fn: (...args: GameEvents[K]) => void,
    context?: unknown,
  ): () => void {
    this.emitter.on(event, fn, context);
    return () => {
      this.emitter.off(event, fn, context);
    };
  }

  emit<K extends keyof GameEvents>(event: K, ...args: GameEvents[K]): void {
    this.emitter.emit(event, ...args);
  }
}

export const EventBus = new TypedEventBus();

/** Subscribes for the lifetime of a scene; listeners are removed when it shuts down. */
export function subscribeForScene(scene: Phaser.Scene, unsubscribers: Array<() => void>): void {
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    for (const off of unsubscribers) off();
  });
}
