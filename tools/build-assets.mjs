// Turns the Blender-rendered PNGs in art/ into the WebP files the game loads from
// public/assets/ (about 8x smaller at a quality you can't tell apart in game), and renders the
// app icons (public/icons/, for the web app manifest) from public/favicon.svg.
//
// Usage: npm run assets            (only PNGs newer than their WebP)
//        npm run assets -- --all   (everything)
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC = 'art';
const OUT = path.join('public', 'assets');
/** Lossy colour, lossless-quality alpha (clean outlines), slowest/best compression. */
const WEBP = { quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true };

const all = process.argv.includes('--all');
await mkdir(OUT, { recursive: true });
let built = 0;
let before = 0;
let after = 0;
for (const file of (await readdir(SRC)).sort()) {
  if (!file.endsWith('.png')) continue;
  const src = path.join(SRC, file);
  const dst = path.join(OUT, file.replace(/\.png$/, '.webp'));
  const srcStat = await stat(src);
  const dstStat = await stat(dst).catch(() => null);
  if (!all && dstStat && dstStat.mtimeMs >= srcStat.mtimeMs) continue;
  const info = await sharp(src).webp(WEBP).toFile(dst);
  before += srcStat.size;
  after += info.size;
  built++;
}
// App icons: plain (the round badge on transparent) and maskable (badge inside the 80% safe
// zone on the theme background, for Android's adaptive icon shapes).
const ICONS = path.join('public', 'icons');
const svg = path.join('public', 'favicon.svg');
await mkdir(ICONS, { recursive: true });
const svgTime = (await stat(svg)).mtimeMs;
const icons = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.2 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0.1 },
];
for (const icon of icons) {
  const dst = path.join(ICONS, icon.file);
  const done = await stat(dst).catch(() => null);
  if (!all && done && done.mtimeMs >= svgTime) continue;
  const inner = Math.round(icon.size * (1 - icon.pad));
  const badge = await sharp(svg, { density: 384 }).resize(inner, inner).png().toBuffer();
  const background = icon.pad > 0 ? '#041a31' : { r: 0, g: 0, b: 0, alpha: 0 };
  await sharp({ create: { width: icon.size, height: icon.size, channels: 4, background } })
    .composite([{ input: badge, gravity: 'center' }])
    .png()
    .toFile(dst);
  built++;
}

const mb = (n) => (n / 1048576).toFixed(1);
console.log(
  built ? `built ${built} WebP files: ${mb(before)} MB -> ${mb(after)} MB` : 'assets up to date',
);
