// Interface textures painted with Canvas 2D: the wordmark, icons and the upgrade symbols.
// These are part of the UI design (not placeholder art), so they live here rather than in
// PlaceholderArt. Painted at 2x density like the sprites; call after the UI font has loaded.
import Phaser from 'phaser';
import { TAU } from '../utils/math';
import { CSS, FONT_FAMILY } from './theme';

type Ctx = CanvasRenderingContext2D;

const RES = 2;
/** Icons are authored in a 48x48 box. */
const ICON = 48;

export const UiTextures = {
  Wordmark: 'ui-wordmark',
  WordmarkBitten: 'ui-wordmark-bitten',
  Crumb: 'ui-crumb',
  Pause: 'ui-pause',
  Play: 'ui-play',
  SoundOn: 'ui-sound-on',
  SoundOff: 'ui-sound-off',
  Fullscreen: 'ui-fullscreen',
  FullscreenExit: 'ui-fullscreen-exit',
  Back: 'ui-back',
  Restart: 'ui-restart',
  Fish: 'ui-fish',
  Bolt: 'ui-bolt',
  Flame: 'ui-flame',
  Magnet: 'ui-magnet',
  Grow: 'ui-grow',
  Hourglass: 'ui-hourglass',
  Jaws: 'ui-jaws',
  Chevrons: 'ui-chevrons',
  FishPlus: 'ui-fish-plus',
  Trophy: 'ui-trophy',
  Check: 'ui-check',
  Lock: 'ui-lock',
  Star: 'ui-star',
  /** Colored (not tinted): the rare currency. */
  Gem: 'ui-gem',
} as const;

export type UiTexture = (typeof UiTextures)[keyof typeof UiTextures];

const ICONS: Array<[UiTexture, (ctx: Ctx) => void]> = [
  [UiTextures.Pause, drawPause],
  [UiTextures.Play, drawPlay],
  [UiTextures.SoundOn, (c) => drawSpeaker(c, true)],
  [UiTextures.SoundOff, (c) => drawSpeaker(c, false)],
  [UiTextures.Fullscreen, (c) => drawCorners(c, false)],
  [UiTextures.FullscreenExit, (c) => drawCorners(c, true)],
  [UiTextures.Back, drawBack],
  [UiTextures.Restart, drawRestart],
  [UiTextures.Fish, (c) => drawFish(c, 24, 24, 1)],
  [UiTextures.Bolt, drawBolt],
  [UiTextures.Flame, drawFlame],
  [UiTextures.Magnet, drawMagnet],
  [UiTextures.Grow, drawGrow],
  [UiTextures.Hourglass, drawHourglass],
  [UiTextures.Jaws, drawJaws],
  [UiTextures.Chevrons, drawChevrons],
  [UiTextures.FishPlus, drawFishPlus],
  [UiTextures.Trophy, drawTrophy],
  [UiTextures.Check, drawCheck],
  [UiTextures.Lock, drawLock],
  [UiTextures.Star, drawStar],
];

/** Where the bite was taken out of the bitten wordmark, in design units from its top-left. */
export interface WordmarkData {
  resolution: number;
  bite: { x: number; y: number };
}

/** Paints every UI texture that doesn't exist yet. */
export function ensureUiTextures(scene: Phaser.Scene): void {
  for (const [key, draw] of ICONS) {
    paint(scene, key, ICON, ICON, (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      draw(ctx);
    });
  }
  paint(scene, UiTextures.Crumb, 16, 14, drawCrumb);
  paint(scene, UiTextures.Gem, ICON, ICON, drawGem);
  paintWordmark(scene);
}

function paint(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: Ctx) => void,
): Phaser.Textures.CanvasTexture | null {
  if (scene.textures.exists(key)) return null;
  const texture = scene.textures.createCanvas(key, w * RES, h * RES);
  if (!texture) return null;
  const ctx = texture.context;
  ctx.save();
  ctx.scale(RES, RES);
  draw(ctx);
  ctx.restore();
  texture.refresh();
  (texture.customData as { resolution?: number }).resolution = RES;
  return texture;
}

