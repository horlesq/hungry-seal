// Endless-scrolling ocean backdrop: depth gradient, sky, parallax seabed, marine snow,
// light rays and the water line.
//
// Horizontal parallax: layers are pinned to the screen (scrollFactorX = 0) and scroll their
// tile texture instead, so they repeat forever. Vertical parallax uses scrollFactorY.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/layout';
import { FLOOR_COLOR, SKY_HORIZON_COLOR, WORLD, ZONES } from '../config/zones';

const GRADIENT_KEY = 'bg-depth-gradient';
/** Extra width beyond the screen so camera shake never reveals edges. */
const MARGIN = 80;
const LAYER_WIDTH = GAME_WIDTH + MARGIN * 2;
const MAX_SCROLL_Y = WORLD.height - GAME_HEIGHT;

interface SnowLayer {
  sprite: Phaser.GameObjects.TileSprite;
  factor: number;
  drift: number;
}

export class WorldBackground {
  private readonly clouds: Phaser.GameObjects.TileSprite;
  private readonly rays: Phaser.GameObjects.TileSprite;
  private readonly seabedFar: Phaser.GameObjects.TileSprite;
  private readonly seabedNear: Phaser.GameObjects.TileSprite;
  private readonly ground: Phaser.GameObjects.TileSprite;
  private readonly surfaceBack: Phaser.GameObjects.TileSprite;
  private readonly surfaceFront: Phaser.GameObjects.TileSprite;
  private readonly snow: SnowLayer[] = [];

  constructor(scene: Phaser.Scene) {
    const cx = GAME_WIDTH / 2;
    createGradientTexture(scene);

    // Depth gradient spanning the whole world height; fixed horizontally.
    scene.add
      .image(cx, 0, GRADIENT_KEY)
      .setOrigin(0.5, 0)
      .setDisplaySize(LAYER_WIDTH, WORLD.height)
      .setScrollFactor(0, 1)
      .setDepth(-100);

    // Sun and clouds.
    scene.add
      .image(GAME_WIDTH * 0.78, 150, TextureKeys.Glow)
      .setScale(1.3)
      .setScrollFactor(0, 1)
      .setDepth(-95);
    this.clouds = scene.add
      .tileSprite(cx, 40, LAYER_WIDTH, 256, TextureKeys.Clouds)
      .setOrigin(0.5, 0)
      .setScrollFactor(0, 1)
      .setDepth(-90);

    // Sun beams just under the water line.
    this.rays = scene.add
      .tileSprite(cx, WORLD.surfaceY, LAYER_WIDTH, 640, TextureKeys.LightRays)
      .setOrigin(0.5, 0)
      .setScrollFactor(0, 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.35)
      .setDepth(-80);

    // Seabed parallax: positioned so each layer's bottom sits at a chosen screen y when the
    // camera is at the very bottom of the world.
    this.seabedFar = this.seabedLayer(scene, TextureKeys.SeabedFar, 480, 0.35, GAME_HEIGHT - 150);
    this.seabedFar.setDepth(-70);
    this.seabedNear = this.seabedLayer(scene, TextureKeys.SeabedNear, 420, 0.65, GAME_HEIGHT - 90);
    this.seabedNear.setDepth(-50);
    this.ground = scene.add
      .tileSprite(cx, WORLD.floorY - 34, LAYER_WIDTH, 200, TextureKeys.SeabedGround)
      .setOrigin(0.5, 0)
      .setScrollFactor(0, 1)
      .setDepth(-40);

    // Marine snow: full-screen, clipped to below the water line in update().
    this.snow.push(this.snowLayer(scene, 0.45, 0.35, -60, 0.012));
    this.snow.push(this.snowLayer(scene, 0.85, 0.6, -30, 0.02));

    // Water line: a back strip behind everything underwater, and a translucent front strip
    // so the seal looks half-submerged when riding the surface.
    this.surfaceBack = scene.add
      .tileSprite(cx, WORLD.surfaceY - 20, LAYER_WIDTH, 64, TextureKeys.Surface)
      .setOrigin(0.5, 0)
      .setScrollFactor(0, 1)
      .setDepth(-85);
    this.surfaceFront = scene.add
      .tileSprite(cx, WORLD.surfaceY - 20, LAYER_WIDTH, 64, TextureKeys.Surface)
      .setOrigin(0.5, 0)
      .setScrollFactor(0, 1)
      .setAlpha(0.55)
      .setDepth(20);
  }

