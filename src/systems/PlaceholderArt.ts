// Generates placeholder textures with Canvas 2D under the same keys as the final art.
// Real files listed in the asset manifest always win: a placeholder is only painted when
// no texture exists for that key after loading.
//
// Painters draw in design units; sprites/effects are rasterized at 2x pixel density (stored
// as `texture.customData.resolution`, read back via `textureScale()`), so they stay sharp
// when the camera zooms in on big or high-DPI screens. Soft background layers stay at 1x.
import Phaser from 'phaser';
import { TextureKeys, type TextureKey } from '../config/assets';
import { SKINS } from '../config/skins';
import { TAU } from '../utils/math';
import { createRng, randRange, type Rng } from '../utils/rng';
import { drawPinniped, SEAL_ART, SEAL_STYLES } from './sealArt';

type Ctx = CanvasRenderingContext2D;

/** Pixel density for crisp art (sprites, effects, UI). */
const HI = 2;

interface Painter {
  width: number;
  height: number;
  draw: (ctx: Ctx, w: number, h: number) => void;
  /** Pixels per design unit (default 1). */
  res?: number;
}

const PAINTERS: Partial<Record<TextureKey, Painter>> = {
  [TextureKeys.Minnow]: { width: 48, height: 26, draw: drawMinnow, res: HI },
  [TextureKeys.Shrimp]: { width: 44, height: 32, draw: drawShrimp, res: HI },
  [TextureKeys.Sardine]: { width: 60, height: 26, draw: drawSardine, res: HI },
  [TextureKeys.Squid]: { width: 70, height: 36, draw: drawSquid, res: HI },
  [TextureKeys.Penguin]: { width: 60, height: 34, draw: drawPenguin, res: HI },
  [TextureKeys.Turtle]: { width: 86, height: 58, draw: drawTurtle, res: HI },
  [TextureKeys.Seabird]: { width: 72, height: 44, draw: drawSeabird, res: HI },
  [TextureKeys.Pufferfish]: { width: 40, height: 32, draw: drawPufferfish, res: HI },
  [TextureKeys.PufferfishPuffed]: {
    width: 40,
    height: 40,
    draw: drawPufferfishPuffed,
    res: HI,
  },
  [TextureKeys.Crab]: { width: 52, height: 36, draw: drawCrab, res: HI },
  [TextureKeys.Lanternfish]: { width: 38, height: 20, draw: drawLanternfish, res: HI },
  [TextureKeys.Darkness]: { width: 256, height: 256, draw: drawDarkness },
  [TextureKeys.Chest]: {
    width: 64,
    height: 52,
    draw: (c, w, h) => drawChest(c, w, h, false),
    res: HI,
  },
  [TextureKeys.ChestOpen]: {
    width: 64,
    height: 52,
    draw: (c, w, h) => drawChest(c, w, h, true),
    res: HI,
  },
  [TextureKeys.MagnetOrb]: { width: 40, height: 40, draw: drawMagnetOrb, res: HI },
  [TextureKeys.Shark]: { width: 220, height: 104, draw: drawShark, res: HI },
  [TextureKeys.Orca]: { width: 250, height: 120, draw: drawOrca, res: HI },
  [TextureKeys.Anglerfish]: { width: 130, height: 96, draw: drawAnglerfish, res: HI },
  [TextureKeys.Jellyfish]: { width: 60, height: 80, draw: drawJellyfish, res: HI },
  [TextureKeys.Mine]: { width: 68, height: 68, draw: drawMine, res: HI },
  [TextureKeys.Coin]: { width: 30, height: 30, draw: drawCoin, res: HI },
  [TextureKeys.Spark]: { width: 24, height: 24, draw: drawSpark, res: HI },
  [TextureKeys.Vignette]: { width: 256, height: 144, draw: drawVignette },
  [TextureKeys.Arrow]: { width: 56, height: 56, draw: drawArrow, res: HI },
  [TextureKeys.Bubble]: { width: 32, height: 32, draw: drawBubble, res: HI },
  [TextureKeys.Droplet]: { width: 16, height: 16, draw: drawDroplet, res: HI },
  [TextureKeys.Ring]: { width: 128, height: 32, draw: drawRing, res: HI },
  [TextureKeys.Glow]: { width: 256, height: 256, draw: drawGlow },
  [TextureKeys.LightRays]: { width: 1024, height: 640, draw: drawLightRays },
  [TextureKeys.Surface]: { width: 256, height: 64, draw: drawSurface, res: HI },
  [TextureKeys.Clouds]: { width: 1024, height: 256, draw: drawClouds },
  [TextureKeys.SeabedFar]: { width: 1024, height: 480, draw: drawSeabedFar },
  [TextureKeys.SeabedNear]: { width: 1024, height: 420, draw: drawSeabedNear },
  [TextureKeys.SeabedGround]: { width: 1024, height: 200, draw: drawSeabedGround },
  [TextureKeys.MarineSnow]: { width: 512, height: 512, draw: drawMarineSnow },
};

// One texture per seal skin, all from the same parameterized painter.
for (const skin of SKINS) {
  PAINTERS[skin.texture] = {
    width: SEAL_ART.width,
    height: SEAL_ART.height,
    draw: (ctx) => drawPinniped(ctx, SEAL_STYLES[skin.id]),
    res: HI,
  };
}

/** Paints every placeholder whose key has no texture yet. Returns the generated keys. */
export function ensurePlaceholderTextures(scene: Phaser.Scene): string[] {
  const generated: string[] = [];
  for (const [key, painter] of Object.entries(PAINTERS) as Array<[TextureKey, Painter]>) {
    if (scene.textures.exists(key)) continue;
    const res = painter.res ?? 1;
    const texture = scene.textures.createCanvas(key, painter.width * res, painter.height * res);
    if (!texture) continue;
    texture.context.save();
    texture.context.scale(res, res);
    painter.draw(texture.context, painter.width, painter.height);
    texture.context.restore();
    texture.refresh();
    (texture.customData as { resolution?: number }).resolution = res;
    generated.push(key);
  }
  return generated;
}

