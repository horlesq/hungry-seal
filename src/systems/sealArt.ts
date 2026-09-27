// Seal skin art: one parameterized cartoon pinniped painter (Canvas 2D), facing right in the
// seal's 176x88 design box. What makes it read as a seal rather than a fish: a plump body
// with a thick rounded tail end, a round head with a whisker-pad muzzle and a dark nose,
// big dark eyes, and paddle flippers with webbed digits (front ones with claws), instead of
// a tapered body and a forked tail.
//
// The mouth sits near x = 150-165 so the Seal entity's mouth circle (FEEDING.mouthOffset
// from the centre) lands on the muzzle for every skin.
import type { SkinId } from '../config/skins';
import { TAU } from '../utils/math';
import { createRng, randRange } from '../utils/rng';

type Ctx = CanvasRenderingContext2D;

export const SEAL_ART = { width: 176, height: 88 } as const;

export interface PinnipedStyle {
  back: string;
  belly: string;
  /** Whisker pad / snout. */
  muzzle: string;
  flipper: string;
  outline: string;
  spots?: { color: string; count: number; size: [number, number]; belly?: boolean; seed: number };
  /** Head circle (default centre 134,38, radius 21). */
  head?: { x: number; y: number; r: number };
  /** Snout ellipse relative to the head centre (default dx 20, dy 7, rx 12, ry 9.5). */
  snout?: { dx: number; dy: number; rx: number; ry: number };
  /** Back line height and belly depth (default 16 and 70). */
  body?: { top: number; bottom: number };
  eyeSize?: number;
  blush?: boolean;
  /** Sea lions: long wing-like front flippers, no claws. */
  longFrontFlipper?: boolean;
  earFlap?: boolean;
  /** Fluffy fur tufts along the outline (pups). */
  fluffy?: boolean;
  lei?: boolean;
  tusks?: boolean;
  /** Bristly walrus moustache instead of fine whiskers. */
  moustache?: boolean;
  /** Elephant seal's drooping nose. */
  proboscis?: boolean;
  wrinkles?: boolean;
  /** Mouth line running far back (leopard seal grin). */
  longMouth?: boolean;
}

export const SEAL_STYLES: Record<SkinId, PinnipedStyle> = {
  harbor: {
    back: '#5d7d95',
    belly: '#d3e0e9',
    muzzle: '#b3c4d1',
    flipper: '#52708a',
    outline: '#1f3244',
    spots: { color: 'rgba(36, 58, 76, 0.55)', count: 12, size: [2, 4.5], seed: 7 },
    blush: true,
  },
  arctic: {
    back: '#e2ebf2',
    belly: '#ffffff',
    muzzle: '#ffffff',
    flipper: '#cfdce6',
    outline: '#2b3d4f',
    fluffy: true,
    eyeSize: 7.5,
    blush: true,
  },
  sealion: {
    back: '#8e5b33',
    belly: '#cc9e6b',
    muzzle: '#a9774b',
    flipper: '#6f4526',
    outline: '#3a2414',
    head: { x: 137, y: 31, r: 18 },
    snout: { dx: 18, dy: 5, rx: 13.5, ry: 7.5 },
    body: { top: 20, bottom: 69 },
    longFrontFlipper: true,
    earFlap: true,
  },
  tropical: {
    back: '#6f6c63',
    belly: '#dccfb5',
    muzzle: '#bcb09a',
    flipper: '#5c5951',
    outline: '#2c2a26',
    lei: true,
    blush: true,
  },
  leopard: {
    back: '#58626c',
    belly: '#cdd2d6',
    muzzle: '#9ea7af',
    flipper: '#4c555e',
    outline: '#1e242a',
    spots: { color: 'rgba(28, 34, 40, 0.7)', count: 18, size: [1.8, 3.8], belly: true, seed: 11 },
    head: { x: 134, y: 37, r: 22 },
    snout: { dx: 21, dy: 6, rx: 16, ry: 9 },
    longMouth: true,
  },
  walrus: {
    back: '#a8735a',
    belly: '#dcae90',
    muzzle: '#e4bc9e',
    flipper: '#8d5c46',
    outline: '#3b2418',
    head: { x: 131, y: 39, r: 23 },
    snout: { dx: 19, dy: 8, rx: 15, ry: 12 },
    body: { top: 12, bottom: 75 },
    eyeSize: 4,
    tusks: true,
    moustache: true,
    wrinkles: true,
  },
  elephant: {
    back: '#74665a',
    belly: '#b4a08a',
    muzzle: '#8f7d6c',
    flipper: '#61554a',
    outline: '#2d241d',
    head: { x: 133, y: 38, r: 22 },
    eyeSize: 5,
    proboscis: true,
    wrinkles: true,
  },
};

