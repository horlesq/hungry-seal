// Browser matrix: boots the game in Chrome, Edge, Firefox and WebKit (Safari's engine, also
// emulating an iPhone held sideways) and plays a short run in each: title screen, a run with
// steering, the Skins screen (art loaded on demand), no console errors. Screenshots land in
// .playtest/browser-<name>.png.
//
// Usage: npm run browsers                   (all; missing browsers are skipped)
//        BROWSERS=firefox,webkit npm run browsers
// Firefox and WebKit come from Playwright: `npx playwright-core install firefox webkit` once.
import { chromium, firefox, webkit } from 'playwright-core';
import { createServer } from 'vite';

const PORT = 5195;
const ALL = [
  { name: 'chrome', type: chromium, launch: { channel: 'chrome' } },
  { name: 'edge', type: chromium, launch: { channel: 'msedge' } },
  { name: 'firefox', type: firefox, launch: {} },
  { name: 'webkit', type: webkit, launch: {} },
  {
    name: 'webkit-iphone',
    type: webkit,
    launch: {},
    context: {
      viewport: { width: 844, height: 390 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    },
  },
];
const only = process.env.BROWSERS?.split(',');
const targets = ALL.filter((b) => !only || only.includes(b.name));

const server = await createServer({
  server: { port: PORT, strictPort: true, hmr: false, watch: null },
  logLevel: 'error',
});
await server.listen();

const results = [];
for (const b of targets) {
  let browser;
  try {
    browser = await b.type.launch({ headless: true, ...b.launch });
  } catch (e) {
    console.log(`SKIP  ${b.name}: not installed (${e.message.split('\n')[0]})`);
    continue;
  }
  const context = await browser.newContext(b.context ?? { viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const fails = [];
  const step = async (label, fn) => {
    try {
      return await fn();
    } catch (e) {
      fails.push(`${label}: ${e.message.split('\n')[0]}`);
      return null;
    }
  };
  const active = (key) =>
    page.waitForFunction((k) => window.__PHASER_GAME__?.scene.isActive(k), key, { timeout: 45000 });

  await page.addInitScript(() =>
    localStorage.setItem(
      'hungry-seal-save',
      JSON.stringify({ version: 4, runs: 3, tutorialDone: true }),
    ),
  );
  await step('boot', async () => {
    await page.goto(`http://localhost:${PORT}/`);
    await active('Menu');
  });
  const info = await step('renderer', () =>
    page.evaluate(() => {
      const g = window.__PHASER_GAME__;
      return {
        renderer: g.renderer.type === 2 ? 'WebGL' : 'Canvas',
        audio: g.sound.constructor.name,
      };
    }),
  );
  await step('run', async () => {
    await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('Menu').scene.start('Game'));
    await active('Hud');
    const before = await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('Game').seal.x);
    await page.keyboard.down('d');
    await page.waitForTimeout(2500);
    await page.keyboard.up('d');
    const after = await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('Game').seal.x);
    if (after - before < 200)
      throw new Error(`seal barely moved (${Math.round(after - before)} px)`);
  });
  const fps = await step('fps', () =>
    page.evaluate(() => Math.round(window.__PHASER_GAME__.loop.actualFps)),
  );
  await page.screenshot({ path: `.playtest/browser-${b.name}.png` });
  await step('skins', async () => {
    await page.evaluate(() => {
      const g = window.__PHASER_GAME__;
      g.scene.getScene('Game').scene.start('Skins');
    });
    await active('Skins');
    const missing = await page.evaluate(() => {
      const g = window.__PHASER_GAME__;
      return ['seal', 'seal-walrus', 'seal-golden'].filter(
        (k) => !g.textures.exists(k) || g.textures.get(k).frameTotal < 15,
      );
    });
    if (missing.length) throw new Error(`skins not loaded: ${missing.join(', ')}`);
  });
  if (errors.length) fails.push(`console: ${errors.slice(0, 2).join(' | ')}`);
  const ok = fails.length === 0;
  results.push(ok);
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${b.name.padEnd(14)} ${info ? `${info.renderer}, ${info.audio}` : ''}${fps ? `, ${fps} fps` : ''}${ok ? '' : `\n      ${fails.join('\n      ')}`}`,
  );
  await browser.close();
}
await server.close();
const bad = results.filter((ok) => !ok).length;
console.log(`\n${results.length - bad}/${results.length} browsers passed`);
process.exit(bad ? 1 : 0);
