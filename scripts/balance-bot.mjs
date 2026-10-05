// Balance probe: a greedy bot plays a run by chasing the nearest edible prey with the mouse,
// logging hunger/score/stage every 5 s. Use it to sanity-check tuning in config/balance.ts.
//
// Usage: npm run balance -- [human|perfect] [seconds] [upgradeLevel]   (default: human 150 0)
//   upgradeLevel = every upgrade at this level (0-5), to measure upgraded runs
//   human   = only on-screen prey, re-aims every 250 ms, no leading (roughly a decent player)
//   perfect = sees all prey, re-aims every 60 ms, leads targets (upper bound on skill)
//
// The human bot plays like a player who follows the hints: flees hunting predators upward
// (to leap out) and steers around puffed-up pufferfish.
//
// Reference (Phase 5 tuning): human survives 2:26-4:40, reaching stage 3-4 (Phase 4 code
// with this bot: 1:01-4:45, median ~3:30). Results vary a lot: take several samples.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const PORT = Number(process.env.BOT_PORT ?? 5196);
// No hot reload or file watching: editing src/ during a long run must not reload the page.
const server = await createServer({
  server: { port: PORT, strictPort: true, hmr: false, watch: null },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const upgradeLevel = Number(process.argv[4] ?? 0);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
if (upgradeLevel > 0) {
  await page.addInitScript((level) => {
    const ids = ['speed', 'belly', 'metabolism', 'boost', 'jaws', 'magnet', 'frenzy'];
    const upgrades = Object.fromEntries(ids.map((id) => [id, level]));
    localStorage.setItem(
      'hungry-seal-save',
      JSON.stringify({ version: 4, runs: 10, tutorialDone: true, upgrades }),
    );
  }, upgradeLevel);
}
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => window.__PHASER_GAME__?.scene.isActive('Menu'));
if (process.env.BOT_MAP) {
  // Unlock and select the map, then start the run directly (Play goes via the map select).
  await page.evaluate((id) => {
    const raw = localStorage.getItem('hungry-seal-save');
    const save = raw ? JSON.parse(raw) : {};
    save.bestScore = Math.max(save.bestScore ?? 0, 99999);
    save.maps = { selected: id, best: {} };
    localStorage.setItem('hungry-seal-save', JSON.stringify(save));
  }, process.env.BOT_MAP);
  await page.reload();
  await page.waitForFunction(() => window.__PHASER_GAME__?.scene.isActive('Menu'));
  await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('Menu').scene.start('Game'));
} else {
  await page.keyboard.press('Enter');
}
await page.waitForFunction(() => window.__PHASER_GAME__?.scene.isActive('Game'));
await page.mouse.move(640, 360);

const human = (process.argv[2] ?? 'human') !== 'perfect';
const seconds = Number(process.argv[3] ?? 150);
console.log(
  `bot mode: ${human ? 'human' : 'perfect'}, upgrades ${upgradeLevel}, map ${process.env.BOT_MAP ?? 'bay'}`,
);

const start = Date.now();
let lastLog = 0;
let boosting = false;
while (Date.now() - start < seconds * 1000) {
  const info = await page.evaluate((human) => {
    const s = window.__PHASER_GAME__.scene.getScene('Game');
    // Tally hits by source (for the summary line), including a fatal one.
    window.__hits ??= {};
    if (s.lastHit && s.lastHit.at !== window.__lastHitAt) {
      window.__lastHitAt = s.lastHit.at;
      window.__hits[s.lastHit.source] = (window.__hits[s.lastHit.source] ?? 0) + 1;
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
    const terrain = s.map.terrain;
    // A player doesn't chase what's behind rock: check the straight line to a target.
    const clear = (x2, y2) => {
      const d = Math.hypot(x2 - m.x, y2 - m.y);
      const n = Math.ceil(d / 24);
      for (let i = 1; i < n; i++) {
        const k = i / n;
        if (terrain.distance(m.x + (x2 - m.x) * k, m.y + (y2 - m.y) * k) < 18) return false;
      }
      return true;
    };
    // Stuck against rock (barely moved for 1.5 s): back out upward, away from the wall.
    const st = (window.__stuck ??= { at: s.elapsed, x: m.x, y: m.y, until: -1, tx: 0, ty: 0 });
    if (s.elapsed - st.at >= 1.5) {
      if (Math.hypot(m.x - st.x, m.y - st.y) < 70) {
        const n = terrain.normal(m.x, m.y, { x: 0, y: 0 });
        st.until = s.elapsed + 1.2;
        st.tx = m.x + n.x * 250 + (Math.random() - 0.5) * 300;
        st.ty = m.y - 260 + n.y * 120;
      }
      st.at = s.elapsed;
      st.x = m.x;
      st.y = m.y;
    }
    if (s.elapsed < st.until) {
      return {
        dead: false,
        flee: false,
        boost: false,
        sx: (st.tx - cam.worldView.x) * cam.zoom,
        sy: (st.ty - cam.worldView.y) * cam.zoom,
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
    // A player stung once steers around puffed-up pufferfish.
    for (const c of s.spawner.alive) if (c.active && c.puffed) avoid(c.x, c.y, 80);
    for (const p of s.predators.alive) {
      if (!p.active || p.def.tier <= s.seal.stage) continue;
      if (p.motion.state === 'notice' || p.motion.state === 'chase') {
        avoid(p.x, p.y, 420);
        // Like the in-game hint says: head up and leap out (predators only hunt in water).
        if (Math.hypot(m.x - p.x, m.y - p.y) < 420) fleeY -= 0.7;
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
        sx: (tx - cam.worldView.x) * cam.zoom,
        sy: (ty - cam.worldView.y) * cam.zoom,
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
      if (!c.active || c.def.tier > s.seal.stage || c.puffed) continue;
      if (human && !cam.worldView.contains(c.x, c.y)) continue;
      if (!clear(c.x, c.y)) continue;
      const d = Math.hypot(c.x - m.x, c.y - m.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    // Lead the target a bit; otherwise drift toward the reef band.
    const lead = human ? 0 : 0.15;
    // No prey in sight: cruise along the reef band, or head up if rock is in the way.
    let tx = best ? best.x + best.motion.vx * lead : m.x + 300;
    let ty = best ? best.y + best.motion.vy * lead : 1100;
    if (!best && !clear(tx, ty)) {
      tx = m.x;
      ty = m.y - 300;
    }
    // Screen = (world - worldView) * zoom: the camera zooms out as the seal grows.
    return {
      dead: false,
      flee: false,
      boost: false,
      sx: (tx - cam.worldView.x) * cam.zoom,
      sy: (ty - cam.worldView.y) * cam.zoom,
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
    // BOT_SHOTS=1: a screenshot every 5 s (.playtest/bot-<t>.png) to see what it's doing.
    if (process.env.BOT_SHOTS) await page.screenshot({ path: `.playtest/bot-${Math.round(info.t)}.png` });
    console.log(
      `t=${info.t.toFixed(0).padStart(3)}s hunger=${info.hunger.toFixed(0).padStart(3)} score=${String(info.score).padStart(5)} eaten=${String(info.eaten).padStart(3)} stage=${info.stage} coins=${String(info.coins).padStart(3)} hazards=${info.hazards} predators=${info.predators} y=${info.zone.toFixed(0)}${info.flee ? ' FLEEING' : ''}`,
    );
  }
  await page.waitForTimeout(human ? 250 : 60);
}
await browser.close();
await server.close();
