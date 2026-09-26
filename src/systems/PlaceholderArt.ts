// Generates placeholder textures with Canvas 2D under the same keys as the final art.
// Real files listed in the asset manifest always win: a placeholder is only painted when
// no texture exists for that key after loading.
import Phaser from 'phaser';
import { TextureKeys, type TextureKey } from '../config/assets';
import { TAU } from '../utils/math';
import { createRng, randRange, type Rng } from '../utils/rng';

type Ctx = CanvasRenderingContext2D;

interface Painter {
  width: number;
  height: number;
  draw: (ctx: Ctx, w: number, h: number) => void;
}

const PAINTERS: Partial<Record<TextureKey, Painter>> = {
  [TextureKeys.Seal]: { width: 176, height: 88, draw: drawSeal },
  [TextureKeys.Minnow]: { width: 48, height: 26, draw: drawMinnow },
  [TextureKeys.Shrimp]: { width: 44, height: 32, draw: drawShrimp },
  [TextureKeys.Sardine]: { width: 60, height: 26, draw: drawSardine },
  [TextureKeys.Shark]: { width: 220, height: 104, draw: drawShark },
  [TextureKeys.Jellyfish]: { width: 60, height: 80, draw: drawJellyfish },
  [TextureKeys.Mine]: { width: 68, height: 68, draw: drawMine },
  [TextureKeys.Coin]: { width: 30, height: 30, draw: drawCoin },
  [TextureKeys.Spark]: { width: 24, height: 24, draw: drawSpark },
  [TextureKeys.Vignette]: { width: 256, height: 144, draw: drawVignette },
  [TextureKeys.Arrow]: { width: 56, height: 56, draw: drawArrow },
  [TextureKeys.Bubble]: { width: 32, height: 32, draw: drawBubble },
  [TextureKeys.Droplet]: { width: 16, height: 16, draw: drawDroplet },
  [TextureKeys.Ring]: { width: 128, height: 32, draw: drawRing },
  [TextureKeys.Glow]: { width: 256, height: 256, draw: drawGlow },
  [TextureKeys.LightRays]: { width: 1024, height: 640, draw: drawLightRays },
  [TextureKeys.Surface]: { width: 256, height: 64, draw: drawSurface },
  [TextureKeys.Clouds]: { width: 1024, height: 256, draw: drawClouds },
  [TextureKeys.SeabedFar]: { width: 1024, height: 480, draw: drawSeabedFar },
  [TextureKeys.SeabedNear]: { width: 1024, height: 420, draw: drawSeabedNear },
  [TextureKeys.SeabedGround]: { width: 1024, height: 200, draw: drawSeabedGround },
  [TextureKeys.MarineSnow]: { width: 512, height: 512, draw: drawMarineSnow },
};

/** Paints every placeholder whose key has no texture yet. Returns the generated keys. */
export function ensurePlaceholderTextures(scene: Phaser.Scene): string[] {
  const generated: string[] = [];
  for (const [key, painter] of Object.entries(PAINTERS) as Array<[TextureKey, Painter]>) {
    if (scene.textures.exists(key)) continue;
    const texture = scene.textures.createCanvas(key, painter.width, painter.height);
    if (!texture) continue;
    painter.draw(texture.context, painter.width, painter.height);
    texture.refresh();
    generated.push(key);
  }
  return generated;
}

// ---------------------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------------------

/** Chunky cartoon harbor seal facing right, drawn in a 160x80 design box. */
function drawSeal(ctx: Ctx): void {
  ctx.save();
  ctx.translate(8, 4);
  const outline = '#1f3244';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Hind flippers (behind the body).
  ctx.fillStyle = '#4d6b82';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(30, 40 + dir * 2);
    ctx.quadraticCurveTo(14, 40 + dir * 10, 2, 40 + dir * 22);
    ctx.quadraticCurveTo(8, 40 + dir * 8, 4, 40 + dir * 1);
    ctx.quadraticCurveTo(18, 40, 30, 40 + dir * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Body silhouette.
  const body = new Path2D();
  body.moveTo(157, 42);
  body.bezierCurveTo(157, 26, 146, 14, 128, 14);
  body.bezierCurveTo(104, 14, 64, 18, 40, 30);
  body.bezierCurveTo(30, 35, 24, 38, 22, 40);
  body.bezierCurveTo(24, 43, 30, 47, 42, 54);
  body.bezierCurveTo(64, 66, 104, 68, 128, 62);
  body.bezierCurveTo(146, 58, 157, 52, 157, 42);
  body.closePath();

  const bodyGrad = ctx.createLinearGradient(0, 12, 0, 68);
  bodyGrad.addColorStop(0, '#56778f');
  bodyGrad.addColorStop(0.55, '#7f9db3');
  bodyGrad.addColorStop(1, '#b9cbd8');
  ctx.fillStyle = bodyGrad;
  ctx.fill(body);

  // Belly highlight and back spots, clipped to the body.
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = 'rgba(232, 240, 246, 0.75)';
  ctx.beginPath();
  ctx.ellipse(94, 64, 58, 13, -0.03, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(52, 78, 99, 0.55)';
  const rng = createRng(7);
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.ellipse(
      randRange(rng, 48, 120),
      randRange(rng, 20, 36),
      randRange(rng, 2, 4.5),
      randRange(rng, 1.5, 3.5),
      randRange(rng, 0, Math.PI),
      0,
      TAU,
    );
    ctx.fill();
  }
  // Soft top rim light.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(60, 23);
  ctx.bezierCurveTo(90, 16, 120, 15, 140, 20);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = outline;
  ctx.lineWidth = 3.5;
  ctx.stroke(body);

  // Front flipper.
  ctx.save();
  ctx.translate(100, 60);
  ctx.rotate(0.55);
  ctx.fillStyle = '#5b7a91';
  ctx.beginPath();
  ctx.ellipse(-6, 0, 17, 7, 0, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // Cheek blush.
  ctx.fillStyle = 'rgba(255, 150, 160, 0.35)';
  ctx.beginPath();
  ctx.ellipse(139, 45, 7, 4.5, 0, 0, TAU);
  ctx.fill();

  // Eye.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(135, 30, 7, 8, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#111820';
  ctx.beginPath();
  ctx.ellipse(137, 31, 5.2, 6.2, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(139, 28.5, 2, 0, TAU);
  ctx.fill();

  // Nose and mouth.
  ctx.fillStyle = '#1a2530';
  ctx.beginPath();
  ctx.ellipse(154, 39, 4, 3, 0.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(152, 48);
  ctx.quadraticCurveTo(147, 52, 141, 50);
  ctx.stroke();

  // Whiskers.
  ctx.strokeStyle = 'rgba(30, 45, 58, 0.8)';
  ctx.lineWidth = 1.4;
  for (const [ty, ey] of [
    [43, 37],
    [45, 45],
    [47, 53],
  ]) {
    ctx.beginPath();
    ctx.moveTo(148, ty);
    ctx.quadraticCurveTo(158, (ty + ey) / 2, 166, ey);
    ctx.stroke();
  }
  ctx.restore();
}

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
