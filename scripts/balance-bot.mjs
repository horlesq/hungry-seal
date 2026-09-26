// Balance probe: a greedy bot plays a run by chasing the nearest edible prey with the mouse,
// logging hunger/score/stage every 5 s. Use it to sanity-check tuning in config/balance.ts.
//
// Usage: npm run balance -- [human|perfect] [seconds]      (default: human 150)
//   human   = only on-screen prey, re-aims every 250 ms, no leading (roughly a decent player)
//   perfect = sees all prey, re-aims every 60 ms, leads targets (upper bound on skill)
//
// Reference (Phase 3 tuning, hazards + sharks): human survives 1:06-4:49 (median ~2:20),
// reaching stage 2-4. Results vary a lot: take several samples.
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
let boosting = false;
while (Date.now() - start < seconds * 1000) {
  const info = await page.evaluate((human) => {
    const s = window.__PHASER_GAME__.scene.getScene('Game');
    // Tally hits by source (for the summary line), including a fatal one.
    window.__hits ??= { jellyfish: 0, mine: 0, shark: 0 };
    if (s.lastHit && s.lastHit.at !== window.__lastHitAt) {
      window.__lastHitAt = s.lastHit.at;
      window.__hits[s.lastHit.source]++;
    }
    if (s.dead)
      return {
        dead: true,
        score: s.score,
        eaten: s.eaten,
        t: s.elapsed,
        stage: s.seal.stage,
        coins: s.runCoins,
        cause: s.lastHit && s.elapsed - s.lastHit.at < 0.6 ? s.lastHit.source : 'starved',
      };
    const cam = s.cameras.main;
    const m = s.seal.motion;

    // Danger first: steer away from close hazards and from predators hunting us.
    let fleeX = 0;
    let fleeY = 0;
    let panic = false;
    const avoid = (x, y, radius) => {
      const d = Math.hypot(m.x - x, m.y - y);
      if (d > radius || d < 1) return;
      const w = (radius - d) / radius;
      fleeX += ((m.x - x) / d) * w;
      fleeY += ((m.y - y) / d) * w;
    };
    // Radii tuned to a reasonable player: dodge what's close, don't flee from everything.
    for (const h of s.hazards.alive) if (h.active) avoid(h.x, h.y, 120);
    for (const p of s.predators.alive) {
      if (!p.active || p.def.tier <= s.seal.stage) continue;
      if (p.motion.state === 'notice' || p.motion.state === 'chase') {
        avoid(p.x, p.y, 420);
        if (Math.hypot(m.x - p.x, m.y - p.y) < 300) panic = true;
      } else avoid(p.x, p.y, 160);
    }
    if (fleeX !== 0 || fleeY !== 0) {
      const len = Math.hypot(fleeX, fleeY);
      const tx = m.x + (fleeX / len) * 260;
      const ty = m.y + (fleeY / len) * 260;
      return {
        dead: false,
        flee: true,
        boost: panic,
        sx: (tx - cam.scrollX) * cam.zoom,
        sy: (ty - cam.scrollY) * cam.zoom,
        hunger: s.hunger.value,
        score: s.score,
        eaten: s.eaten,
        stage: s.seal.stage,
        t: s.elapsed,
        dist: 0,
        creatures: s.spawner.countActive(),
        zone: s.seal.y,
        hazards: s.hazards.alive.length,
        predators: s.predators.alive.length,
        coins: s.runCoins,
      };
    }

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
      flee: false,
      boost: false,
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
      hazards: s.hazards.alive.length,
      predators: s.predators.alive.length,
      coins: s.runCoins,
    };
  }, human);
  if (info.dead) {
    const hits = await page.evaluate(() => window.__hits ?? {});
    console.log(
      `DIED (${info.cause}) at t=${info.t.toFixed(1)}s score=${info.score} eaten=${info.eaten} stage=${info.stage} coins=${info.coins} hits=${JSON.stringify(hits)}`,
    );
    break;
  }
  const x = Math.max(5, Math.min(1275, info.sx));
  const y = Math.max(5, Math.min(715, info.sy));
  await page.mouse.move(x, y);
  // Boost (hold left mouse) to escape a close predator.
  if (info.boost && !boosting) await page.mouse.down();
  if (!info.boost && boosting) await page.mouse.up();
  boosting = info.boost;
  if (info.t - lastLog >= 5) {
    lastLog = info.t;
    console.log(
      `t=${info.t.toFixed(0).padStart(3)}s hunger=${info.hunger.toFixed(0).padStart(3)} score=${String(info.score).padStart(5)} eaten=${String(info.eaten).padStart(3)} stage=${info.stage} coins=${String(info.coins).padStart(3)} hazards=${info.hazards} predators=${info.predators} y=${info.zone.toFixed(0)}${info.flee ? ' FLEEING' : ''}`,
    );
  }
  await page.waitForTimeout(human ? 250 : 60);
}
await browser.close();
await server.close();