function circle(x: number, y: number, r: number): Path2D {
  const p = new Path2D();
  p.arc(x, y, r, 0, TAU);
  return p;
}

function ellipse(x: number, y: number, rx: number, ry: number): Path2D {
  const p = new Path2D();
  p.ellipse(x, y, rx, ry, 0, 0, TAU);
  return p;
}

type Pt = [number, number];

function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

/** Paints a pinniped in the given style, facing right, in the 176x88 box. */
export function drawPinniped(ctx: Ctx, s: PinnipedStyle): void {
  const hd = { x: 134, y: 38, r: 21, ...s.head };
  const sn = { dx: 20, dy: 7, rx: 12, ry: 9.5, ...s.snout };
  const mx = hd.x + sn.dx;
  const my = hd.y + sn.dy;
  const top = s.body?.top ?? 16;
  const bottom = s.body?.bottom ?? 70;
  const line = 3.2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Body: thick rounded tail end on the left, back up to the head, chest down under it,
  // then a blubbery belly back to the tail. Clockwise, like the head and snout, so a
  // combined path clips as their union.
  const tail: Pt = [32, 37];
  const backCtl: [Pt, Pt, Pt] = [
    [52, top + 8],
    [92, top - 2],
    [hd.x - 14, hd.y - hd.r + 7],
  ];
  const bellyStart: Pt = [hd.x + 6, hd.y + hd.r - 4];
  const bellyCtl: [Pt, Pt, Pt] = [
    [hd.x - 4, bottom - 2],
    [96, bottom + 2],
    [62, bottom - 6],
  ];
  const body = new Path2D();
  body.moveTo(...tail);
  body.bezierCurveTo(...backCtl[0], ...backCtl[1], ...backCtl[2]);
  body.bezierCurveTo(hd.x - 4, hd.y - hd.r + 8, hd.x + 10, hd.y + 4, ...bellyStart);
  body.bezierCurveTo(...bellyCtl[0], ...bellyCtl[1], ...bellyCtl[2]);
  body.bezierCurveTo(46, bottom - 12, 32, 54, ...tail);
  body.closePath();

  const parts = [body, circle(hd.x, hd.y, hd.r), ellipse(mx, my, sn.rx, sn.ry)];
  if (s.fluffy) {
    // Fur tufts along the back, the belly and the top of the head.
    for (let t = 0.06; t < 0.98; t += 0.1) {
      const [x, y] = bezier(tail, ...backCtl, t);
      parts.push(circle(x, y + 1, 4.6));
    }
    for (let t = 0.1; t < 0.95; t += 0.12) {
      const [x, y] = bezier(bellyStart, ...bellyCtl, t);
      parts.push(circle(x, y - 1, 4.2));
    }
    for (let a = -2.7; a < -0.6; a += 0.42) {
      parts.push(circle(hd.x + Math.cos(a) * hd.r, hd.y + Math.sin(a) * hd.r, 4.4));
    }
  }
  const silhouette = new Path2D();
  for (const p of parts) silhouette.addPath(p);

  // Far hind flipper, behind the body.
  drawFlipper(ctx, s, 37, 39, 0.14, 1, true, 'hind');

  // Silhouette: strokes first, then fills on top, so only the outer outline shows.
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = line * 2;
  for (const p of parts) ctx.stroke(p);
  const shade = ctx.createLinearGradient(0, top, 0, bottom);
  shade.addColorStop(0, s.back);
  shade.addColorStop(0.42, s.back);
  shade.addColorStop(0.85, s.belly);
  shade.addColorStop(1, s.belly);
  ctx.fillStyle = shade;
  for (const p of parts) ctx.fill(p);

  ctx.save();
  ctx.clip(silhouette);
  // Whisker pad and a soft line where the snout meets the head.
  ctx.fillStyle = s.muzzle;
  ctx.fill(ellipse(mx, my, sn.rx, sn.ry));
  ctx.strokeStyle = s.outline;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(mx, my, sn.rx, sn.ry, 0, Math.PI * 0.62, Math.PI * 1.45);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (s.spots) drawSpots(ctx, s.spots, top, bottom);
  // Rim light along the back.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(58, top + 9);
  ctx.bezierCurveTo(84, top + 1, 108, top, hd.x - 12, hd.y - hd.r + 6);
  ctx.stroke();
  if (s.wrinkles) {
    ctx.strokeStyle = s.outline;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(hd.x - 20 - i * 6, hd.y + 6, 12 + i * 2, -0.9, 0.7);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Near flippers on top of the body.
  drawFlipper(ctx, s, 40, 46, -0.1, 1, false, 'hind');
  const front = s.longFrontFlipper ? 1.45 : 1;
  drawFlipper(ctx, s, hd.x - 20, hd.y + hd.r - 3, -1.05, front, false, 'front');

  if (s.lei) drawLei(ctx, hd);
  drawFace(ctx, s, hd, { x: mx, y: my, rx: sn.rx, ry: sn.ry });
}

/**
 * A paddle flipper with webbed digits, pointing back (left) and rotated by `angle`
 * (positive = up). Hind flippers get a scalloped trailing edge; front ones get claws.
 */
function drawFlipper(
  ctx: Ctx,
  s: PinnipedStyle,
  x: number,
  y: number,
  angle: number,
  length: number,
  far: boolean,
  kind: 'hind' | 'front',
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(kind === 'front' ? 0.72 * length : 1, kind === 'front' ? 0.72 : 1);
  const p = new Path2D();
  p.moveTo(2, -6);
  p.bezierCurveTo(-8, -7, -18, -10, -27, -9);
  if (kind === 'hind' || !s.longFrontFlipper) {
    p.quadraticCurveTo(-33, -6, -29, -3);
    p.quadraticCurveTo(-34, 0, -29, 3);
    p.quadraticCurveTo(-33, 6, -27, 9);
  } else {
    p.quadraticCurveTo(-38, 0, -27, 9);
  }
  p.bezierCurveTo(-18, 10, -8, 7, 2, 6);
  p.closePath();
  ctx.fillStyle = s.flipper;
  ctx.fill(p);
  if (far) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fill(p);
  }
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = kind === 'front' ? 3.6 : 3;
  ctx.stroke(p);
  // Webbed digits.
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.4;
  for (const [ty, ey] of [
    [-3, -6],
    [0, 0],
    [3, 6],
  ]) {
    ctx.beginPath();
    ctx.moveTo(-5, ty);
    ctx.lineTo(-25, ey);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (kind === 'front' && !s.longFrontFlipper) {
    // Little claws on true seals' front flippers.
    ctx.fillStyle = s.outline;
    for (const cy of [-5.5, 0, 5.5]) {
      ctx.beginPath();
      ctx.ellipse(-31, cy, 2.2, 1.4, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawSpots(
  ctx: Ctx,
  spots: NonNullable<PinnipedStyle['spots']>,
  top: number,
  bottom: number,
): void {
  const rng = createRng(spots.seed);
  ctx.fillStyle = spots.color;
  for (let i = 0; i < spots.count; i++) {
    const onBelly = spots.belly && i % 2 === 1;
    const x = randRange(rng, 46, 124);
    const y = onBelly ? randRange(rng, bottom - 22, bottom - 8) : randRange(rng, top + 6, top + 26);
    const [min, max] = spots.size;
    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      randRange(rng, min, max),
      randRange(rng, min * 0.7, max * 0.8),
      randRange(rng, 0, Math.PI),
      0,
      TAU,
    );
    ctx.fill();
  }
}

/** A flower lei around the neck. */
function drawLei(ctx: Ctx, hd: { x: number; y: number; r: number }): void {
  const colors = ['#ff6fa8', '#ffd23f', '#ff8a3d', '#ff6fa8', '#ffd23f'];
  for (let i = 0; i < 5; i++) {
    const cx = hd.x - 18 + i * 1.8;
    const cy = hd.y - 13 + i * 8.5;
    ctx.fillStyle = colors[i];
    ctx.strokeStyle = '#7a2448';
    ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + i;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3, 2.9, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#fff4c2';
    ctx.beginPath();
    ctx.arc(cx, cy, 1.8, 0, TAU);
    ctx.fill();
  }
}

function drawFace(
  ctx: Ctx,
  s: PinnipedStyle,
  hd: { x: number; y: number; r: number },
  mz: { x: number; y: number; rx: number; ry: number },
): void {
  const eye = s.eyeSize ?? 6;
  const ex = hd.x + 5;
  const ey = hd.y - 5;

  if (s.earFlap) {
    ctx.strokeStyle = s.outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hd.x - 13, hd.y - 1);
    ctx.quadraticCurveTo(hd.x - 16, hd.y - 8, hd.x - 10, hd.y - 9);
    ctx.stroke();
  }

  if (s.blush) {
    ctx.fillStyle = 'rgba(255, 150, 160, 0.35)';
    ctx.beginPath();
    ctx.ellipse(hd.x + 1, hd.y + 8, 6, 4, 0, 0, TAU);
    ctx.fill();
  }

  // Big dark eye with highlights, and a brow.
  ctx.fillStyle = '#121a22';
  ctx.beginPath();
  ctx.ellipse(ex, ey, eye * 0.88, eye, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ex + eye * 0.3, ey - eye * 0.35, Math.max(1.2, eye * 0.32), 0, TAU);
  ctx.fill();
  if (eye > 4.5) {
    ctx.beginPath();
    ctx.arc(ex - eye * 0.35, ey + eye * 0.4, eye * 0.14, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = s.outline;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ex, ey + 1, eye + 3, Math.PI * 1.2, Math.PI * 1.6);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Mouth under the snout (a long grin for the leopard seal).
  ctx.strokeStyle = s.outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(mz.x + mz.rx * 0.4, mz.y + mz.ry * 0.72);
  if (s.longMouth) {
    ctx.quadraticCurveTo(mz.x - mz.rx * 0.6, mz.y + mz.ry * 1.05, hd.x - 6, hd.y + 6);
  } else {
    ctx.quadraticCurveTo(mz.x - 1, mz.y + mz.ry * 1.05, mz.x - mz.rx * 0.55, mz.y + mz.ry * 0.45);
  }
  ctx.stroke();

  if (s.tusks) {
    for (const [dx, shade] of [
      [-6, true],
      [0, false],
    ] as const) {
      const tx = mz.x + dx;
      const ty = mz.y + mz.ry * 0.55;
      ctx.beginPath();
      ctx.moveTo(tx - 2.6, ty);
      ctx.quadraticCurveTo(tx - 3, ty + 14, tx - 1, ty + 26);
      ctx.quadraticCurveTo(tx + 1.5, ty + 14, tx + 2.8, ty);
      ctx.closePath();
      ctx.fillStyle = shade ? '#d9ceb6' : '#f7efdc';
      ctx.fill();
      ctx.strokeStyle = s.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  if (s.proboscis) {
    // Elephant seal's nose drooping over the mouth.
    const px = mz.x + mz.rx * 0.5;
    const py = mz.y + 5;
    ctx.fillStyle = s.muzzle;
    ctx.strokeStyle = s.outline;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(px, py, 7, 13, 0.22, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.4;
    for (const dy of [-3, 2]) {
      ctx.beginPath();
      ctx.arc(px, py + dy, 6, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1a1512';
    ctx.beginPath();
    ctx.ellipse(px + 3, py + 10, 2.2, 1.6, 0.3, 0, TAU);
    ctx.fill();
  } else {
    // Dark nose at the tip of the snout.
    ctx.fillStyle = '#1a2530';
    ctx.beginPath();
    ctx.ellipse(mz.x + mz.rx * 0.72, mz.y - mz.ry * 0.55, 4.2, 3.2, 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(mz.x + mz.rx * 0.66, mz.y - mz.ry * 0.72, 1.1, 0, TAU);
    ctx.fill();
  }

  // Whisker pads: dots, then whiskers (bristly moustache for the walrus).
  ctx.fillStyle = s.outline;
  ctx.globalAlpha = 0.45;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.beginPath();
      ctx.arc(mz.x - 1 + i * 3.4, mz.y - 1 + j * 3.4, 0.9, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  if (s.moustache) {
    ctx.strokeStyle = '#5b4636';
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 8; i++) {
      const x = mz.x - mz.rx * 0.7 + i * ((mz.rx * 1.5) / 7);
      ctx.beginPath();
      ctx.moveTo(x, mz.y + 1);
      ctx.lineTo(x - 0.8, mz.y + 7);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = s.outline;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 1.3;
  const reach = s.moustache ? 8 : 13;
  for (let i = 0; i < 4; i++) {
    const sx = mz.x + mz.rx * 0.35;
    const sy = mz.y + 1 + i * 2;
    const endX = Math.min(SEAL_ART.width - 2, mz.x + mz.rx + reach);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo((sx + endX) / 2, sy - 2 + i * 1.5, endX, sy - 8 + i * 5.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