// ---------------------------------------------------------------------------------------
// Wordmark: "Hungry" over a bigger "Seal" in ink, on a chunky ice floe with an ink outline
// and solid depth. The bitten version has a scalloped bite out of the floe's top-right
// corner (letters are too thin for a bite to read; a slab of ice is not).
// ---------------------------------------------------------------------------------------

const MARK = {
  top: { text: 'Hungry', size: 96 },
  bottom: { text: 'Seal', size: 168 },
  padX: 38,
  padY: 26,
  /** Corner rounding of the floe (half the rounding stroke). */
  round: 10,
  outline: 7,
  depth: 12,
  /** Bite radius; the top line keeps this much clear space before the corner. */
  bite: 54,
  margin: 8,
};

function paintWordmark(scene: Phaser.Scene): void {
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return;
  const font = (size: number) => `800 ${size}px ${FONT_FAMILY}`;
  probe.font = font(MARK.top.size);
  const m1 = probe.measureText(MARK.top.text);
  probe.font = font(MARK.bottom.size);
  const m2 = probe.measureText(MARK.bottom.text);

  const edge = MARK.margin + MARK.outline + MARK.round;
  const left = edge;
  const top = edge;
  const textX = left + MARK.padX;
  const base1 = top + MARK.padY + m1.actualBoundingBoxAscent;
  const base2 = base1 + m1.actualBoundingBoxDescent + 4 + m2.actualBoundingBoxAscent;
  const right = textX + Math.max(m1.width + MARK.bite * 1.15, m2.width + MARK.padX);
  const bottom = base2 + m2.actualBoundingBoxDescent + MARK.padY;
  const width = Math.ceil(right + edge);
  const height = Math.ceil(bottom + edge + MARK.depth);

  // A slightly irregular slab, so it reads as ice rather than a button.
  const midX = (left + right) / 2;
  const midY = (top + bottom) / 2;
  const floe: Array<[number, number]> = [
    [left + 16, top + 4],
    [midX - 30, top - 3],
    [right - 26, top + 3],
    [right + 2, top + 28],
    [right - 5, midY + 4],
    [right + 3, bottom - 22],
    [right - 22, bottom + 2],
    [midX + 20, bottom - 3],
    [left + 24, bottom + 3],
    [left - 2, bottom - 26],
    [left + 4, midY - 6],
    [left, top + 22],
  ];
  const slab = (ctx: Ctx, dy: number, grow: number) => {
    polygon(
      ctx,
      floe.map(([px, py]): [number, number] => [px, py + dy]),
    );
    ctx.lineWidth = (MARK.round + grow) * 2;
    ctx.fill();
    ctx.stroke();
  };

  // The bite: three tooth arcs around the top-right corner (cookie-style), plus a disc that
  // clears the corner behind them. Spacing leaves visible cusps between the teeth.
  const r = MARK.bite;
  const cx = right + 4;
  const cy = top - 4;
  const reach = r * 0.72;
  const bite = [{ x: cx, y: cy, r: reach }];
  for (const deg of [92, 136, 180]) {
    const a = (deg * Math.PI) / 180;
    bite.push({ x: cx + Math.cos(a) * reach, y: cy + Math.sin(a) * reach, r: r * 0.5 });
  }

  const draw = (ctx: Ctx, bitten: boolean) => {
    ctx.lineJoin = 'round';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = CSS.trench;
    ctx.strokeStyle = CSS.trench;
    slab(ctx, MARK.depth, MARK.outline);
    ctx.fillStyle = CSS.ink;
    ctx.strokeStyle = CSS.ink;
    slab(ctx, 0, MARK.outline);
    const ice = ctx.createLinearGradient(0, top, 0, bottom);
    ice.addColorStop(0, '#ffffff');
    ice.addColorStop(0.55, '#e6f8ff');
    ice.addColorStop(1, '#b4e3f6');
    ctx.fillStyle = ice;
    ctx.strokeStyle = ice;
    slab(ctx, 0, 0);

    ctx.fillStyle = CSS.ink;
    ctx.font = font(MARK.top.size);
    ctx.fillText(MARK.top.text, textX, base1);
    ctx.font = font(MARK.bottom.size);
    ctx.fillText(MARK.bottom.text, textX - MARK.bottom.size * 0.03, base2);

    if (!bitten) return;
    ctx.globalCompositeOperation = 'destination-out';
    for (const c of bite) circle(ctx, c.x, c.y, c.r).fill();
    // Ink rim along the bitten edge (only where the floe remains).
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = CSS.ink;
    ctx.lineWidth = MARK.outline * 2;
    for (const c of bite) circle(ctx, c.x, c.y, c.r).stroke();
    ctx.globalCompositeOperation = 'source-over';
  };

  paint(scene, UiTextures.Wordmark, width, height, (ctx) => draw(ctx, false));
  const bitten = paint(scene, UiTextures.WordmarkBitten, width, height, (ctx) => draw(ctx, true));
  if (bitten) {
    (bitten.customData as WordmarkData).bite = { x: cx - r * 0.75, y: cy + r * 0.75 };
  }
}

