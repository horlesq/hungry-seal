// Typed, game-wide event bus used for scene-to-scene communication (e.g. Game -> HUD).
// Subscribers must unsubscribe on scene shutdown; `on` returns the unsubscribe function.
import Phaser from 'phaser';

export type InputSource = 'keyboard' | 'mouse' | 'touch';

export interface BoostState {
  active: boolean;
  stamina: number;
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
}

export interface GameEvents {
  'input:source': [source: InputSource];
  'seal:boost': [state: BoostState];
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
