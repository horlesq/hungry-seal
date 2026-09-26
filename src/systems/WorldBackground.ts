// Endless-scrolling ocean backdrop: depth gradient, sky, parallax seabed, marine snow,
// light rays and the water line.
//
// Every layer lives in world space and is re-positioned each frame from the camera's
// worldView, so it works at any zoom/aspect ratio. Horizontal parallax: the layer stays over
// the view and scrolls its tile texture by `view.x * factor`, so it repeats forever.
// Vertical parallax (seabed ridges) is computed from how far the view is from the bottom.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { textureScale } from '../services/Viewport';
import { FLOOR_COLOR, SKY_HORIZON_COLOR, WORLD, ZONES } from '../config/zones';

const GRADIENT_KEY = 'bg-depth-gradient';
/** Extra size around the view so camera shake and one-frame lag never reveal edges. */
const MARGIN = 120;

interface TileLayer {
  sprite: Phaser.GameObjects.TileSprite;
  /** Horizontal parallax factor (1 = moves with the world). */
  factor: number;
  /** Extra horizontal drift in tile px per ms. */
  drift: number;
  /** Texture scale (1 / pixel density). */
  ts: number;
}

interface SeabedLayer extends TileLayer {
  /** Vertical parallax factor. */
  vFactor: number;
  /** Where the layer's bottom sits (px from the view top) when the view is at the seabed. */
  bottomAtFloor: number;
}

interface SnowLayer extends TileLayer {
  driftY: number;
}

export class WorldBackground {
  private readonly gradient: Phaser.GameObjects.Image;
  private readonly sun: Phaser.GameObjects.Image;
  private readonly flat: TileLayer[] = [];
  private readonly seabed: SeabedLayer[] = [];
  private readonly snow: SnowLayer[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    createGradientTexture(scene);

    this.gradient = scene.add.image(0, 0, GRADIENT_KEY).setOrigin(0.5, 0).setDepth(-100);
    this.sun = scene.add
      .image(0, 150, TextureKeys.Glow)
      .setScale(1.3 * textureScale(scene, TextureKeys.Glow))
      .setDepth(-95);

    // World-anchored strips (y fixed in the world).
    this.addFlat(TextureKeys.Clouds, 40, 256, 0.12, 0.006, -90);
    this.addFlat(TextureKeys.LightRays, WORLD.surfaceY, 640, 0.4, 0, -80)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.35);
    this.addFlat(TextureKeys.Surface, WORLD.surfaceY - 20, 64, 0.9, 0.02, -85);
    this.addFlat(TextureKeys.SeabedGround, WORLD.floorY - 34, 200, 1, 0, -40);
    // Front water line: translucent so the seal looks half-submerged riding the surface.
    this.addFlat(TextureKeys.Surface, WORLD.surfaceY - 20, 64, 1, -0.03, 20).setAlpha(0.55);

    // Seabed ridges with vertical parallax.
    this.addSeabed(TextureKeys.SeabedFar, 480, 0.35, 150, -70);
    this.addSeabed(TextureKeys.SeabedNear, 420, 0.65, 90, -50);

    // Marine snow: covers the view, clipped to below the water line.
    this.addSnow(0.45, 0.35, -60, 0.012);
    this.addSnow(0.85, 0.6, -30, 0.02);
  }

  update(time: number, camera: Phaser.Cameras.Scene2D.Camera): void {
    const v = camera.worldView;
    const cx = v.centerX;
    const width = v.width + MARGIN * 2;

    this.gradient.setPosition(cx, 0).setDisplaySize(width, WORLD.height);
    this.sun.setPosition(v.x + v.width * 0.78, 150);

    for (const layer of this.flat) {
      this.fitWidth(layer.sprite, width, layer.sprite.height);
      layer.sprite.x = cx;
      layer.sprite.tilePositionX = (v.x * layer.factor + time * layer.drift) / layer.ts;
    }

    // Seabed ridges: at the very bottom of the world each layer's bottom sits at
    // `bottomAtFloor` from the view top; higher up, they sink at (1 - vFactor) speed.
    const maxViewY = WORLD.height - v.height;
    for (const layer of this.seabed) {
      const s = layer.sprite;
      this.fitWidth(s, width, s.height);
      s.x = cx;
      s.y = v.y + v.height - layer.bottomAtFloor + (maxViewY - v.y) * layer.vFactor;
      s.tilePositionX = (v.x * layer.factor) / layer.ts;
    }

    // Snow only below the water line: its top follows the view but stops at the surface.
    const top = Math.max(v.y - MARGIN, WORLD.surfaceY + 6);
    const height = v.bottom + MARGIN - top;
    for (const layer of this.snow) {
      const s = layer.sprite;
      s.setVisible(height > 0);
      if (height <= 0) continue;
      this.fitWidth(s, width, height);
      s.setPosition(cx, top);
      // Anchor the pattern to the camera (not the clipped top) so it doesn't slide.
      s.tilePositionX = (v.x * layer.factor + time * layer.drift) / layer.ts;
      s.tilePositionY = (v.y * layer.factor + (top - v.y) - time * layer.driftY) / layer.ts;
    }
  }

  private fitWidth(sprite: Phaser.GameObjects.TileSprite, width: number, height: number): void {
    if (Math.abs(sprite.width - width) > 0.5 || Math.abs(sprite.height - height) > 0.5) {
      sprite.setSize(width, height);
    }
  }

  private tile(key: string, y: number, height: number, depth: number) {
    const ts = textureScale(this.scene, key);
    const sprite = this.scene.add
      .tileSprite(0, y, 100, height, key)
      .setOrigin(0.5, 0)
      .setTileScale(ts, ts)
      .setDepth(depth);
    return { sprite, ts };
  }

  private addFlat(
    key: string,
    y: number,
    height: number,
    factor: number,
    drift: number,
    depth: number,
  ): Phaser.GameObjects.TileSprite {
    const { sprite, ts } = this.tile(key, y, height, depth);
    this.flat.push({ sprite, factor, drift, ts });
    return sprite;
  }

  private addSeabed(
    key: string,
    height: number,
    vFactor: number,
    bottomAtFloor: number,
    depth: number,
  ): void {
    const { sprite, ts } = this.tile(key, 0, height, depth);
    sprite.setOrigin(0.5, 1);
    this.seabed.push({ sprite, factor: vFactor, drift: 0, ts, vFactor, bottomAtFloor });
  }

  private addSnow(factor: number, alpha: number, depth: number, drift: number): void {
    const { sprite, ts } = this.tile(TextureKeys.MarineSnow, 0, 100, depth);
    sprite.setAlpha(alpha);
    this.snow.push({ sprite, factor, drift, driftY: drift * 0.5, ts });
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
