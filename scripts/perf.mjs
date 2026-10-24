// Performance probe: plays the heaviest situations of a run on an emulated phone (touch,
// 915x412 landscape at 2.625x pixel ratio, CPU slowed down 4x like a mid-range phone) and
// reports frame times per situation. The GPU is still this machine's, so fill-rate costs
// show up smaller than on a real phone: treat these numbers as a floor, then check by hand.
//
// Usage: npm run perf                 (PERF_CPU=4 PERF_SECONDS=12 PERF_DEVICE=phone)
//        PERF_DEVICE=desktop npm run perf   (1280x720, no throttling)
//        PERF_MAP=arctic npm run perf
//        PERF_PROFILE=1 npm run perf        (also prints the top CPU hotspots of each situation)
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const DEVICE = process.env.PERF_DEVICE ?? 'phone';
const CPU = Number(process.env.PERF_CPU ?? (DEVICE === 'phone' ? 4 : 1));
const SECONDS = Number(process.env.PERF_SECONDS ?? 12);
const MAP = process.env.PERF_MAP ?? 'bay';
const PROFILE = Boolean(process.env.PERF_PROFILE);
const PORT = 5197;

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
const context = await browser.newContext(
  DEVICE === 'phone'
    ? {
        viewport: { width: 915, height: 412 },
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true,
      }
    : { viewport: { width: 1280, height: 720 } },
);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const cdp = await context.newCDPSession(page);
if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
if (PROFILE) {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
}

/** Top self-time functions of a CPU profile, and the inclusive time of Graphics rendering. */
function hotspots(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const self = new Map();
  profile.samples.forEach((id, i) =>
    self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)),
  );
  const name = (n) =>
    `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop().split('?')[0]}:${n.callFrame.lineNumber}`;
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  const byName = new Map();
  let graphics = 0;
  for (const [id, t] of self) {
    const k = name(byId.get(id));
    byName.set(k, (byName.get(k) ?? 0) + t);
    for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
      if (byId.get(cur).callFrame.functionName === 'GraphicsWebGLRenderer') {
        graphics += t;
        break;
      }
    }
  }
  const pct = (t) => `${((t / total) * 100).toFixed(1).padStart(5)}%`;
  console.log(`    Graphics rendering (inclusive) ${pct(graphics)}`);
  for (const [k, t] of [...byName].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`    ${pct(t)} ${k}`);
  }
}

// Unlock and pick the map, skip the tutorial, then start a run.
await page.addInitScript((map) => {
  localStorage.setItem(
    'hungry-seal-save',
    JSON.stringify({
      version: 4,
      runs: 10,
      tutorialDone: true,
      bestScore: 99999,
      maps: { selected: map, best: {} },
    }),
  );
}, MAP);
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => window.__PHASER_GAME__?.scene.isActive('Menu'), null, {
  timeout: 60000,
});
await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('Menu').scene.start('Game'));
await page.waitForFunction(() => window.__PHASER_GAME__?.scene.isActive('Hud'), null, {
  timeout: 60000,
});

/** Keeps the seal alive and puts it at (x, y) (or the nearest open water), at `stage`. */
const place = (x, y, stage) =>
  page.evaluate(
    ([x, y, stage]) => {
      const s = window.__PHASER_GAME__.scene.getScene('Game');
      const t = s.map.terrain;
      let px = x;
      let py = y;
      for (let r = 0; r < 3000 && t.distance(px, py) < 150; r += 40) {
        const a = r * 0.37;
        px = x + Math.cos(a) * r;
        py = y + Math.sin(a) * r;
      }
      s.growth.add(10_000_000);
      s.seal.setStage(stage, false);
      s.seal.motion.x = px;
      s.seal.motion.y = py;
      s.seal.setPosition(px, py);
      s.cameras.main.centerOn(px, py);
      return { x: Math.round(px), y: Math.round(py) };
    },
    [x, y, stage],
  );

/** Swims around for SECONDS while recording every frame's duration. */
async function measure(label, keys) {
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    const tick = (now) => {
      window.__frames.push(now - last);
      last = now;
      if (window.__frames) window.__raf = requestAnimationFrame(tick);
    };
    window.__raf = requestAnimationFrame(tick);
  });
  if (PROFILE) await cdp.send('Profiler.start');
  const end = Date.now() + SECONDS * 1000;
  let i = 0;
  while (Date.now() < end) {
    await page.evaluate(() => {
      const s = window.__PHASER_GAME__.scene.getScene('Game');
      s.hunger.value = s.hunger.max;
    });
    const pair = keys[i++ % keys.length];
    for (const k of pair) await page.keyboard.down(k);
    await page.waitForTimeout(1000);
    for (const k of pair) await page.keyboard.up(k);
  }
  const r = await page.evaluate(() => {
    cancelAnimationFrame(window.__raf);
    const f = window.__frames.slice(5);
    window.__frames = null;
    const s = window.__PHASER_GAME__.scene.getScene('Game');
    return {
      frames: f,
      objects: s.children.length,
      creatures: s.spawner.countActive(),
      backing: `${s.scale.width}x${s.scale.height}`,
    };
  });
  const profile = PROFILE ? (await cdp.send('Profiler.stop')).profile : null;
  const f = r.frames.sort((a, b) => a - b);
  const avg = f.reduce((a, b) => a + b, 0) / f.length;
  const p95 = f[Math.floor(f.length * 0.95)];
  const slow = f.filter((d) => d > 20).length / f.length;
  console.log(
    `${label.padEnd(26)} ${(1000 / avg).toFixed(0).padStart(3)} fps  p95 ${p95.toFixed(1).padStart(5)} ms  ` +
      `slow frames ${(slow * 100).toFixed(0).padStart(3)}%  objects ${r.objects}  creatures ${r.creatures}  canvas ${r.backing}`,
  );
  if (profile) hotspots(profile);
  return { label, fps: 1000 / avg, p95, slow };
}

console.log(`device ${DEVICE}, cpu x${CPU}, map ${MAP}, ${SECONDS}s per situation`);
const wander = [['d'], ['d', 's'], ['d'], ['d', 'w']];
const results = [];
const def = await page.evaluate(() => {
  const s = window.__PHASER_GAME__.scene.getScene('Game');
  return { start: s.map.def.start, boss: s.map.def.boss, width: s.map.width };
});
await place(def.start.x, def.start.y, 1);
results.push(await measure('size 1, start', wander));
await place(def.width * 0.3, 1100, 8);
results.push(await measure('size 8, shallows', wander));
await place(def.width * 0.6, 4200, 8);
results.push(await measure('size 8, deep (dark)', wander));
await place(def.boss.x, def.boss.y, 8);
results.push(await measure('size 8, boss lair', [['a'], ['d'], ['w'], ['s']]));

await browser.close();
await server.close();
const worst = results.reduce((a, b) => (b.fps < a.fps ? b : a));
console.log(`worst: ${worst.label} at ${worst.fps.toFixed(0)} fps`);
if (errors.length) console.log(`console errors: ${errors.slice(0, 3).join(' | ')}`);
