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

// ---------------------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------------------

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
