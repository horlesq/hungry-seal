// Store page images (itch.io): captures the real game into store/ — a 630x500 cover (the title
// screen) and 1920x1080 screenshots of a few good moments. Re-run after art or UI changes.
//
// Usage: npm run store-shots
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { createServer } from 'vite';

const PORT = 5194;
const OUT = 'store';
await mkdir(OUT, { recursive: true });
const server = await createServer({
  server: { port: PORT, strictPort: true, hmr: false, watch: null },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({
  channel: process.env.PLAYTEST_BROWSER ?? 'chrome',
  headless: true,
  args: [
    ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
    '--enable-gpu',
    '--ignore-gpu-blocklist',
  ],
});

/** A page with a save that has played a bit (coins, pearls, every map open), on `map`. */
async function open(width, height, { map = 'bay', query = '' } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.addInitScript((map) => {
    localStorage.setItem(
      'hungry-seal-save',
      JSON.stringify({
        version: 4,
        runs: 12,
        tutorialDone: true,
        coins: 1840,
        gems: 7,
        bestScore: 48210,
        maps: {
          selected: map,
          best: { bay: 48210 },
          pearls: { bay: [0, 1, 2], arctic: [0, 1, 2] },
        },
      }),
    );
  }, map);
  await page.goto(`http://localhost:${PORT}/${query}`);
  await page.waitForFunction(() => window.__PHASER_GAME__?.scene.isActive('Menu'), null, {
    timeout: 60000,
  });
  await page.waitForTimeout(2500);
  return page;
}

/** Shoots `file` in a run on `map`, with the seal at (x, y) and size `stage`. */
async function runShot(file, map, x, y, stage, { calm = true, swimMs = 4500 } = {}) {
  const page = await open(1920, 1080, { map, query: calm ? '?calm' : '' });
  await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('Menu').scene.start('Game'));
  await page.waitForFunction(() => window.__PHASER_GAME__.scene.isActive('Hud'));
  await page.evaluate(
    ([x, y, stage]) => {
      const s = window.__PHASER_GAME__.scene.getScene('Game');
      const t = s.map.terrain;
      let px = x;
      let py = y;
      for (let r = 0; r < 3000 && t.distance(px, py) < 160; r += 40) {
        px = x + Math.cos(r * 0.37) * r;
        py = y + Math.sin(r * 0.37) * r;
      }
      while (s.growth.stage < stage) s.growth.add(s.growth.pointsToNext);
      s.growth.add(s.growth.pointsToNext * 0.4);
      s.seal.setStage(stage, false);
      s.seal.motion.x = px;
      s.seal.motion.y = py;
      s.seal.setPosition(px, py);
      s.cameras.main.centerOn(px, py);
      s.spawner.populate(px, py, s.seal);
      s.hudDirty = true;
    },
    [x, y, stage],
  );
  // Swim a little so the seal is mid-stroke and the world has filled in around it.
  await page.keyboard.down('d');
  await page.waitForTimeout(swimMs);
  await page.keyboard.up('d');
  const shown = await page.evaluate(() => {
    const s = window.__PHASER_GAME__.scene.getScene('Game');
    s.hunger.value = s.hunger.max * 0.8;
    return s.seal.stage;
  });
  if (shown !== stage) console.warn(`${file}: the seal is size ${shown}, wanted ${stage}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${file}` });
  await page.close();
}

/** Shoots a menu screen. */
async function screenShot(file, key) {
  const page = await open(1920, 1080);
  if (key) {
    await page.evaluate((k) => window.__PHASER_GAME__.scene.getScene('Menu').scene.start(k), key);
    await page.waitForTimeout(2500);
  }
  await page.screenshot({ path: `${OUT}/${file}` });
  await page.close();
}

// Cover: the title screen at 2x, scaled down to itch.io's 630x500.
{
  const page = await open(1260, 1000);
  const shot = await page.screenshot();
  await sharp(shot).resize(630, 500).png().toFile(`${OUT}/cover-630x500.png`);
  await page.close();
}

await screenShot('01-title.png');
await runShot('02-coral-gardens.png', 'bay', 4200, 1000, 2);
await runShot('03-volcano-isle.png', 'tropical', 13000, 900, 3, { swimMs: 3000 });
await runShot('04-iceberg-alley.png', 'arctic', 11000, 1500, 6);
await runShot('05-the-deep.png', 'bay', 33000, 4300, 4, { calm: false });
await screenShot('06-maps.png', 'Maps');
await screenShot('07-skins.png', 'Skins');

await browser.close();
await server.close();
console.log(`store images written to ${OUT}/`);