function drawCrumb(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(3, 5);
  ctx.lineTo(9, 2);
  ctx.lineTo(14, 6);
  ctx.lineTo(12, 12);
  ctx.lineTo(5, 12);
  ctx.closePath();
  ctx.fillStyle = '#eafaff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = CSS.ink;
  ctx.stroke();
}

// ---------------------------------------------------------------------------------------
// Icons: white on transparent (tint to color), 48x48 design box.
// ---------------------------------------------------------------------------------------

function circle(ctx: Ctx, x: number, y: number, r: number): Ctx {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  return ctx;
}

function polygon(ctx: Ctx, points: Array<[number, number]>): Ctx {
  ctx.beginPath();
  points.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.closePath();
  return ctx;
}

function polyline(ctx: Ctx, points: Array<[number, number]>, width: number): void {
  ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.stroke();
}

/** Clears pixels (holes, gaps) with the given shape. */
function cut(ctx: Ctx, shape: () => void): void {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  shape();
  ctx.fill();
  ctx.restore();
}

function drawPause(ctx: Ctx): void {
  ctx.beginPath();
  ctx.roundRect(13, 11, 8, 26, 3);
  ctx.roundRect(27, 11, 8, 26, 3);
  ctx.fill();
}

function drawPlay(ctx: Ctx): void {
  polygon(ctx, [
    [17, 12],
    [36, 24],
    [17, 36],
  ]);
  ctx.lineWidth = 4;
  ctx.fill();
  ctx.stroke();
}

function drawSpeaker(ctx: Ctx, on: boolean): void {
  polygon(ctx, [
    [7, 19],
    [15, 19],
    [24, 11],
    [24, 37],
    [15, 29],
    [7, 29],
  ]);
  ctx.lineWidth = 3;
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 3.5;
  if (on) {
    for (const r of [7, 13]) {
      ctx.beginPath();
      ctx.arc(25, 24, r, -0.85, 0.85);
      ctx.stroke();
    }
  } else {
    polyline(
      ctx,
      [
        [31, 18],
        [41, 30],
      ],
      4,
    );
    polyline(
      ctx,
      [
        [41, 18],
        [31, 30],
      ],
      4,
    );
  }
}

function drawCorners(ctx: Ctx, inward: boolean): void {
  const a = 9;
  const b = 39;
  const len = 10;
  for (const [x, y, sx, sy] of [
    [a, a, 1, 1],
    [b, a, -1, 1],
    [a, b, 1, -1],
    [b, b, -1, -1],
  ] as const) {
    if (inward) {
      // Corner point pulled in; arms point back out toward the edges.
      const cx = x + sx * len;
      const cy = y + sy * len;
      polyline(
        ctx,
        [
          [x, cy],
          [cx, cy],
          [cx, y],
        ],
        4.5,
      );
    } else {
      polyline(
        ctx,
        [
          [x, y + sy * len],
          [x, y],
          [x + sx * len, y],
        ],
        4.5,
      );
    }
  }
}