// ---------------------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------------------

interface FishStyle {
  back: string;
  belly: string;
  fin: string;
  outline: string;
  stripe?: string;
  spots?: string;
}

/** Simple cartoon fish facing right, filling the w x h box. */
function drawFish(ctx: Ctx, w: number, h: number, s: FishStyle): void {
  const cy = h / 2;
  const tailW = w * 0.24;
  const bodyL = tailW - 2;
  const bodyR = w - 2;
  const bodyH = h * 0.4;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2;
  ctx.strokeStyle = s.outline;

  // Tail fin.
  ctx.fillStyle = s.fin;
  ctx.beginPath();
  ctx.moveTo(tailW + 2, cy);
  ctx.lineTo(2, cy - h * 0.38);
  ctx.quadraticCurveTo(tailW * 0.45, cy, 2, cy + h * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Body.
  const body = new Path2D();
  body.moveTo(bodyL, cy);
  body.bezierCurveTo(bodyL + w * 0.2, cy - bodyH * 1.25, bodyR - w * 0.15, cy - bodyH, bodyR, cy);
  body.bezierCurveTo(bodyR - w * 0.15, cy + bodyH, bodyL + w * 0.2, cy + bodyH * 1.25, bodyL, cy);
  body.closePath();
  const grad = ctx.createLinearGradient(0, cy - bodyH, 0, cy + bodyH);
  grad.addColorStop(0, s.back);
  grad.addColorStop(0.55, s.back);
  grad.addColorStop(0.62, s.belly);
  grad.addColorStop(1, s.belly);
  ctx.fillStyle = grad;
  ctx.fill(body);

  ctx.save();
  ctx.clip(body);
  if (s.stripe) {
    ctx.fillStyle = s.stripe;
    ctx.fillRect(bodyL, cy - 1.5, bodyR - bodyL, 3);
  }
  if (s.spots) {
    ctx.fillStyle = s.spots;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(bodyL + w * 0.2 + i * w * 0.11, cy - bodyH * 0.35, 1.8, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.stroke(body);

  // Dorsal fin.
  ctx.fillStyle = s.fin;
  ctx.beginPath();
  ctx.moveTo(w * 0.42, cy - bodyH * 0.95);
  ctx.lineTo(w * 0.5, cy - bodyH * 1.6);
  ctx.lineTo(w * 0.62, cy - bodyH * 0.95);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Eye.
  const ex = bodyR - w * 0.14;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ex, cy - bodyH * 0.2, h * 0.13, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#10161c';
  ctx.beginPath();
  ctx.arc(ex + 0.8, cy - bodyH * 0.2, h * 0.08, 0, TAU);
  ctx.fill();
}

function drawMinnow(ctx: Ctx, w: number, h: number): void {
  drawFish(ctx, w, h, {
    back: '#7fb6d6',
    belly: '#e9f4fa',
    fin: '#f3b25c',
    outline: '#2b4658',
    stripe: 'rgba(255, 200, 120, 0.8)',
  });
}

function drawSardine(ctx: Ctx, w: number, h: number): void {
  drawFish(ctx, w, h, {
    back: '#3a6fa8',
    belly: '#dfe8f0',
    fin: '#8fb3cf',
    outline: '#1d3350',
    spots: '#1d3350',
  });
}

/** Curled pink shrimp facing right. */
function drawShrimp(ctx: Ctx, w: number, h: number): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const outline = '#8a3b3b';

  // Tail fan (left).
  ctx.fillStyle = '#f2a08a';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(10, h * 0.62);
  ctx.lineTo(2, h * 0.9);
  ctx.lineTo(9, h * 0.92);
  ctx.lineTo(14, h * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Curved segmented body.
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const x = 12 + t * (w - 22);
    const y = h * 0.7 - Math.sin(t * Math.PI * 0.85) * h * 0.32;
    const r = 4 + t * 3.2;
    ctx.fillStyle = i % 2 ? '#ff9f8a' : '#ffb7a3';
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.1, r, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  // Legs.
  ctx.strokeStyle = '#d06a5a';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) {
    const x = 18 + i * 5;
    ctx.beginPath();
    ctx.moveTo(x, h * 0.66);
    ctx.lineTo(x - 2, h * 0.9);
    ctx.stroke();
  }

  // Antennae and eye.
  ctx.strokeStyle = '#c0504a';
  ctx.beginPath();
  ctx.moveTo(w - 8, h * 0.28);
  ctx.quadraticCurveTo(w - 2, h * 0.02, w - 16, 2);
  ctx.moveTo(w - 8, h * 0.3);
  ctx.quadraticCurveTo(w, h * 0.12, w - 2, 1);
  ctx.stroke();
  ctx.fillStyle = '#10161c';
  ctx.beginPath();
  ctx.arc(w - 9, h * 0.3, 2.2, 0, TAU);
  ctx.fill();
}

/** Squid swimming mantle-first (pointed end to the right), tentacles trailing left. */
function drawSquid(ctx: Ctx, w: number, h: number): void {
  const cy = h / 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Tentacles.
  for (let i = 0; i < 5; i++) {
    const oy = (i - 2) * 3.2;
    ctx.strokeStyle = i % 2 ? '#d9607a' : '#ef8098';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(24, cy + oy);
    for (let x = 24; x >= 3; x -= 3) {
      ctx.lineTo(x, cy + oy * 1.6 + Math.sin(x * 0.35 + i) * 2.2);
    }
    ctx.stroke();
  }
  // Mantle.
  const mantle = new Path2D();
  mantle.moveTo(20, cy - 9);
  mantle.quadraticCurveTo(45, cy - 12, w - 4, cy);
  mantle.quadraticCurveTo(45, cy + 12, 20, cy + 9);
  mantle.quadraticCurveTo(16, cy, 20, cy - 9);
  mantle.closePath();
  const grad = ctx.createLinearGradient(0, cy - 12, 0, cy + 12);
  grad.addColorStop(0, '#ff9ab0');
  grad.addColorStop(1, '#e45a7a');
  ctx.fillStyle = grad;
  ctx.fill(mantle);
  ctx.strokeStyle = '#8a2440';
  ctx.lineWidth = 2;
  ctx.stroke(mantle);
  // Fins at the tip.
  ctx.fillStyle = '#f07892';
  ctx.beginPath();
  ctx.moveTo(w - 16, cy - 5);
  ctx.lineTo(w - 6, cy - 14);
  ctx.lineTo(w - 6, cy - 2);
  ctx.closePath();
  ctx.moveTo(w - 16, cy + 5);
  ctx.lineTo(w - 6, cy + 14);
  ctx.lineTo(w - 6, cy + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Spots and eye.
  ctx.fillStyle = 'rgba(160, 40, 70, 0.5)';
  for (const [x, y] of [
    [36, cy - 4],
    [46, cy + 3],
    [54, cy - 2],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(25, cy - 3, 4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#10161c';
  ctx.beginPath();
  ctx.arc(24.5, cy - 3, 2.3, 0, TAU);
  ctx.fill();
}

/** Penguin swimming to the right: black back, white belly, orange beak. */
function drawPenguin(ctx: Ctx, w: number, h: number): void {
  const cy = h / 2;
  ctx.lineJoin = 'round';
  const outline = '#0e1620';
  // Feet trailing behind.
  ctx.fillStyle = '#f29a2e';
  ctx.beginPath();
  ctx.ellipse(6, cy + 3, 6, 3, 0.3, 0, TAU);
  ctx.fill();
  // Body.
  const body = new Path2D();
  body.ellipse(w / 2 - 2, cy, w / 2 - 8, h / 2 - 4, 0, 0, TAU);
  ctx.fillStyle = '#1d2733';
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = '#f4f7fa';
  ctx.beginPath();
  ctx.ellipse(w / 2, cy + 7, w / 2 - 12, h / 2 - 9, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.stroke(body);
  // Flipper.
  ctx.fillStyle = '#26323f';
  ctx.beginPath();
  ctx.ellipse(w / 2 - 4, cy + 2, 11, 4, 0.35, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // Beak and eye.
  ctx.fillStyle = '#f29a2e';
  ctx.beginPath();
  ctx.moveTo(w - 8, cy - 4);
  ctx.lineTo(w - 1, cy - 1);
  ctx.lineTo(w - 8, cy + 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(w - 14, cy - 5, 3.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#10161c';
  ctx.beginPath();
  ctx.arc(w - 13.4, cy - 5, 1.8, 0, TAU);
  ctx.fill();
}

/** Sea turtle facing right: patterned shell, head and four flippers. */
function drawTurtle(ctx: Ctx, w: number, h: number): void {
  const cy = h / 2;
  const outline = '#1e3a22';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.5;
  ctx.fillStyle = '#7fbf6a';
  // Flippers (front big, back small).
  const flipper = (x: number, y: number, rx: number, ry: number, rot: number) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
    ctx.fill();
    ctx.stroke();
  };
  flipper(w * 0.62, cy - 16, 15, 6, -0.6);
  flipper(w * 0.62, cy + 16, 15, 6, 0.6);
  flipper(w * 0.24, cy - 13, 9, 4.5, 0.5);
  flipper(w * 0.24, cy + 13, 9, 4.5, -0.5);
  // Head.
  ctx.beginPath();
  ctx.ellipse(w - 12, cy, 10, 8, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#10161c';
  ctx.beginPath();
  ctx.arc(w - 9, cy - 3, 1.8, 0, TAU);
  ctx.fill();
  // Shell.
  const shell = new Path2D();
  shell.ellipse(w * 0.44, cy, w * 0.3, h * 0.36, 0, 0, TAU);
  const grad = ctx.createRadialGradient(w * 0.42, cy - 6, 2, w * 0.44, cy, w * 0.3);
  grad.addColorStop(0, '#a37a3d');
  grad.addColorStop(1, '#5f4520');
  ctx.fillStyle = grad;
  ctx.fill(shell);
  ctx.save();
  ctx.clip(shell);
  ctx.strokeStyle = 'rgba(255, 230, 170, 0.45)';
  ctx.lineWidth = 1.6;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(w * 0.44 + i * 10, cy, 6, 8, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.5;
  ctx.stroke(shell);
}

/** Seagull gliding to the right with wings up. */
function drawSeabird(ctx: Ctx, w: number, h: number): void {
  const cy = h * 0.62;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const outline = '#3a4652';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  // Far wing (behind the body).
  ctx.fillStyle = '#b9c4ce';
  ctx.beginPath();
  ctx.moveTo(w * 0.42, cy - 4);
  ctx.quadraticCurveTo(w * 0.3, 6, w * 0.08, 3);
  ctx.quadraticCurveTo(w * 0.3, 14, w * 0.52, cy - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Body.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, cy, w * 0.3, h * 0.16, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // Tail.
  ctx.beginPath();
  ctx.moveTo(w * 0.22, cy - 2);
  ctx.lineTo(w * 0.06, cy - 6);
  ctx.lineTo(w * 0.08, cy + 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Near wing with black tip.
  ctx.fillStyle = '#d6dde3';
  ctx.beginPath();
  ctx.moveTo(w * 0.46, cy - 3);
  ctx.quadraticCurveTo(w * 0.52, 2, w * 0.78, 2);
  ctx.quadraticCurveTo(w * 0.62, 12, w * 0.6, cy - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#20272e';
  ctx.beginPath();
  ctx.moveTo(w * 0.7, 4);
  ctx.quadraticCurveTo(w * 0.75, 2, w * 0.78, 2);
  ctx.quadraticCurveTo(w * 0.74, 7, w * 0.7, 8);
  ctx.closePath();
  ctx.fill();
  // Head, beak, eye.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(w * 0.8, cy - 3, 6.5, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f2a53a';
  ctx.beginPath();
  ctx.moveTo(w * 0.86, cy - 3);
  ctx.lineTo(w - 2, cy - 1);
  ctx.lineTo(w * 0.86, cy + 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#10161c';
  ctx.beginPath();
  ctx.arc(w * 0.82, cy - 5, 1.6, 0, TAU);
  ctx.fill();
}

/** Round yellow pufferfish facing right. */
function drawPufferfish(ctx: Ctx, w: number, h: number): void {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const outline = '#6a4a10';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  // Tail.
  ctx.fillStyle = '#f2b134';
  ctx.beginPath();
  ctx.moveTo(8, cy);
  ctx.lineTo(1, cy - 7);
  ctx.lineTo(1, cy + 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Body.
  const grad = ctx.createLinearGradient(0, 2, 0, h - 2);
  grad.addColorStop(0, '#f7c948');
  grad.addColorStop(1, '#fff0c2');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy, 14, 12, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(140, 90, 20, 0.55)';
  for (const [x, y] of [
    [cx - 4, cy - 5],
    [cx + 2, cy - 7],
    [cx - 1, cy - 1],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, TAU);
    ctx.fill();
  }
  // Eye.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx + 9, cy - 3, 3.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#10161c';
  ctx.beginPath();
  ctx.arc(cx + 9.6, cy - 3, 2, 0, TAU);
  ctx.fill();
}

/** The same pufferfish blown up into a spiky ball (displayed bigger too). */
function drawPufferfishPuffed(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const r = 13;
  ctx.lineJoin = 'round';
  // Spikes.
  ctx.fillStyle = '#c98a1c';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - 0.14) * r, cy + Math.sin(a - 0.14) * r);
    ctx.lineTo(cx + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6));
    ctx.lineTo(cx + Math.cos(a + 0.14) * r, cy + Math.sin(a + 0.14) * r);
    ctx.closePath();
    ctx.fill();
  }
  const grad = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, r);
  grad.addColorStop(0, '#fff3c8');
  grad.addColorStop(1, '#f2b134');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#6a4a10';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // Wide startled eyes and a tiny "o" mouth.
  for (const dx of [-4, 5]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx + dx, cy - 3, 3.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#10161c';
    ctx.beginPath();
    ctx.arc(cx + dx + 0.5, cy - 3, 1.6, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = '#6a4a10';
  ctx.beginPath();
  ctx.arc(cx + 1, cy + 5, 1.8, 0, TAU);
  ctx.stroke();
}

/** Red crab, claws up, seen from the side (drawn upright; the game flips it). */
function drawCrab(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const cy = h * 0.62;
  const outline = '#5a1410';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Legs.
  ctx.strokeStyle = '#b8342a';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    for (const s of [-1, 1]) {
      const x = cx + s * (6 + i * 5);
      ctx.beginPath();
      ctx.moveTo(x, cy + 4);
      ctx.lineTo(x + s * 5, cy + 9);
      ctx.lineTo(x + s * 6, h - 1);
      ctx.stroke();
    }
  }
  // Claws.
  ctx.fillStyle = '#e0473a';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * 10, cy - 4);
    ctx.lineTo(cx + s * 17, cy - 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + s * 19, cy - 15, 6, 5, s * 0.5, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5a1410';
    ctx.beginPath();
    ctx.moveTo(cx + s * 19, cy - 15);
    ctx.lineTo(cx + s * 25, cy - 20);
    ctx.lineTo(cx + s * 23, cy - 13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e0473a';
  }
  // Shell.
  const grad = ctx.createLinearGradient(0, cy - 10, 0, cy + 8);
  grad.addColorStop(0, '#f06a4f');
  grad.addColorStop(1, '#b8342a');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 14, 9, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // Eyes on stalks (facing right).
  ctx.strokeStyle = outline;
  for (const dx of [4, 9]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx, cy - 8);
    ctx.lineTo(cx + dx, cy - 14);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx + dx, cy - 15, 2.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#10161c';
    ctx.beginPath();
    ctx.arc(cx + dx + 0.6, cy - 15, 1.3, 0, TAU);
    ctx.fill();
  }
}

/** Small dark fish with glowing dots along its side. */
function drawLanternfish(ctx: Ctx, w: number, h: number): void {
  drawFish(ctx, w, h, {
    back: '#1c2c5a',
    belly: '#3d5a8c',
    fin: '#2a3f73',
    outline: '#0a1128',
  });
  ctx.fillStyle = '#a8fcff';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(w * 0.32 + i * w * 0.1, h * 0.62, 1.4, 0, TAU);
    ctx.fill();
  }
}

/** Treasure chest, closed or open with glinting gold inside. */
function drawChest(ctx: Ctx, w: number, h: number, open: boolean): void {
  const outline = '#3a2208';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.5;
  const bx = 6;
  const by = h * 0.45;
  const bw = w - 12;
  const bh = h - by - 3;
  if (open) {
    // Lid swung back, coins showing.
    ctx.fillStyle = '#8a5a26';
    ctx.beginPath();
    ctx.moveTo(bx + 4, by);
    ctx.lineTo(bx - 2, 4);
    ctx.lineTo(bx + bw + 2, 4);
    ctx.lineTo(bx + bw - 4, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd23c';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(bx + 8 + i * 8, by + 2 - (i % 2) * 3, 5, 0, TAU);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#9c6a30';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(w / 2, by - 22, bx + bw, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // Box with gold bands and lock.
  ctx.fillStyle = '#7a4a1c';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#e8b830';
  ctx.fillRect(bx + 8, by, 5, bh);
  ctx.fillRect(bx + bw - 13, by, 5, bh);
  ctx.fillRect(w / 2 - 5, by + 3, 10, 10);
  ctx.strokeRect(w / 2 - 5, by + 3, 10, 10);
}

/** Red horseshoe magnet inside a bubble. */
function drawMagnetOrb(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const bubble = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, w / 2);
  bubble.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
  bubble.addColorStop(1, 'rgba(160, 230, 255, 0.35)');
  ctx.fillStyle = bubble;
  ctx.beginPath();
  ctx.arc(cx, cy, w / 2 - 2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Magnet.
  ctx.lineCap = 'butt';
  ctx.strokeStyle = '#e8352b';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx, cy - 1, 8, Math.PI, 0);
  ctx.moveTo(cx - 8, cy - 1);
  ctx.lineTo(cx - 8, cy + 8);
  ctx.moveTo(cx + 8, cy - 1);
  ctx.lineTo(cx + 8, cy + 8);
  ctx.stroke();
  ctx.strokeStyle = '#e8eef4';
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy + 6);
  ctx.lineTo(cx - 8, cy + 10);
  ctx.moveTo(cx + 8, cy + 6);
  ctx.lineTo(cx + 8, cy + 10);
  ctx.stroke();
}

/** Soft-edged darkness with a clear circle in the middle (the seal's light). */
function drawDarkness(ctx: Ctx, w: number, h: number): void {
  const r = w / 2;
  const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r);
  // Displayed at 3600 world units: clear to ~110, fully dark by ~360 around the seal.
  grad.addColorStop(0, 'rgba(2, 4, 14, 0)');
  grad.addColorStop(0.06, 'rgba(2, 4, 14, 0)');
  grad.addColorStop(0.2, 'rgba(2, 4, 14, 1)');
  grad.addColorStop(1, 'rgba(2, 4, 14, 1)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

/** Orca facing right: black body, white belly and eye patch, tall dorsal fin. */
function drawOrca(ctx: Ctx, w: number, h: number): void {
  const cy = h * 0.55;
  const outline = '#0a0e12';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3;
  // Flukes.
  ctx.fillStyle = '#15191e';
  ctx.beginPath();
  ctx.moveTo(46, cy);
  ctx.quadraticCurveTo(22, cy - 12, 6, cy - 32);
  ctx.quadraticCurveTo(20, cy - 4, 18, cy + 2);
  ctx.quadraticCurveTo(20, cy + 8, 6, cy + 30);
  ctx.quadraticCurveTo(24, cy + 12, 46, cy + 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Dorsal fin.
  ctx.beginPath();
  ctx.moveTo(108, cy - 30);
  ctx.quadraticCurveTo(112, cy - 72, 126, cy - 76);
  ctx.quadraticCurveTo(124, cy - 46, 140, cy - 30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Body.
  const body = new Path2D();
  body.moveTo(42, cy);
  body.bezierCurveTo(80, cy - 40, 180, cy - 44, 226, cy - 16);
  body.quadraticCurveTo(w - 2, cy - 2, w - 6, cy + 8);
  body.bezierCurveTo(230, cy + 32, 160, cy + 42, 110, cy + 36);
  body.bezierCurveTo(76, cy + 30, 54, cy + 12, 42, cy);
  body.closePath();
  ctx.fillStyle = '#1b2026';
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  // White belly and eye patch.
  ctx.fillStyle = '#f2f5f8';
  ctx.beginPath();
  ctx.ellipse(165, cy + 30, 72, 18, -0.05, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(206, cy - 14, 15, 7, -0.25, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(200, 210, 220, 0.35)';
  ctx.beginPath();
  ctx.ellipse(118, cy - 20, 20, 7, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.stroke(body);
  // Pectoral fin.
  ctx.fillStyle = '#15191e';
  ctx.beginPath();
  ctx.ellipse(170, cy + 30, 20, 9, 0.6, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // Eye and grin.
  ctx.fillStyle = '#0a0e12';
  ctx.beginPath();
  ctx.arc(214, cy - 6, 3.2, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(w - 8, cy + 10);
  ctx.quadraticCurveTo(222, cy + 18, 200, cy + 12);
  ctx.stroke();
}

/** Anglerfish facing right: lumpy dark body, huge toothy mouth, lure on a stalk. */
function drawAnglerfish(ctx: Ctx, w: number, h: number): void {
  const cx = w * 0.46;
  const cy = h * 0.58;
  const outline = '#10060f';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Lure stalk.
  ctx.strokeStyle = '#5a3a55';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx + 20, cy - 32);
  ctx.quadraticCurveTo(cx + 30, 2, w - 10, 12);
  ctx.stroke();
  ctx.fillStyle = '#e8ffff';
  ctx.beginPath();
  ctx.arc(w - 9, 12, 5, 0, TAU);
  ctx.fill();
  // Tail.
  ctx.fillStyle = '#3d2438';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(22, cy);
  ctx.lineTo(4, cy - 18);
  ctx.lineTo(8, cy);
  ctx.lineTo(4, cy + 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Body.
  const body = new Path2D();
  body.ellipse(cx, cy, w * 0.36, h * 0.36, 0, 0, TAU);
  const grad = ctx.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, w * 0.38);
  grad.addColorStop(0, '#6a4462');
  grad.addColorStop(1, '#2a1627');
  ctx.fillStyle = grad;
  ctx.fill(body);
  ctx.stroke(body);
  // Mouth with teeth.
  ctx.fillStyle = '#12050f';
  ctx.beginPath();
  ctx.moveTo(w - 16, cy - 4);
  ctx.quadraticCurveTo(cx + 12, cy + 34, cx - 6, cy + 16);
  ctx.quadraticCurveTo(cx + 20, cy + 10, w - 16, cy - 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f4f0e6';
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x = cx + 2 + t * (w - 18 - cx - 2);
    const y = cy + 14 - t * 16;
    ctx.beginPath();
    ctx.moveTo(x - 2.5, y);
    ctx.lineTo(x, y + 7);
    ctx.lineTo(x + 2.5, y);
    ctx.closePath();
    ctx.fill();
  }
  // Small beady eye.
  ctx.fillStyle = '#d9f7ff';
  ctx.beginPath();
  ctx.arc(cx + 18, cy - 14, 5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#10060f';
  ctx.beginPath();
  ctx.arc(cx + 19, cy - 14, 2.5, 0, TAU);
  ctx.fill();
}

/** Cartoon shark facing right with a toothy grin. */
function drawShark(ctx: Ctx, _w: number, h: number): void {
  const outline = '#1c2a38';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3;
  const cy = h * 0.52;

  // Tail (crescent).
  ctx.fillStyle = '#5d7488';
  ctx.beginPath();
  ctx.moveTo(44, cy);
  ctx.quadraticCurveTo(22, cy - 20, 6, cy - 44);
  ctx.quadraticCurveTo(24, cy - 6, 18, cy);
  ctx.quadraticCurveTo(24, cy + 8, 10, cy + 34);
  ctx.quadraticCurveTo(28, cy + 16, 44, cy + 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Dorsal fin.
  ctx.beginPath();
  ctx.moveTo(96, cy - 26);
  ctx.quadraticCurveTo(104, cy - 52, 118, cy - 50);
  ctx.quadraticCurveTo(116, cy - 38, 128, cy - 26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Body.
  const body = new Path2D();
  body.moveTo(40, cy);
  body.bezierCurveTo(70, cy - 34, 150, cy - 36, 196, cy - 14);
  body.quadraticCurveTo(216, cy - 4, 214, cy + 4);
  body.bezierCurveTo(206, cy + 24, 150, cy + 34, 100, cy + 30);
  body.bezierCurveTo(70, cy + 26, 52, cy + 12, 40, cy);
  body.closePath();
  const grad = ctx.createLinearGradient(0, cy - 34, 0, cy + 32);
  grad.addColorStop(0, '#5a7186');
  grad.addColorStop(0.5, '#7e95a8');
  grad.addColorStop(0.56, '#e9eef2');
  grad.addColorStop(1, '#d6dee5');
  ctx.fillStyle = grad;
  ctx.fill(body);
  ctx.stroke(body);

  // Pectoral fin.
  ctx.fillStyle = '#5d7488';
  ctx.beginPath();
  ctx.moveTo(128, cy + 18);
  ctx.quadraticCurveTo(116, cy + 40, 100, cy + 48);
  ctx.quadraticCurveTo(122, cy + 42, 146, cy + 22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Gills.
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(150 + i * 7, cy - 10);
    ctx.quadraticCurveTo(146 + i * 7, cy, 150 + i * 7, cy + 10);
    ctx.stroke();
  }

  // Mouth with teeth.
  ctx.fillStyle = '#6b1f2a';
  ctx.beginPath();
  ctx.moveTo(210, cy + 8);
  ctx.quadraticCurveTo(190, cy + 26, 166, cy + 14);
  ctx.quadraticCurveTo(190, cy + 16, 210, cy + 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) {
    const x = 172 + i * 6.2;
    const y = cy + 14 - Math.sin((i / 5) * Math.PI) * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 3, y + 5);
    ctx.lineTo(x + 6, y);
    ctx.closePath();
    ctx.fill();
  }

  // Angry eye.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(186, cy - 10, 7, 6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#111820';
  ctx.beginPath();
  ctx.arc(188, cy - 9, 3.6, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(178, cy - 20);
  ctx.lineTo(195, cy - 14);
  ctx.stroke();
}

/** Translucent pink jellyfish: bell on top, wavy tentacles below. */
function drawJellyfish(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  ctx.lineCap = 'round';
  // Tentacles.
  for (let i = 0; i < 5; i++) {
    const x = cx - 16 + i * 8;
    ctx.strokeStyle = i % 2 ? 'rgba(255, 150, 210, 0.85)' : 'rgba(210, 130, 255, 0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, 34);
    for (let y = 34; y <= h - 4; y += 4) {
      ctx.lineTo(x + Math.sin(y * 0.22 + i) * 4, y);
    }
    ctx.stroke();
  }
  // Bell.
  const bell = new Path2D();
  bell.moveTo(4, 38);
  bell.bezierCurveTo(4, 4, w - 4, 4, w - 4, 38);
  bell.quadraticCurveTo(w * 0.75, 32, cx, 38);
  bell.quadraticCurveTo(w * 0.25, 32, 4, 38);
  bell.closePath();
  const grad = ctx.createRadialGradient(cx, 18, 2, cx, 22, w / 2);
  grad.addColorStop(0, 'rgba(255, 230, 250, 0.95)');
  grad.addColorStop(0.6, 'rgba(255, 140, 210, 0.85)');
  grad.addColorStop(1, 'rgba(190, 90, 220, 0.85)');
  ctx.fillStyle = grad;
  ctx.fill(bell);
  ctx.strokeStyle = 'rgba(120, 40, 140, 0.9)';
  ctx.lineWidth = 2.5;
  ctx.stroke(bell);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.ellipse(cx - 9, 16, 7, 4, -0.4, 0, TAU);
  ctx.fill();
}

/** Spiky naval mine with a red warning light. */
function drawMine(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const r = w * 0.3;
  ctx.fillStyle = '#2d3238';
  ctx.strokeStyle = '#111417';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(a);
    ctx.fillRect(0, -3, r * 0.55, 6);
    ctx.strokeRect(0, -3, r * 0.55, 6);
    ctx.beginPath();
    ctx.arc(r * 0.55, 0, 4, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  const grad = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, 2, cx, cy, r);
  grad.addColorStop(0, '#6b737c');
  grad.addColorStop(1, '#23272c');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.15, 5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 220, 210, 0.9)';
  ctx.beginPath();
  ctx.arc(cx - 1.5, cy - r * 0.15 - 1.5, 1.8, 0, TAU);
  ctx.fill();
}

function drawCoin(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const r = w / 2 - 2;
  ctx.fillStyle = '#b8860b';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  const grad = ctx.createRadialGradient(cx - 4, cy - 4, 1, cx, cy, r);
  grad.addColorStop(0, '#fff6b0');
  grad.addColorStop(0.5, '#ffd23c');
  grad.addColorStop(1, '#e0a010');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2.5, 0, TAU);
  ctx.fill();
  // Embossed star.
  ctx.fillStyle = 'rgba(184, 120, 10, 0.8)';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const rr = i % 2 === 0 ? r * 0.5 : r * 0.22;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------------------

/** Red edge glow, clear in the middle. Stretched over the whole screen. */
function drawVignette(ctx: Ctx, w: number, h: number): void {
  const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.62);
  grad.addColorStop(0, 'rgba(200, 0, 20, 0)');
  grad.addColorStop(0.6, 'rgba(200, 0, 20, 0.35)');
  grad.addColorStop(1, 'rgba(160, 0, 10, 0.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

/** Warning arrow pointing right (rotated toward off-screen threats). */
function drawArrow(ctx: Ctx, w: number, h: number): void {
  const cy = h / 2;
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#ff4d3d';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(w - 4, cy);
  ctx.lineTo(10, 6);
  ctx.lineTo(20, cy);
  ctx.lineTo(10, h - 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// ---------------------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------------------

/** Four-point star used for chomp bursts (tinted at runtime). */
function drawSpark(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2;
    const r = i % 2 === 0 ? w / 2 - 1 : w * 0.14;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

function drawBubble(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const r = w / 2 - 3;
  const fill = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
  fill.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
  fill.addColorStop(1, 'rgba(190, 245, 255, 0.4)');
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.28, r * 0.18, -0.6, 0, TAU);
  ctx.fill();
}

function drawDroplet(ctx: Ctx, w: number, h: number): void {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.55, 'rgba(210, 248, 255, 0.95)');
  g.addColorStop(1, 'rgba(160, 230, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawRing(ctx: Ctx, w: number, h: number): void {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w / 2 - 4, h / 2 - 4, 0, 0, TAU);
  ctx.stroke();
}

function drawGlow(ctx: Ctx, w: number, h: number): void {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255, 255, 240, 1)');
  g.addColorStop(0.18, 'rgba(255, 250, 210, 0.95)');
  g.addColorStop(0.4, 'rgba(255, 240, 180, 0.35)');
  g.addColorStop(1, 'rgba(255, 240, 180, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawLightRays(ctx: Ctx, w: number, h: number): void {
  const rng = createRng(21);
  for (let i = 0; i < 7; i++) {
    const x = randRange(rng, 0, w);
    const topW = randRange(rng, 30, 90);
    const botW = topW * randRange(rng, 2, 3.2);
    const skew = randRange(rng, 80, 180);
    const len = randRange(rng, h * 0.6, h);
    const alpha = randRange(rng, 0.25, 0.55);
    for (const ox of [-w, 0, w]) {
      const grad = ctx.createLinearGradient(0, 0, 0, len);
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x + ox, 0);
      ctx.lineTo(x + ox + topW, 0);
      ctx.lineTo(x + ox + skew + botW, len);
      ctx.lineTo(x + ox + skew, len);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** Water line strip: wave crest near the top, fading down. Tiles horizontally. */
function drawSurface(ctx: Ctx, w: number, h: number): void {
  const crest = (x: number) =>
    20 + 5 * Math.sin((TAU * 2 * x) / w) + 2 * Math.sin((TAU * 5 * x) / w + 1);
  const path = new Path2D();
  path.moveTo(0, h);
  for (let x = 0; x <= w; x += 2) path.lineTo(x, crest(x));
  path.lineTo(w, h);
  path.closePath();
  const grad = ctx.createLinearGradient(0, 12, 0, h);
  grad.addColorStop(0, 'rgba(210, 252, 255, 0.9)');
  grad.addColorStop(0.35, 'rgba(120, 225, 240, 0.35)');
  grad.addColorStop(1, 'rgba(90, 200, 230, 0)');
  ctx.fillStyle = grad;
  ctx.fill(path);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 2) {
    if (x === 0) ctx.moveTo(x, crest(x));
    else ctx.lineTo(x, crest(x));
  }
  ctx.stroke();
}

// ---------------------------------------------------------------------------------------
// Background layers (all tile horizontally)
// ---------------------------------------------------------------------------------------

function drawClouds(ctx: Ctx, w: number, h: number): void {
  const rng = createRng(3);
  for (let c = 0; c < 6; c++) {
    const cx = randRange(rng, 0, w);
    const cy = randRange(rng, 60, h - 70);
    const size = randRange(rng, 0.7, 1.3);
    const puffs = Array.from({ length: 6 }, () => ({
      dx: randRange(rng, -70, 70) * size,
      dy: randRange(rng, -18, 12) * size,
      r: randRange(rng, 22, 42) * size,
    }));
    for (const ox of [-w, 0, w]) {
      ctx.fillStyle = 'rgba(200, 225, 240, 0.9)';
      for (const p of puffs) {
        ctx.beginPath();
        ctx.arc(cx + ox + p.dx, cy + p.dy + 6, p.r, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      for (const p of puffs) {
        ctx.beginPath();
        ctx.arc(cx + ox + p.dx, cy + p.dy, p.r, 0, TAU);
        ctx.fill();
      }
    }
  }
}

/** Sum of sines with whole-number periods, so the curve tiles across `w`. */
function periodic(rng: Rng, w: number, terms: Array<[cycles: number, amp: number]>) {
  const phases = terms.map(() => randRange(rng, 0, TAU));
  return (x: number) =>
    terms.reduce((sum, [k, a], i) => sum + a * Math.sin((TAU * k * x) / w + phases[i]), 0);
}

function fillRidge(ctx: Ctx, w: number, h: number, height: (x: number) => number): void {
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) ctx.lineTo(x, height(x));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function drawSeabedFar(ctx: Ctx, w: number, h: number): void {
  const rng = createRng(11);
  const ridge = periodic(rng, w, [
    [2, 70],
    [5, 40],
    [13, 16],
  ]);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#2b3f78');
  grad.addColorStop(1, '#0a1030');
  ctx.fillStyle = grad;
  fillRidge(ctx, w, h, (x) => 190 + ridge(x));
}

function drawSeabedNear(ctx: Ctx, w: number, h: number): void {
  const rng = createRng(17);
  const ridge = periodic(rng, w, [
    [3, 45],
    [7, 22],
    [19, 8],
  ]);
  const ground = (x: number) => 290 + ridge(x);

  // Kelp behind the rocks.
  for (let i = 0; i < 16; i++) {
    const x = randRange(rng, 0, w);
    const height = randRange(rng, 140, 280);
    const width = randRange(rng, 8, 13);
    const sway = randRange(rng, 10, 26);
    const phase = randRange(rng, 0, TAU);
    for (const ox of [-w, 0, w]) {
      const baseX = x + ox;
      if (baseX < -40 || baseX > w + 40) continue;
      const baseY = ground(x) + 20;
      ctx.strokeStyle = '#15503a';
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      for (let t = 0; t <= 1; t += 0.05) {
        ctx.lineTo(baseX + Math.sin(t * 6 + phase) * sway * t, baseY - height * t);
      }
      ctx.stroke();
      ctx.fillStyle = '#1b6146';
      for (let t = 0.15; t < 1; t += 0.14) {
        const lx = baseX + Math.sin(t * 6 + phase) * sway * t;
        const ly = baseY - height * t;
        ctx.beginPath();
        ctx.ellipse(lx + 9, ly, 11, 4.5, -0.5, 0, TAU);
        ctx.ellipse(lx - 9, ly - 8, 11, 4.5, 0.5, 0, TAU);
        ctx.fill();
      }
    }
  }

  const grad = ctx.createLinearGradient(0, 200, 0, h);
  grad.addColorStop(0, '#1a2b52');
  grad.addColorStop(1, '#070d20');
  ctx.fillStyle = grad;
  fillRidge(ctx, w, h, ground);
}

function drawSeabedGround(ctx: Ctx, w: number, h: number): void {
  const rng = createRng(29);
  const ridge = periodic(rng, w, [
    [3, 8],
    [11, 4],
  ]);
  const top = (x: number) => 34 + ridge(x);

  const grad = ctx.createLinearGradient(0, 20, 0, h);
  grad.addColorStop(0, '#5a4c72');
  grad.addColorStop(0.3, '#342a47');
  grad.addColorStop(1, '#130f1c');
  ctx.fillStyle = grad;
  fillRidge(ctx, w, h, top);

  // Light sand crest.
  ctx.strokeStyle = 'rgba(190, 170, 220, 0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 4) {
    if (x === 0) ctx.moveTo(x, top(x));
    else ctx.lineTo(x, top(x));
  }
  ctx.stroke();

  // Rocks and pebbles along the top.
  for (let i = 0; i < 26; i++) {
    const x = randRange(rng, 0, w);
    const r = randRange(rng, 5, 22);
    const shade = Math.floor(randRange(rng, 40, 80));
    for (const ox of [-w, 0, w]) {
      const px = x + ox;
      if (px < -30 || px > w + 30) continue;
      ctx.fillStyle = `rgb(${shade}, ${shade - 8}, ${shade + 20})`;
      ctx.beginPath();
      ctx.ellipse(px, top(x) + r * 0.4, r * 1.3, r, 0, Math.PI, TAU);
      ctx.fill();
    }
  }
}

function drawMarineSnow(ctx: Ctx, w: number, h: number): void {
  const rng = createRng(5);
  for (let i = 0; i < 70; i++) {
    const x = randRange(rng, 0, w);
    const y = randRange(rng, 0, h);
    const r = randRange(rng, 0.8, 2.4);
    ctx.fillStyle = `rgba(230, 245, 255, ${randRange(rng, 0.25, 0.75)})`;
    for (const ox of [-w, 0, w]) {
      for (const oy of [-h, 0, h]) {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, r, 0, TAU);
        ctx.fill();
      }
    }
  }
}
