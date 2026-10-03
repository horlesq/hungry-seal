// GPU terrain: draws the map's rock in one shader pass over the view, from the baked
// distance field (uploaded as a texture) and the Blender material atlas
// (docs/ART_DIRECTION.md): tinted tile textures, a bevel lit from the top-left, sand / grass /
// snow caps on upward faces, ambient occlusion deep in the rock, depth fog and an ink edge.
// Water pixels exit after a single texture read. A second copy redraws a band around the
// water line above the front water layer so it never shows across islands.
import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { Depths } from '../config/depths';
import type { MapPalette } from '../config/maps';
import { WORLD } from '../config/zones';
import type { GameMap } from '../world/GameMap';
import { TERRAIN_CELL } from '../world/terrain';

/** Distances are packed into 8 bits over +-SDF_RANGE px (1 px steps). */
const SDF_RANGE = 128;
const WATERLINE_BAND = 70;
const MARGIN = 64;

/** Default material tiles: underwater body, land body, top caps, deep body. */
const DEFAULT_TILES: readonly [number, number, number, number] = [0, 1, 1, 0];

const FRAG = `
#pragma phaserTemplate(shaderName)
#pragma phaserTemplate(extensions)
#pragma phaserTemplate(features)
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
#pragma phaserTemplate(fragmentDefine)
varying vec2 outTexCoord;
#pragma phaserTemplate(outVariables)
#pragma phaserTemplate(fragmentHeader)
uniform sampler2D uSdf;
uniform sampler2D uMat;
uniform vec2 uOrigin;
uniform vec2 uSize;
uniform vec2 uGrid;
uniform float uCell;
uniform float uRange;
uniform float uSurface;
uniform float uWorldH;
uniform float uPx;
uniform vec2 uBand;
uniform vec3 uRim;
uniform vec3 uTop;
uniform vec3 uDeep;
uniform vec3 uInk;
uniform vec3 uLand;
uniform vec3 uLandCap;
uniform vec3 uCap;
uniform vec3 uFogTop;
uniform vec3 uFogDeep;
uniform vec4 uTiles;

// Phaser 4 uploads textures flipped (v = 1 is the image's top row), hence the 1 - y.
float sdf(vec2 p) {
  vec2 uv = (p / uCell + 0.5) / uGrid;
  uv.y = 1.0 - uv.y;
  return (texture2D(uSdf, uv).r * 2.0 - 1.0) * uRange;
}

vec3 tile(float idx, vec2 p, float scale) {
  vec2 t = fract(p / scale);
  vec2 cell = vec2(mod(idx, 2.0), floor(idx / 2.0));
  vec2 uv = (cell + 0.004 + t * 0.992) * 0.5;
  return texture2D(uMat, vec2(uv.x, 1.0 - uv.y)).rgb;
}

void main () {
  vec2 p = uOrigin + outTexCoord * uSize;
  if (p.y < uBand.x || p.y > uBand.y) discard;
  float d = sdf(p);
  if (d > uPx * 1.5) discard;

  float e = 6.0;
  vec2 g = vec2(sdf(p + vec2(e, 0.0)) - sdf(p - vec2(e, 0.0)),
                sdf(p + vec2(0.0, e)) - sdf(p - vec2(0.0, e)));
  vec2 n = g / max(length(g), 0.0001);
  float inside = max(-d, 0.0);
  float depthK = clamp((p.y - uSurface) / (uWorldH - uSurface), 0.0, 1.0);

  // Body: tinted material tiles (rock or coral up top, darker rock deep down; land above).
  vec3 tex = mix(tile(uTiles.x, p, 300.0), tile(uTiles.w, p, 300.0), smoothstep(0.35, 0.8, depthK));
  // Land material reaches a wavy line a little below the water line (wet sand, strata).
  float shore = uSurface + 40.0 + 24.0 * sin(p.x / 97.0) + 12.0 * sin(p.x / 37.0 + 1.3) + 30.0 * (tex.r - 0.5);
  float above = 1.0 - smoothstep(shore - 12.0, shore + 12.0, p.y);
  vec3 body = mix(uTop, uDeep, depthK) * tex;
  vec3 land = uLand * tile(uTiles.y, p, 300.0);
  vec3 col = mix(body, land, above);

  // Caps on upward faces near the edge: sand under water, grass / snow / sand on land. The
  // lower edge wanders with the body texture so it reads as a drift, not a stripe.
  vec3 capTex = tile(uTiles.z, p, 220.0);
  float capW = 18.0 + 22.0 * tex.r;
  float up = smoothstep(0.25, 0.7, -n.y) * (1.0 - smoothstep(capW, capW + 6.0, inside));
  vec3 cap = mix(uCap * mix(1.0, 0.55, depthK), uLandCap, above) * capTex;
  col = mix(col, cap, up);

  // Bevel: the surface tilts outward near the edge, lit from the top-left-front.
  float bevel = 1.0 - smoothstep(0.0, 36.0, inside);
  vec3 N = normalize(vec3(n * bevel * 1.7, 1.0));
  vec3 L = normalize(vec3(-0.5, -0.8, 0.6));
  col *= 0.48 + 0.78 * clamp(dot(N, L), 0.0, 1.0);
  // A bright rim along the very edge of top faces.
  col += uRim * 0.3 * smoothstep(0.2, 0.9, -n.y) * (1.0 - smoothstep(3.0, 10.0, inside));
  // Ambient occlusion: deep inside the rock recedes.
  col *= mix(1.0, 0.45, smoothstep(30.0, 120.0, inside));
  // Depth fog toward the water around it.
  col = mix(col, mix(uFogTop, uFogDeep, depthK), (1.0 - above) * depthK * 0.5);
  // Ink edge, anti-aliased against the water.
  float ink = 1.0 - smoothstep(3.0, 3.0 + uPx * 1.5, inside);
  col = mix(col, uInk, ink);
  float a = 1.0 - smoothstep(-uPx, uPx, d);
  // The water-line copy fades out downward so it meets the tinted rock under the water softly.
  if (uBand.y < 1e8) a *= 1.0 - smoothstep(uSurface + 10.0, uBand.y, p.y);
  gl_FragColor = vec4(col * a, a);
}
`;