function drawBack(ctx: Ctx): void {
  polyline(
    ctx,
    [
      [28, 11],
      [15, 24],
      [28, 37],
    ],
    5.5,
  );
}

function drawRestart(ctx: Ctx): void {
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(24, 25, 12, -Math.PI * 0.35, Math.PI * 1.35);
  ctx.stroke();
  // Arrowhead at the arc's start (top right), pointing clockwise.
  polygon(ctx, [
    [26, 7],
    [37, 13],
    [27, 20],
  ]);
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
}

function drawFish(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.ellipse(x - 3 * s, y, 14 * s, 9.5 * s, 0, 0, TAU);
  ctx.fill();
  polygon(ctx, [
    [x + 8 * s, y],
    [x + 19 * s, y - 10 * s],
    [x + 19 * s, y + 10 * s],
  ]);
  ctx.lineWidth = 2.5 * s;
  ctx.fill();
  ctx.stroke();
  cut(ctx, () => circle(ctx, x - 10 * s, y - 2.5 * s, 2.4 * s));
}

function drawFishPlus(ctx: Ctx): void {
  drawFish(ctx, 21, 28, 0.85);
  polyline(
    ctx,
    [
      [37, 5],
      [37, 19],
    ],
    4.5,
  );
  polyline(
    ctx,
    [
      [30, 12],
      [44, 12],
    ],
    4.5,
  );
}

function drawBolt(ctx: Ctx): void {
  polygon(ctx, [
    [28, 4],
    [11, 27],
    [22, 27],
    [18, 44],
    [37, 19],
    [26, 19],
    [30, 4],
  ]);
  ctx.lineWidth = 2.5;
  ctx.fill();
  ctx.stroke();
}

function drawFlame(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(24, 4);
  ctx.bezierCurveTo(34, 14, 39, 22, 38, 30);
  ctx.bezierCurveTo(37, 38, 31, 44, 24, 44);
  ctx.bezierCurveTo(17, 44, 10, 38, 10, 30);
  ctx.bezierCurveTo(10, 24, 14, 20, 17, 15);
  ctx.bezierCurveTo(18, 20, 20, 23, 23, 24);
  ctx.bezierCurveTo(22, 16, 22, 10, 24, 4);
  ctx.closePath();
  ctx.fill();
  cut(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(24, 26);
    ctx.bezierCurveTo(29, 31, 30, 34, 29, 37);
    ctx.bezierCurveTo(28, 40, 26, 41, 24, 41);
    ctx.bezierCurveTo(21, 41, 19, 39, 19, 36);
    ctx.bezierCurveTo(19, 32, 22, 30, 24, 26);
    ctx.closePath();
  });
}

function drawMagnet(ctx: Ctx): void {
  ctx.lineCap = 'butt';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(13, 40);
  ctx.lineTo(13, 22);
  ctx.arc(24, 22, 11, Math.PI, 0);
  ctx.lineTo(35, 40);
  ctx.stroke();
  // Gap marking the pole tips.
  cut(ctx, () => {
    ctx.beginPath();
    ctx.rect(4, 31, 40, 2.5);
  });
}

function drawGrow(ctx: Ctx): void {
  ctx.beginPath();
  ctx.roundRect(8, 28, 8, 12, 2);
  ctx.roundRect(20, 20, 8, 20, 2);
  ctx.roundRect(32, 9, 8, 31, 2);
  ctx.fill();
}

function drawHourglass(ctx: Ctx): void {
  ctx.beginPath();
  ctx.roundRect(10, 5, 28, 5, 2);
  ctx.roundRect(10, 38, 28, 5, 2);
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(14, 10);
  ctx.lineTo(34, 10);
  ctx.lineTo(24, 24);
  ctx.lineTo(34, 38);
  ctx.lineTo(14, 38);
  ctx.lineTo(24, 24);
  ctx.closePath();
  ctx.stroke();
  // Sand: a little left on top, a pile at the bottom.
  polygon(ctx, [
    [19, 16],
    [29, 16],
    [24, 22],
  ]).fill();
  polygon(ctx, [
    [24, 29],
    [31, 37],
    [17, 37],
  ]).fill();
}