  update(time: number, camera: Phaser.Cameras.Scene2D.Camera): void {
    const sx = camera.scrollX;
    const sy = camera.scrollY;

    this.clouds.tilePositionX = sx * 0.12 + time * 0.006;
    this.rays.tilePositionX = sx * 0.4 + Math.sin(time * 0.00035) * 40;
    this.seabedFar.tilePositionX = sx * 0.35;
    this.seabedNear.tilePositionX = sx * 0.65;
    this.ground.tilePositionX = sx;
    this.surfaceBack.tilePositionX = sx * 0.9 + time * 0.02;
    this.surfaceFront.tilePositionX = sx - time * 0.03;

    // Screen y of the water line (clamped to the screen); snow only renders below it.
    const top = Phaser.Math.Clamp(WORLD.surfaceY + 6 - sy, 0, GAME_HEIGHT);
    const visibleHeight = GAME_HEIGHT - top;
    for (const layer of this.snow) {
      const s = layer.sprite;
      s.setVisible(visibleHeight > 0);
      if (visibleHeight <= 0) continue;
      if (s.y !== top || s.height !== visibleHeight) {
        s.y = top;
        s.setSize(LAYER_WIDTH, visibleHeight);
      }
      // Anchor the pattern to the camera (not the clipped top) so it doesn't slide.
      s.tilePositionX = sx * layer.factor + time * layer.drift;
      s.tilePositionY = sy * layer.factor + top - time * layer.drift * 0.5;
    }
  }

  private seabedLayer(
    scene: Phaser.Scene,
    key: string,
    height: number,
    factor: number,
    screenBottomAtFloor: number,
  ): Phaser.GameObjects.TileSprite {
    const worldBottom = screenBottomAtFloor + MAX_SCROLL_Y * factor;
    return scene.add
      .tileSprite(GAME_WIDTH / 2, worldBottom, LAYER_WIDTH, height, key)
      .setOrigin(0.5, 1)
      .setScrollFactor(0, factor);
  }

  private snowLayer(
    scene: Phaser.Scene,
    factor: number,
    alpha: number,
    depth: number,
    drift: number,
  ): SnowLayer {
    const sprite = scene.add
      .tileSprite(GAME_WIDTH / 2, 0, LAYER_WIDTH, GAME_HEIGHT, TextureKeys.MarineSnow)
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setAlpha(alpha)
      .setDepth(depth);
    return { sprite, factor, drift };
  }
}

/** Vertical gradient covering sky -> each zone -> seabed, built from the zone config. */
function createGradientTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(GRADIENT_KEY)) return;
  const height = 2048;
  const texture = scene.textures.createCanvas(GRADIENT_KEY, 4, height);
  if (!texture) return;
  const ctx = texture.context;
  const at = (y: number) => Phaser.Math.Clamp(y / WORLD.height, 0, 1);

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, ZONES[0].color);
  grad.addColorStop(at(WORLD.surfaceY), SKY_HORIZON_COLOR);
  // Hard edge at the water line: two stops at the same offset.
  for (const zone of ZONES.slice(1)) grad.addColorStop(at(zone.top), zone.color);
  grad.addColorStop(at(WORLD.floorY), FLOOR_COLOR);
  grad.addColorStop(1, FLOOR_COLOR);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, height);
  texture.refresh();
}
