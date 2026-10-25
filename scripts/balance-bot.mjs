// Balance probe: a greedy bot plays a run by chasing the nearest edible prey with the mouse,
// logging hunger/score/stage every 5 s. Use it to sanity-check tuning in config/balance.ts.
//
// Usage: npm run balance -- [human|perfect] [seconds] [upgradeLevel]   (default: human 150 0)
//   upgradeLevel = every upgrade at this level (0-5), to measure upgraded runs
//   human   = only on-screen prey, re-aims every 250 ms, no leading (roughly a decent player)
//   perfect = sees all prey, re-aims every 60 ms, leads targets (upper bound on skill)
//
// The human bot plays like a player who follows the hints: flees hunting predators upward
// (to leap out), boosts once one charges, gives pufferfish a wide berth unless they're
// catching their breath, and keeps a bigger berth from hazards as it grows.
//
// It chases the nearest meal; once big it skips prey worth less than half (a player learns
// that minnows barely feed a big seal) and hunts predators it has outgrown.
//
// Every 5 s it logs hunger, score, size, coins, hazards and predators around, frenzies so far
// and its position; the last line (DIED or ALIVE) adds seconds spent under 25% hunger, the
// time-averaged hunger and the hits taken by source.
//
// Reference numbers per map are in docs/GAME_DESIGN.md (Difficulty curve). Results vary a lot:
// take several samples. BOT_MAP=bay|arctic|tropical picks the map; BOT_PORT runs several at once.
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
const map = process.env.BOT_MAP ?? 'bay';
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// The whole save in one go, before the game loads: every upgrade at `level`, the map picked
// (unlocked via the old score unlock), no tutorial. (An init script runs again on every
// reload, so the map must be in it: an earlier version reloaded after picking the map and the
// script put the default map back, so upgraded runs always played Seal Bay.)
await page.addInitScript(
  ({ level, map }) => {
    const ids = ['speed', 'belly', 'metabolism', 'boost', 'jaws', 'magnet', 'frenzy'];
    const upgrades = Object.fromEntries(ids.map((id) => [id, level]));
    localStorage.setItem(
      'hungry-seal-save',
      JSON.stringify({
        version: 4,
        runs: 10,
        tutorialDone: true,
        upgrades,
        bestScore: 99999,
        maps: { selected: map, best: {} },
      }),
    );
  },
  { level: upgradeLevel, map },
);
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => window.__PHASER_GAME__?.scene.isActive('Menu'));
// Start the run directly (Play goes via the map select once you've played).
await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('Menu').scene.start('Game'));
await page.waitForFunction(() => window.__PHASER_GAME__?.scene.isActive('Game'));
await page.mouse.move(640, 360);

const human = (process.argv[2] ?? 'human') !== 'perfect';
const seconds = Number(process.argv[3] ?? 150);
console.log(
  `bot mode: ${human ? 'human' : 'perfect'}, upgrades ${upgradeLevel}, map ${await page.evaluate(
    () => window.__PHASER_GAME__.scene.getScene('Game').map.id,
  )} (asked for ${map})`,
);