function drawJaws(ctx: Ctx): void {
  circle(ctx, 22, 24, 18).fill();
  const mouth: Array<[number, number]> = [
    [20, 24],
    [46, 6],
    [46, 42],
  ];
  cut(ctx, () => polygon(ctx, mouth));
  // Teeth along both lips, pointing into the mouth.
  const lip = (t: number, sign: number): [number, number] => [20 + 26 * t, 24 + sign * 18 * t];
  for (const sign of [-1, 1]) {
    for (const t of [0.38, 0.62]) {
      const [ax, ay] = lip(t, sign);
      const [bx, by] = lip(t + 0.2, sign);
      polygon(ctx, [
        [ax, ay],
        [bx, by],
        [(ax + bx) / 2 + 1, (ay + by) / 2 - sign * 6],
      ]).fill();
    }
  }
  cut(ctx, () => circle(ctx, 17, 14, 2.6));
}

function drawChevrons(ctx: Ctx): void {
  for (const dx of [0, 13]) {
    polyline(
      ctx,
      [
        [10 + dx, 12],
        [22 + dx, 24],
        [10 + dx, 36],
      ],
      5.5,
    );
  }
}

function drawTrophy(ctx: Ctx): void {
  // Cup with handles, stem and base.
  ctx.beginPath();
  ctx.moveTo(13, 7);
  ctx.lineTo(35, 7);
  ctx.bezierCurveTo(35, 20, 31, 27, 24, 29);
  ctx.bezierCurveTo(17, 27, 13, 20, 13, 7);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 3.5;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(
      24 + side * 12,
      14,
      5.5,
      side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5,
      side < 0 ? Math.PI * 1.5 : Math.PI * 0.5,
    );
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.roundRect(21.5, 28, 5, 8, 1);
  ctx.roundRect(15, 35, 18, 6, 2);
  ctx.fill();
}

function drawCheck(ctx: Ctx): void {
  polyline(
    ctx,
    [
      [11, 25],
      [20, 34],
      [37, 14],
    ],
    6,
  );
}

function drawLock(ctx: Ctx): void {
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(24, 21, 8, Math.PI, 0);
  ctx.lineTo(32, 24);
  ctx.moveTo(16, 24);
  ctx.lineTo(16, 21);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(12, 22, 24, 19, 4);
  ctx.fill();
  cut(ctx, () => circle(ctx, 24, 30, 2.6));
}

function drawStar(ctx: Ctx): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 19 : 8.5;
    pts.push([24 + Math.cos(a) * r, 25 + Math.sin(a) * r]);
  }
  polygon(ctx, pts);
  ctx.lineWidth = 3;
  ctx.fill();
  ctx.stroke();
}

/** Faceted pink gem with an ink outline (colored, not meant to be tinted). */
function drawGem(ctx: Ctx): void {
  ctx.lineJoin = 'round';
  const facets: Array<[string, Array<[number, number]>]> = [
    [
      '#ffc2e3',
      [
        [16, 8],
        [32, 8],
        [28, 18],
        [20, 18],
      ],
    ],
    [
      '#ff8cc8',
      [
        [8, 18],
        [16, 8],
        [20, 18],
      ],
    ],
    [
      '#e8388f',
      [
        [32, 8],
        [40, 18],
        [28, 18],
      ],
    ],
    [
      '#ff5fb0',
      [
        [8, 18],
        [20, 18],
        [24, 42],
      ],
    ],
    [
      '#d62a82',
      [
        [28, 18],
        [40, 18],
        [24, 42],
      ],
    ],
    [
      '#ff76c0',
      [
        [20, 18],
        [28, 18],
        [24, 42],
      ],
    ],
  ];
  for (const [color, pts] of facets) {
    ctx.fillStyle = color;
    polygon(ctx, pts).fill();
  }
  ctx.strokeStyle = CSS.ink;
  ctx.lineWidth = 2.6;
  polygon(ctx, [
    [8, 18],
    [16, 8],
    [32, 8],
    [40, 18],
    [24, 42],
  ]).stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(19, 12, 2, 0, TAU);
  ctx.fill();
}
