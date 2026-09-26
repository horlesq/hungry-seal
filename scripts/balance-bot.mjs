// Balance probe: a greedy bot plays a run by chasing the nearest edible prey with the mouse,
// logging hunger/score/stage every 5 s. Use it to sanity-check tuning in config/balance.ts.
//
// Usage: npm run balance -- [human|perfect] [seconds]      (default: human 150)
//   human   = only on-screen prey, re-aims every 250 ms, no leading (roughly a decent player)
//   perfect = sees all prey, re-aims every 60 ms, leads targets (upper bound on skill)
//
// Reference (Phase 2 tuning, no predators): human starves at ~2:00 reaching stage 3;
// perfect sustains indefinitely at stage 4.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5196, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5196/');
await page.waitForFunction(() => window.__PHASER_GAME__?.scene.isActive('Menu'));
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__PHASER_GAME__?.scene.isActive('Game'));
await page.mouse.move(640, 360);

const human = (process.argv[2] ?? 'human') !== 'perfect';
const seconds = Number(process.argv[3] ?? 150);
console.log(`bot mode: ${human ? 'human' : 'perfect'}`);

const start = Date.now();
let lastLog = 0;
while (Date.now() - start < seconds * 1000) {
  const info = await page.evaluate((human) => {
    const s = window.__PHASER_GAME__.scene.getScene('Game');
    if (s.dead)
      return { dead: true, score: s.score, eaten: s.eaten, t: s.elapsed, stage: s.seal.stage };
    const cam = s.cameras.main;
    const m = s.seal.motion;
    let best = null;
    let bestD = Infinity;
    for (const c of s.spawner.alive) {
      if (!c.active || c.def.tier > s.seal.stage) continue;
      if (human && !cam.worldView.contains(c.x, c.y)) continue;
      const d = Math.hypot(c.x - m.x, c.y - m.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    // Lead the target a bit; otherwise drift toward the reef band.
    const lead = human ? 0 : 0.15;
    const tx = best ? best.x + best.motion.vx * lead : m.x + 300;
    const ty = best ? best.y + best.motion.vy * lead : 1100;
    return {
      dead: false,
      sx: (tx - cam.scrollX) * cam.zoom,
      sy: (ty - cam.scrollY) * cam.zoom,
      hunger: s.hunger.value,
      score: s.score,
      eaten: s.eaten,
      stage: s.seal.stage,
      t: s.elapsed,
      dist: bestD,
      creatures: s.spawner.countActive(),
      zone: s.seal.y,
    };
  }, human);
  if (info.dead) {
    console.log(
      `DIED at t=${info.t.toFixed(1)}s score=${info.score} eaten=${info.eaten} stage=${info.stage}`,
    );
    break;
  }
  const x = Math.max(5, Math.min(1275, info.sx));
  const y = Math.max(5, Math.min(715, info.sy));
  await page.mouse.move(x, y);
  if (info.t - lastLog >= 5) {
    lastLog = info.t;
    console.log(
      `t=${info.t.toFixed(0).padStart(3)}s hunger=${info.hunger.toFixed(0).padStart(3)} score=${String(info.score).padStart(5)} eaten=${String(info.eaten).padStart(3)} stage=${info.stage} nearest=${info.dist.toFixed(0)} alive=${info.creatures} y=${info.zone.toFixed(0)}`,
    );
  }
  await page.waitForTimeout(human ? 250 : 60);
}
await browser.close();
await server.close();
