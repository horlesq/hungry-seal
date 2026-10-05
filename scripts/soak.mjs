// Soak test: a long run plus many restarts, watching for leaks. Fails if live objects,
// tweens, event listeners or (post-GC) heap keep growing.
//
// Usage: npm run soak            (SOAK_SECONDS=240 SOAK_RESTARTS=20 by default)
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const SECONDS = Number(process.env.SOAK_SECONDS ?? 240);
const RESTARTS = Number(process.env.SOAK_RESTARTS ?? 20);
const PORT = 5191;
const server = await createServer({
  // No hot reload or file watching: editing src/ during the soak must not reload the page.
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
    '--enable-precise-memory-info',
    '--js-flags=--expose-gc',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const active = (k) =>
  page.waitForFunction((key) => window.__PHASER_GAME__?.scene.isActive(key), k, {
    timeout: 20000,
  });

/** Live object counts, listeners and heap (after a forced GC). */
const sample = () =>
  page.evaluate(() => {
    window.gc?.();
    const g = window.__PHASER_GAME__;
    const game = g.scene.getScene('Game');
    const hud = g.scene.getScene('Hud');
    const bus = window.__EVENT_BUS__.emitter;
    const busListeners = bus.eventNames().reduce((n, e) => n + bus.listenerCount(e), 0);
    const gameListeners = g.events.eventNames().reduce((n, e) => n + g.events.listenerCount(e), 0);
    const live = (s) => (s && s.sys.isActive() ? s.children.length : 0);
    return {
      heapMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0,
      gameObjects: live(game),
      hudObjects: live(hud),
      tweens: game?.sys.isActive() ? game.tweens.getTweens().length : 0,
      timers: game?.sys.isActive()
        ? game.time._active.length + game.time._pendingInsertion.length
        : 0,
      busListeners,
      gameListeners,
      textures: g.textures.getTextureKeys().length,
      sounds: g.sound.sounds.length,
      fps: Math.round(g.loop.actualFps),
      scenes: ['Game', 'Hud', 'Pause', 'GameOver']
        .map((k) => `${k}:${g.scene.getScene(k).sys.settings.status}`)
        .join(' '),
      dead: game?.dead,
    };
  });

const fmt = (s) =>
  `[${s.scenes} dead=${s.dead}] heap ${s.heapMB.toFixed(1)} MB  objects ${s.gameObjects}+${s.hudObjects}  tweens ${s.tweens}  timers ${s.timers}  bus ${s.busListeners}  game ${s.gameListeners}  textures ${s.textures}  sounds ${s.sounds}  fps ${s.fps}`;

await page.goto(`http://localhost:${PORT}/?debug`);
await active('Menu');
await page.keyboard.press('Enter');
await active('Hud');
await page.waitForTimeout(1000);
// Keep the seal fed (hunger is capped at max, so top it up every step) so the run never ends.
const feed = () =>
  page.evaluate(() => {
    const g = window.__PHASER_GAME__.scene.getScene('Game');
    g.hunger.value = g.hunger.max;
  });

// 1) A long run that tours every zone: dive to the seabed and back while swimming sideways.
console.log(`long run: ${SECONDS}s`);
const runSamples = [];
const keys = [
  ['d', 's'],
  ['d', 's'],
  ['a', 's'],
  ['a', 'w'],
  ['d', 'w'],
  ['d', 'w'],
];
const start = Date.now();
let step = 0;
while (Date.now() - start < SECONDS * 1000) {
  await feed();
  const pair = keys[step % keys.length];
  for (const k of pair) await page.keyboard.down(k);
  await page.waitForTimeout(5000);
  for (const k of pair) await page.keyboard.up(k);
  step++;
  if (step % 3 === 0) {
    const s = await sample();
    runSamples.push(s);
    const y = await page.evaluate(() =>
      Math.round(window.__PHASER_GAME__.scene.getScene('Game').seal.y),
    );
    console.log(`  t=${Math.round((Date.now() - start) / 1000)}s y=${y}  ${fmt(s)}`);
  }
}

// 2) Restarts: die -> results -> swim again, plus a trip through the menu every 5th time.
console.log(`restarts: ${RESTARTS}`);
const restartSamples = [];
for (let i = 0; i < RESTARTS; i++) {
  await page.evaluate(() => {
    window.__PHASER_GAME__.scene.getScene('Game').hunger.value = 0.01;
  });
  await active('GameOver');
  await page.waitForTimeout(900);
  if (i % 5 === 4) {
    await page.keyboard.press('Escape');
    await active('Menu');
    await page.waitForTimeout(300);
    // Play opens the map select after the first run; Swim! starts the run.
    await page.keyboard.press('Enter');
    await active('Maps');
    await page.waitForTimeout(400);
    await page.evaluate(() =>
      window.__PHASER_GAME__.scene.getScene('Maps').children.getByName('swim').press(),
    );
  } else {
    await page.keyboard.press('Enter');
  }
  await active('Hud');
  await page.waitForTimeout(1200);
  const s = await sample();
  restartSamples.push(s);
  if (i % 5 === 4 || i === 0) console.log(`  restart ${i + 1}: ${fmt(s)}`);
}

await browser.close();
await server.close();

// Verdicts: compare the late samples with the early ones.
const checks = [];
const check = (name, ok, detail) => {
  checks.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`);
};
// Compare samples taken at the same point of the cycle (right after a menu round-trip):
// listener counts depend on which scenes happen to be running.
const sameStep = restartSamples.filter((_, i) => i % 5 === 4);
const first = sameStep[0] ?? restartSamples[0];
const last = sameStep.at(-1) ?? restartSamples.at(-1);
const maxObjects = Math.max(...runSamples.map((s) => s.gameObjects));
check('long run: live objects stay bounded', maxObjects < 900, `max ${maxObjects}`);
const runHeap = runSamples.map((s) => s.heapMB);
check(
  'long run: heap stays flat',
  runHeap.at(-1) - Math.min(...runHeap) < 40,
  `${runHeap.map((h) => h.toFixed(0)).join(' -> ')} MB`,
);
check(
  'restarts: event listeners do not pile up',
  last.busListeners === first.busListeners && last.gameListeners === first.gameListeners,
  `bus ${first.busListeners} -> ${last.busListeners}, game ${first.gameListeners} -> ${last.gameListeners}`,
);
check(
  'restarts: objects, tweens and textures do not pile up',
  last.gameObjects <= first.gameObjects + 40 &&
    last.tweens <= first.tweens + 20 &&
    last.textures === first.textures,
  `objects ${first.gameObjects} -> ${last.gameObjects}, tweens ${first.tweens} -> ${last.tweens}, textures ${first.textures} -> ${last.textures}`,
);
check(
  'restarts: heap stays flat',
  last.heapMB - first.heapMB < 25,
  `${first.heapMB.toFixed(1)} -> ${last.heapMB.toFixed(1)} MB`,
);
check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');
const failed = checks.filter((ok) => !ok).length;
console.log(`\n${checks.length - failed}/${checks.length} soak checks passed`);
process.exit(failed ? 1 : 0);