const start = Date.now();
let lastLog = 0;
let boosting = false;
let last = null;
while (Date.now() - start < seconds * 1000) {
  const info = (last = await page.evaluate((human) => {
    const s = window.__PHASER_GAME__.scene.getScene('Game');
    // Tally hits by source (for the summary line), including a fatal one.
    window.__hits ??= {};
    if (s.lastHit && s.lastHit.at !== window.__lastHitAt) {
      window.__lastHitAt = s.lastHit.at;
      window.__hits[s.lastHit.source] = (window.__hits[s.lastHit.source] ?? 0) + 1;
    }
    // Hunger pressure over the run: seconds spent under 25% and the time-averaged level.
    const st0 = (window.__st ??= { last: s.elapsed, low: 0, sum: 0 });
    const dtE = Math.max(0, s.elapsed - st0.last);
    st0.last = s.elapsed;
    if (!s.dead) {
      if (s.hunger.fraction < 0.25) st0.low += dtE;
      st0.sum += s.hunger.fraction * dtE;
    }
    if (s.dead)
      return {
        dead: true,
        score: s.score,
        eaten: s.eaten,
        t: s.elapsed,
        stage: s.seal.stage,
        coins: s.runCoins,
        frenzies: s.frenzies,
        low: st0.low,
        avg: st0.sum / Math.max(1, s.elapsed),
        x: s.seal.x,
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
    // Stuck (barely moved for 1.5 s): back away from the rock along its normal, so under an
    // ice floe it dives instead of pushing up into the ice; in open water (no rock nearby,
    // e.g. riding the surface) it dives forward.
    const st = (window.__stuck ??= { at: s.elapsed, x: m.x, y: m.y, until: -1, tx: 0, ty: 0 });
    if (s.elapsed - st.at >= 1.5) {
      if (Math.hypot(m.x - st.x, m.y - st.y) < 70) {
        const n = terrain.normal(m.x, m.y, { x: 0, y: 0 });
        const nearRock = terrain.distance(m.x, m.y) < 120;
        st.until = s.elapsed + 1.2;
        st.tx = m.x + (nearRock ? n.x * 260 : 200) + (Math.random() - 0.5) * 300;
        st.ty = m.y + (nearRock ? n.y * 260 : 300);
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
        frenzies: s.frenzies,
        low: st0.low,
        avg: st0.sum / Math.max(1, s.elapsed),
        x: s.seal.x,
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
    // A bigger seal keeps a bigger berth (its body is up to 4x longer).
    const body = s.seal.radius * 1.2;
    for (const h of s.hazards.alive) if (h.active) avoid(h.x, h.y, 120 + body);
    for (const h of s.mapHazards.alive) if (h.active && h.visible) avoid(h.x, h.y, 100 + body);
    // A player stung once steers around puffed-up pufferfish, and gives the others room
    // unless they're catching their breath after a puff (the safe window to eat one).
    for (const c of s.spawner.alive) {
      if (!c.active || !c.params.puff) continue;
      if (c.puffed) avoid(c.x, c.y, 80 + body);
      // Not recovering: it puffs when the seal gets within ~170 px (plus its reach), so a
      // player who's been stung swings wide.
      else if (c.motion.puffCooldown < 0.5) avoid(c.x, c.y, 120 + body);
    }
    for (const p of s.predators.alive) {
      if (!p.active || p.def.tier <= s.seal.stage) continue;
      if (p.motion.state === 'notice' || p.motion.state === 'chase') {
        avoid(p.x, p.y, 420);
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        // Like the in-game hint says: head up and leap out (predators only hunt in water),
        // and boost once it charges (most hunters outswim a small seal).
        if (d < 420) fleeY -= 0.7;
        if (d < 300 || (p.motion.state === 'chase' && d < 420)) panic = true;
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
        frenzies: s.frenzies,
        low: st0.low,
        avg: st0.sum / Math.max(1, s.elapsed),
        x: s.seal.x,
      };
    }

    // Nearest meal in sight, like the original bot; a big seal skips prey it has long
    // outgrown (worth < half, see mealValue in systems/feeding.ts) while anything better is in
    // view, and hunts predators it has outgrown.
    let best = null;
    let bestD = Infinity;
    let fallback = null;
    let fallbackD = Infinity;
    const consider = (c) => {
      if (human && !cam.worldView.contains(c.x, c.y)) return;
      if (!clear(c.x, c.y)) return;
      const d = Math.hypot(c.x - m.x, c.y - m.y);
      const gap = Math.max(0, s.seal.stage - c.def.tier - 2);
      if (1 / (1 + 0.3 * gap) >= 0.5) {
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      } else if (d < fallbackD) {
        fallbackD = d;
        fallback = c;
      }
    };
    for (const c of s.spawner.alive) {
      if (!c.active || c.def.tier > s.seal.stage || c.puffed) continue;
      // Pufferfish only while they recover from a puff.
      if (c.params.puff && c.motion.puffCooldown < 0.5) continue;
      consider(c);
    }
    for (const p of s.predators.alive) {
      if (p.active && p.def.tier <= s.seal.stage) consider(p);
    }
    if (!best) {
      best = fallback;
      bestD = fallbackD;
    }
    // Lead the target a bit; otherwise drift toward the reef band.
    const lead = human ? 0 : 0.15;
    // No prey in sight: cruise along the reef band, or head up if rock is in the way.
    let tx = best ? best.x + best.motion.vx * lead : m.x + 300;
    let ty = best ? best.y + best.motion.vy * lead : 1100;
    if (!best && !clear(tx, ty)) {
      // Rock in the way: carry on at this depth, else turn back toward the cruising depth,
      // else dive forward, else go up (prefer staying where the food is to sinking deep).
      const options = [
        [m.x + 300, m.y],
        [m.x - 300, 1100],
        [m.x + 300, m.y + 300],
        [m.x, m.y - 300],
      ];
      [tx, ty] = options.find(([x, y]) => clear(x, y)) ?? options[3];
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
      frenzies: s.frenzies,
      low: st0.low,
      avg: st0.sum / Math.max(1, s.elapsed),
      x: s.seal.x,
    };
  }, human));
  if (info.dead) {
    const hits = await page.evaluate(() => window.__hits ?? {});
    console.log(
      `DIED (${info.cause}) at t=${info.t.toFixed(1)}s score=${info.score} eaten=${info.eaten} stage=${info.stage} coins=${info.coins} frenzies=${info.frenzies} under25%=${info.low.toFixed(0)}s avgHunger=${Math.round(info.avg * 100)}% hits=${JSON.stringify(hits)}`,
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
    if (process.env.BOT_SHOTS)
      await page.screenshot({ path: `.playtest/bot-${Math.round(info.t)}.png` });
    console.log(
      `t=${info.t.toFixed(0).padStart(3)}s hunger=${info.hunger.toFixed(0).padStart(3)} score=${String(info.score).padStart(5)} eaten=${String(info.eaten).padStart(3)} stage=${info.stage} coins=${String(info.coins).padStart(3)} hazards=${info.hazards} predators=${info.predators} frenzies=${info.frenzies} x=${info.x.toFixed(0)} y=${info.zone.toFixed(0)}${info.flee ? ' FLEEING' : ''}`,
    );
  }
  await page.waitForTimeout(human ? 250 : 60);
}
// Survived the whole time: the same summary as a death, so runs are easy to compare.
if (last && !last.dead) {
  const hits = await page.evaluate(() => window.__hits ?? {});
  console.log(
    `ALIVE at t=${last.t.toFixed(1)}s score=${last.score} eaten=${last.eaten} stage=${last.stage} coins=${last.coins} frenzies=${last.frenzies} under25%=${last.low.toFixed(0)}s avgHunger=${Math.round(last.avg * 100)}% hits=${JSON.stringify(hits)}`,
  );
}
await browser.close();
await server.close();
