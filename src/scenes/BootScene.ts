// First scene: reads startup flags, then hands off to the preloader.
import Phaser from 'phaser';
import { RegistryKeys, SceneKeys } from '../config/keys';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKeys.Boot });
  }

  create(): void {
    // `?debug` in the URL starts with the debug overlay on (handy on phones).
    const params = new URLSearchParams(window.location.search);
    this.registry.set(RegistryKeys.Debug, params.has('debug'));
    // `?calm` turns off hazards and predators.
    this.registry.set(RegistryKeys.Calm, params.has('calm'));
    // `?canvasTerrain` draws the terrain with the canvas fallback instead of the shader.
    this.registry.set(RegistryKeys.CanvasTerrain, params.has('canvasTerrain'));
    this.scene.start(SceneKeys.Preload);
  }
}