function rgb(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Lighter version of a colour (the material tiles are mid-gray, so tints need headroom). */
function lift(c: number[], k: number): number[] {
  return c.map((v) => Math.min(1.6, v * k));
}

export class TerrainShader {
  private readonly main: Phaser.GameObjects.Shader;
  private readonly overWater: Phaser.GameObjects.Shader;
  private readonly uniforms: Record<string, number | number[]>;
  private px = 1;
  private origin = [0, 0];
  private size = [1, 1];

  constructor(scene: Phaser.Scene, map: GameMap) {
    const sdfKey = uploadSdf(scene, map);
    const p: MapPalette = map.def.palette;
    const field = map.terrain;
    this.uniforms = {
      uSdf: 0,
      uMat: 1,
      uGrid: [field.cols, field.rows],
      uCell: TERRAIN_CELL,
      uRange: SDF_RANGE,
      uSurface: WORLD.surfaceY,
      uWorldH: WORLD.height,
      uRim: rgb(p.rockRim),
      uTop: lift(rgb(p.rockTop), 1.2),
      uDeep: lift(rgb(p.rockDeep), 1.3),
      uInk: rgb(p.outline),
      uLand: lift(rgb(p.land), 1.15),
      uLandCap: lift(rgb(p.landRim), 1.1),
      uCap: lift(rgb(p.rockRim), 1.4),
      uFogTop: rgb(p.water.ocean),
      uFogDeep: rgb(p.water.abyss),
      uTiles: [...(p.tiles ?? DEFAULT_TILES)],
    };
    const make = (band: [number, number], depth: number) => {
      const shader = scene.add
        .shader(
          {
            name: 'terrain',
            fragmentSource: FRAG,
            setupUniforms: (set: (name: string, value: unknown) => void) => {
              for (const [k, v] of Object.entries(this.uniforms)) set(k, v);
              set('uBand', band);
              set('uOrigin', this.origin);
              set('uSize', this.size);
              set('uPx', this.px);
            },
          },
          0,
          0,
          2,
          2,
          [sdfKey, TextureKeys.TerrainMaterials],
        )
        .setOrigin(0, 0)
        .setDepth(depth);
      // v = 0 at the top of the quad, so world = origin + uv * size.
      shader.setTextureCoordinates(0, 0, 1, 0, 0, 1, 1, 1);
      return shader;
    };
    this.main = make([-1e9, 1e9], Depths.Terrain);
    this.overWater = make(
      [WORLD.surfaceY - WATERLINE_BAND, WORLD.surfaceY + WATERLINE_BAND],
      Depths.TerrainOverWater,
    );
  }

  update(camera: Phaser.Cameras.Scene2D.Camera): void {
    const v = camera.worldView;
    const x = v.x - MARGIN;
    const y = v.y - MARGIN;
    const w = v.width + MARGIN * 2;
    const h = v.height + MARGIN * 2;
    this.origin = [x, y];
    this.size = [w, h];
    this.px = 1 / camera.zoom;
    for (const s of [this.main, this.overWater]) s.setPosition(x, y).setSize(w, h);
    // The water-line copy only matters when the band is in view.
    this.overWater.setVisible(v.y < WORLD.surfaceY + WATERLINE_BAND && v.bottom > WORLD.surfaceY - WATERLINE_BAND);
  }

  destroy(): void {
    this.main.destroy();
    this.overWater.destroy();
  }
}

/** The map's distance field as a grayscale texture (one texel per grid node). */
function uploadSdf(scene: Phaser.Scene, map: GameMap): string {
  const key = `terrain-sdf-${map.id}`;
  if (scene.textures.exists(key)) return key;
  const f = map.terrain;
  const tex = scene.textures.createCanvas(key, f.cols, f.rows);
  if (!tex) return key;
  const img = tex.context.createImageData(f.cols, f.rows);
  const data = f.data;
  for (let i = 0; i < data.length; i++) {
    const v = Math.round(Math.min(1, Math.max(0, (data[i] / SDF_RANGE) * 0.5 + 0.5)) * 255);
    const j = i * 4;
    img.data[j] = v;
    img.data[j + 1] = v;
    img.data[j + 2] = v;
    img.data[j + 3] = 255;
  }
  tex.context.putImageData(img, 0, 0);
  tex.refresh();
  return key;
}
