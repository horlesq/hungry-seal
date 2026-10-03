// Automated smoke playtest: boots the game in headless Chrome, drives keyboard, mouse and
// multi-touch input, asserts on live game state and saves screenshots to .playtest/.
//
// Usage: npm run playtest     (exit code 1 on console errors or failed checks)
// Env:   PLAYTEST_BROWSER=chrome|msedge   (default chrome)
//        PLAYTEST_GL=gpu|swiftshader      (default gpu; swiftshader = software, ~15 FPS)
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const OUT = '.playtest';
const PORT = 5199;
// Movement/eating flows run with ?calm (no hazards or predators) so they're deterministic;
// the danger flow runs without it and places threats explicitly.
const URL = `http://localhost:${PORT}/?debug&calm`;
const DANGER_URL = `http://localhost:${PORT}/?debug`;
const GAME_W = 1280;
const GAME_H = 720;
// Spots on Seal Bay (the default map) for flows that need open water at a given depth.
const BAY = {
  /** Open water from the surface down to the trench floor. */
  diveColumn: { x: 9300, y: 900 },
  /** Open ocean just below the shallows. */
  ocean: { x: 7000, y: 2300 },
  /** Abyss water above the trench floor, under the cave rock. */
  abyss: { x: 10600, y: 6150 },
};

const errors = [];
const warnings = [];
const checks = [];

function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

function watch(page, label) {
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${label}] console.error: ${m.text()}`);
    if (m.type() === 'warning') warnings.push(`[${label}] console.warn: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`[${label}] HTTP ${r.status()}: ${r.url()}`);
  });
}

const sealState = (page) =>
  page.evaluate(() => {
    const game = window.__PHASER_GAME__;
    const scene = game.scene.getScene('Game');
    const m = scene.seal.motion;
    return {
      x: m.x,
      y: m.y,
      speed: m.speed,
      inWater: m.inWater,
      boosting: m.boosting,
      stamina: m.stamina,
      source: scene.controls.source,
      fps: game.loop.actualFps,
    };
  });

/** Polls seal state until `pred` holds or the timeout passes. Returns all samples. */
async function until(page, pred, timeout = 5000, every = 50) {
  const samples = [];
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const s = await sealState(page);
    samples.push(s);
    if (pred(s, samples)) return { ok: true, last: s, samples };
    await page.waitForTimeout(every);
  }
  return { ok: false, last: samples.at(-1), samples };
}

/** Gives the seal effectively infinite hunger for movement-only checks. */
const noStarve = (page) =>
  page.evaluate(() => {
    window.__PHASER_GAME__.scene.getScene('Game').hunger.value = 1e9;
  });

const runState = (page) =>
  page.evaluate(() => {
    const game = window.__PHASER_GAME__;
    const s = game.scene.getScene('Game');
    const hud = game.scene.getScene('Hud');
    return {
      score: s.score,
      eaten: s.eaten,
      hunger: s.hunger.value,
      stage: s.seal.stage,
      scaleX: Math.abs(s.seal.scaleX),
      speed: s.seal.motion.speed,
      creatures: s.spawner.countActive(),
      dead: s.dead,
      hudScore: hud.scene.isActive() ? hud.scoreText.text : null,
      hudStage: hud.scene.isActive() ? hud.stageText.text : null,
    };
  });

/**
 * Parks the seal so its mouth sits on a live creature (optionally forcing its tier), to
 * exercise the real eat/bump path deterministically. Returns the creature's tier or null.
 */
const feedOnce = (page, forceTier = null) =>
  page.evaluate((tier) => {
    const s = window.__PHASER_GAME__.scene.getScene('Game');
    const prey = s.spawner.alive.filter((c) => c.active && c.def.tier <= s.seal.stage);
    const c = prey[0];
    if (!c) return null;
    if (tier !== null) c.def = { ...c.def, tier };
    const m = s.seal.motion;
    m.heading = 0;
    m.speed = tier !== null ? 300 : 0;
    m.x = 0;
    m.y = 0;
    const vec = {
      x: 0,
      y: 0,
      set(x, y) {
        this.x = x;
        this.y = y;
        return this;
      },
    };
    const offset = s.seal.mouthPosition(vec).x;
    m.x = c.motion.x - offset;
    m.y = c.motion.y;
    c.motion.speed = 0;
    window.__lastTarget = c;
    window.__lastTargetMotion = c.motion;
    return c.def.tier;
  }, forceTier);

/**
 * Whether the creature targeted by the last feedOnce() is still alive. Creatures are pooled,
 * so also check it wasn't recycled into a new spawn (each spawn gets a new motion object).
 */
const targetAlive = (page) =>
  page.evaluate(
    () =>
      window.__lastTarget?.active === true &&
      window.__lastTarget.motion === window.__lastTargetMotion,
  );

/** Waits for a scene to be running; on timeout the error lists every scene's status. */
/** Moves the seal (and the camera) to (x, y). */
async function teleport(page, x, y) {
  await page.evaluate(
    ([x, y]) => {
      const s = window.__PHASER_GAME__.scene.getScene('Game');
      s.seal.motion.x = x;
      s.seal.motion.y = y;
      s.seal.setPosition(x, y);
      s.cameras.main.centerOn(x, y);
    },
    [x, y],
  );
}

/** World-y of the seabed (first rock) below (x, y) on the current map. */
async function groundBelow(page, x, y) {
  return page.evaluate(
    ([x, y]) => window.__PHASER_GAME__.scene.getScene('Game').map.terrain.groundBelow(x, y, 7000),
    [x, y],
  );
}

async function sceneActive(page, key) {
  try {
    await page.waitForFunction((k) => window.__PHASER_GAME__?.scene.isActive(k), key, {
      timeout: 15000,
    });
  } catch (err) {
    const states = await page
      .evaluate(() =>
        window.__PHASER_GAME__.scene.scenes
          .map((s) => `${s.sys.settings.key}:${s.sys.settings.status}`)
          .join(' '),
      )
      .catch(() => 'unavailable');
    throw new Error(`waiting for scene ${key} (statuses ${states}): ${err.message}`, {
      cause: err,
    });
  }
}

/**
 * Converts design coordinates (HUD space: 0..viewWidth x 0..viewHeight) to page coordinates.
 * Negative values count from the right/bottom edge.
 */
async function toPage(page, dx, dy) {
  const r = await page.evaluate(() => {
    const b = document.querySelector('canvas').getBoundingClientRect();
    const v = window.__PHASER_GAME__.registry.get('viewport');
    return {
      left: b.left,
      top: b.top,
      width: b.width,
      height: b.height,
      vw: v.viewWidth,
      vh: v.viewHeight,
    };
  });
  const x = dx < 0 ? r.vw + dx : dx;
  const y = dy < 0 ? r.vh + dy : dy;
  return { x: r.left + (x / r.vw) * r.width, y: r.top + (y / r.vh) * r.height };
}

/** Page position of a named UI Button (see ui/Button.ts) in a scene, found by name. */
async function buttonAt(page, sceneKey, name) {
  const p = await page.evaluate(
    ([key, n]) => {
      const find = (list) => {
        for (const o of list) {
          if (o.name === n) return o;
          const inner = o.list && find(o.list);
          if (inner) return inner;
        }
        return null;
      };
      const btn = find(window.__PHASER_GAME__.scene.getScene(key).children.list);
      if (!btn) return null;
      const m = btn.getWorldTransformMatrix();
      return { x: m.tx, y: m.ty };
    },
    [sceneKey, name],
  );
  if (!p) throw new Error(`button "${name}" not found in ${sceneKey}`);
  return toPage(page, p.x, p.y);
}

/** Clicks a named UI Button with the mouse. */
async function clickButton(page, sceneKey, name) {
  const p = await buttonAt(page, sceneKey, name);
  await page.mouse.click(p.x, p.y);
}

/** Canvas vs window: CSS box, backing pixels, and the current viewport. */
const canvasInfo = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('canvas');
    const b = c.getBoundingClientRect();
    return {
      left: b.left,
      top: b.top,
      cssW: b.width,
      cssH: b.height,
      backingW: c.width,
      backingH: c.height,
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      dpr: window.devicePixelRatio,
      view: window.__PHASER_GAME__.registry.get('viewport'),
    };
  });

/** The canvas fills the window exactly and renders at device pixels (capped at 2x). */
function fillsWindow(c) {
  const dpr = Math.min(2, c.dpr);
  return (
    Math.abs(c.left) < 1 &&
    Math.abs(c.top) < 1 &&
    Math.abs(c.cssW - c.innerW) < 1 &&
    Math.abs(c.cssH - c.innerH) < 1 &&
    Math.abs(c.backingW - Math.round(c.innerW * dpr)) <= 1 &&
    Math.abs(c.backingH - Math.round(c.innerH * dpr)) <= 1
  );
}

const fitDetail = (c) =>
  `css ${c.cssW}x${c.cssH} @(${c.left},${c.top}) window ${c.innerW}x${c.innerH} backing ${c.backingW}x${c.backingH} dpr ${c.dpr} view ${c.view.viewWidth.toFixed(0)}x${c.view.viewHeight.toFixed(0)}`;

async function screens(browser) {
  const cases = [
    { name: '16:9 monitor minus browser chrome', width: 1920, height: 950, dpr: 1 },
    { name: '16:9 at 125% Windows scaling', width: 1536, height: 760, dpr: 1.25 },
    { name: 'retina laptop', width: 1440, height: 800, dpr: 2 },
    { name: '4:3 tablet', width: 1024, height: 768, dpr: 2 },
  ];
  for (const c of cases) {
    const ctx = await browser.newContext({
      viewport: { width: c.width, height: c.height },
      deviceScaleFactor: c.dpr,
    });
    const page = await ctx.newPage();
    watch(page, `screen ${c.width}x${c.height}@${c.dpr}`);
    await page.goto(URL);
    await sceneActive(page, 'Menu');
    await page.keyboard.press('Enter');
    await sceneActive(page, 'Game');
    await sceneActive(page, 'Hud');
    await page.waitForTimeout(700);
    const info = await canvasInfo(page);
    check(`no bars, sharp canvas: ${c.name}`, fillsWindow(info), fitDetail(info));
    check(
      `desktop: world and UI share one zoom, no portrait layout: ${c.name}`,
      info.view.worldZoom === info.view.zoom && !info.view.portrait,
    );
    const hudInside = await page.evaluate(() => {
      const hud = window.__PHASER_GAME__.scene.getScene('Hud');
      const v = window.__PHASER_GAME__.registry.get('viewport');
      const b = hud.scoreText.getBounds();
      const pause = hud.pauseButton.getWorldTransformMatrix();
      return (
        pause.tx > v.viewWidth - 90 &&
        pause.ty < 90 &&
        b.right < pause.tx &&
        b.right > v.viewWidth - 200 &&
        b.top >= 0
      );
    });
    check(`score + pause pinned to the top-right: ${c.name}`, hudInside);
    if (c.width === 1920) {
      await page.screenshot({ path: `${OUT}/00-widescreen.png` });
      // Live resize (e.g. restoring a maximized window) re-fits everything.
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.waitForTimeout(400);
      const resized = await canvasInfo(page);
      check('canvas follows a window resize', fillsWindow(resized), fitDetail(resized));
      await page.screenshot({ path: `${OUT}/00-resized.png` });
    }
    await ctx.close();
  }
}

async function desktop(browser) {
  const ctx = await browser.newContext({ viewport: { width: GAME_W, height: GAME_H } });
  const page = await ctx.newPage();
  watch(page, 'desktop');
  await page.goto(URL);
  await sceneActive(page, 'Menu');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/01-menu.png` });

  await page.keyboard.press('Enter');
  await sceneActive(page, 'Game');
  await sceneActive(page, 'Hud');
  await page.waitForTimeout(700);
  check('game + hud scenes start from menu', true);
  const texturesOk = await page.evaluate(() =>
    ['seal', 'fx-bubble', 'bg-seabed-far', 'bg-depth-gradient'].every((k) =>
      window.__PHASER_GAME__.textures.exists(k),
    ),
  );
  check('placeholder + gradient textures exist', texturesOk);
  // Movement checks shouldn't be cut short by starving.
  await noStarve(page);

  // Swim right.
  const s0 = await sealState(page);
  await page.keyboard.down('d');
  const right = await until(page, (s) => s.x > s0.x + 300, 4000);
  await page.screenshot({ path: `${OUT}/02-swim-right.png` });
  await page.keyboard.up('d');
  check('keyboard swims right', right.ok, `dx=${(right.last.x - s0.x).toFixed(0)}`);
  check('input source = keyboard', right.last.source === 'keyboard', right.last.source);

  // Leap: boost straight up through the surface.
  await page.keyboard.down('w');
  await page.keyboard.down('Space');
  const leap = await until(page, (s) => !s.inWater && s.y < 560, 4000);
  if (leap.ok) await page.screenshot({ path: `${OUT}/03-leap.png` });
  await page.keyboard.up('Space');
  await page.keyboard.up('w');
  check(
    'boosting while holding Space',
    leap.samples.some((s) => s.boosting),
  );
  check('breaches the surface (airborne)', leap.ok, `y=${leap.last.y.toFixed(0)}`);
  const down = await until(page, (s) => s.inWater, 4000);
  check('splashes back into the water', down.ok);

  // Dive into the deep, then all the way to the seabed (from a deep, open part of the map).
  await teleport(page, BAY.diveColumn.x, BAY.diveColumn.y);
  await page.waitForTimeout(400);
  const top = await sealState(page);
  const ground = await groundBelow(page, top.x, top.y);
  await page.keyboard.down('s');
  const deep = await until(page, (s) => s.y > top.y + 1800, 10000);
  await page.screenshot({ path: `${OUT}/04-deep.png` });
  check('dives deep', deep.ok, `y=${deep.last.y.toFixed(0)}`);
  // The seal rests on the rock: within a body length above the ground, never inside it.
  const floor = await until(page, (s) => s.y >= ground - 400, 20000);
  await page.waitForTimeout(2000);
  const onFloor = await sealState(page);
  await page.keyboard.up('s');
  await page.screenshot({ path: `${OUT}/05-seabed.png` });
  // It may have slid along the slope: measure the ground under where it ended up.
  const under = await groundBelow(page, onFloor.x, onFloor.y - 120);
  check(
    'stops at the seabed',
    floor.ok && under !== null && onFloor.y < under - 5 && onFloor.y > under - 80,
    `y=${onFloor.y.toFixed(1)} ground=${under?.toFixed(0)}`,
  );

  // Mouse: seal swims toward the cursor without clicking (back in open water first).
  await teleport(page, BAY.diveColumn.x, 3000);
  await page.waitForTimeout(500);
  const leftPt = await toPage(page, 150, 360);
  const m0 = await sealState(page);
  await page.mouse.move(leftPt.x, leftPt.y, { steps: 5 });
  const mouse = await until(page, (s) => s.x < m0.x - 150, 4000);
  check('mouse steers toward cursor', mouse.ok, `dx=${(mouse.last.x - m0.x).toFixed(0)}`);
  check('input source = mouse', mouse.last.source === 'mouse', mouse.last.source);
  await page.mouse.down();
  const mb = await until(page, (s) => s.boosting, 1500);
  await page.mouse.up();
  check('mouse button boosts', mb.ok);

  // Debug toggle and back to menu.
  await page.keyboard.press('Backquote');
  const debugOff = await page.evaluate(() => window.__PHASER_GAME__.registry.get('debug'));
  check('backtick toggles debug off', debugOff === false);
  // Esc pauses: the world freezes under the pause overlay; Esc again resumes.
  await page.keyboard.press('Escape');
  await sceneActive(page, 'Pause');
  const p0 = await sealState(page);
  await page.waitForTimeout(400);
  const p1 = await sealState(page);
  const paused = await page.evaluate(() => window.__PHASER_GAME__.scene.isPaused('Game'));
  check('Esc pauses the run', paused && p0.x === p1.x && p0.y === p1.y);
  await page.screenshot({ path: `${OUT}/20-pause.png` });
  await page.keyboard.press('Escape');
  await sceneActive(page, 'Game');
  const resumed = await page.evaluate(() => {
    const g = window.__PHASER_GAME__.scene;
    return g.isActive('Game') && g.isActive('Hud') && !g.isActive('Pause');
  });
  check('Esc resumes the run', resumed);

  // The HUD pause button, then Quit to menu from the overlay.
  await page.waitForTimeout(200);
  await clickButton(page, 'Hud', 'pause');
  await sceneActive(page, 'Pause');
  check('HUD pause button pauses', true);
  // Controls take input once the overlay has faded in.
  await page.waitForTimeout(300);
  await clickButton(page, 'Pause', 'quit');
  await sceneActive(page, 'Menu');
  const hudStopped = await page.evaluate(() => {
    const g = window.__PHASER_GAME__.scene;
    return ['Game', 'Hud', 'Pause'].every((k) => !g.isActive(k) && !g.isPaused(k));
  });
  check('Quit to menu stops the run and HUD', hudStopped);

  // Re-enter to make sure scenes restart cleanly (listeners, textures).
  await page.keyboard.press('Enter');
  await sceneActive(page, 'Game');
  await page.waitForTimeout(500);
  const again = await sealState(page);
  check('game restarts cleanly', again.inWater && Number.isFinite(again.x));
  await page.waitForTimeout(1500);
  const fps = await page.evaluate(() => window.__PHASER_GAME__.loop.actualFps);
  console.log(`      desktop fps: ${fps.toFixed(0)}`);
  await ctx.close();
}

async function gameplay(browser) {
  const ctx = await browser.newContext({ viewport: { width: GAME_W, height: GAME_H } });
  const page = await ctx.newPage();
  watch(page, 'gameplay');
  await page.goto(URL);
  await sceneActive(page, 'Menu');
  await page.keyboard.press('Enter');
  await sceneActive(page, 'Game');
  await page.waitForTimeout(1000);

  // Spawning.
  const r0 = await runState(page);
  check('creatures spawn around the seal', r0.creatures >= 10, `${r0.creatures} alive`);
  const moved = await page.evaluate(async () => {
    const s = window.__PHASER_GAME__.scene.getScene('Game');
    const c = s.spawner.alive.find((x) => x.active);
    const x0 = c.x;
    await new Promise((r) => setTimeout(r, 400));
    return Math.abs(c.x - x0);
  });
  check('creatures swim', moved > 5, `moved ${moved.toFixed(0)}px`);
  await page.screenshot({ path: `${OUT}/07-creatures.png` });

  // Eating restores hunger and scores.
  await page.evaluate(() => {
    window.__PHASER_GAME__.scene.getScene('Game').hunger.value = 50;
  });
  // The idle seal may already have caught passing fish, so compare against a snapshot.
  const before = await runState(page);
  const tier = await feedOnce(page);
  await page.waitForTimeout(150);
  const r1 = await runState(page);
  check('found edible prey', tier !== null);
  check('the targeted prey gets eaten', !(await targetAlive(page)));
  check(
    'eating scores',
    r1.score > before.score && r1.eaten > before.eaten,
    `score ${before.score} -> ${r1.score}`,
  );
  check('eating restores hunger', r1.hunger > 50, `hunger=${r1.hunger.toFixed(1)}`);
  // The HUD rolls the score up over a few frames; wait for it to settle.
  const hudSynced = await page
    .waitForFunction(
      () => {
        const g = window.__PHASER_GAME__;
        return g.scene.getScene('Hud').scoreText.text === String(g.scene.getScene('Game').score);
      },
      null,
      { timeout: 3000 },
    )
    .then(() => true)
    .catch(() => false);
  check('HUD shows the score', hudSynced);

  // Prey above the seal's tier bumps instead of being eaten.
  await feedOnce(page, 5);
  await page.waitForTimeout(150);
  const r2 = await runState(page);
  check('too-big prey is not eaten', await targetAlive(page));
  check('bumping slows the seal', r2.speed < 200, `speed=${r2.speed.toFixed(0)}`);

  // Growth: set the meter one point short of stage 2; a real meal crosses the threshold.
  await page.evaluate(() => {
    const s = window.__PHASER_GAME__.scene.getScene('Game');
    s.growth.add(s.growth.pointsToNext - 1);
  });
  await feedOnce(page);
  await page.waitForTimeout(200);
  const r3 = await runState(page);
  check('eating fills growth to stage 2', r3.stage === 2, `stage=${r3.stage}`);
  check(
    'the seal gets bigger',
    r3.scaleX > r1.scaleX,
    `${r1.scaleX.toFixed(2)} -> ${r3.scaleX.toFixed(2)}`,
  );
  await page.waitForTimeout(700);
  const hudStage = (await runState(page)).hudStage;
  check('HUD shows the new size', hudStage === 'Size 2', `hud=${hudStage}`);
  await page.screenshot({ path: `${OUT}/08-grown.png` });

  // Natural drain.
  const h0 = (await runState(page)).hunger;
  await page.waitForTimeout(1000);
  const h1 = (await runState(page)).hunger;
  check('hunger drains over time', h1 < h0, `${h0.toFixed(1)} -> ${h1.toFixed(1)}`);

  // Starving ends the run and shows results.
  await page.evaluate(() => {
    window.__PHASER_GAME__.scene.getScene('Game').hunger.value = 0.01;
  });
  await sceneActive(page, 'GameOver');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/09-game-over.png` });
  const over = await page.evaluate(() => {
    const g = window.__PHASER_GAME__;
    return { dead: g.scene.getScene('Game').dead, hud: g.scene.isActive('Hud') };
  });
  check('starving shows game over', over.dead);

  // Retry restarts a fresh run.
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__PHASER_GAME__.scene.isActive('GameOver'), null, {
    timeout: 5000,
  });
  await sceneActive(page, 'Game');
  await page.waitForTimeout(800);
  const fresh = await runState(page);
  check(
    'retry starts a fresh run',
    !fresh.dead && fresh.score === 0 && fresh.stage === 1 && fresh.hunger > 95,
    `score=${fresh.score} stage=${fresh.stage} hunger=${fresh.hunger.toFixed(0)}`,
  );
  check('retry brings the HUD back', fresh.hudScore === '0');
  check('retry repopulates creatures', fresh.creatures >= 10, `${fresh.creatures} alive`);

  // Game over -> Esc goes to the menu and stops the run.
  await page.evaluate(() => {
    window.__PHASER_GAME__.scene.getScene('Game').hunger.value = 0.01;
  });
  await sceneActive(page, 'GameOver');
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  await sceneActive(page, 'Menu');
  const stopped = await page.evaluate(() => {
    const g = window.__PHASER_GAME__;
    return ['Game', 'Hud', 'GameOver'].every((k) => !g.scene.isActive(k));
  });
  check('Esc on game over returns to menu', stopped);
  await ctx.close();
}

/**
 * Runs `fn(scene, arg)` against the live GameScene inside the page. `fn` must return plain
 * data (or nothing): returning a game object makes Playwright serialize the whole scene
 * graph, which takes seconds while the game keeps running and skews timing checks.
 */
const inGame = (page, fn, arg = null) =>
  page.evaluate(
    ([src, a]) => {
      const scene = window.__PHASER_GAME__.scene.getScene('Game');
      return new Function('s', 'arg', `return (${src})(s, arg);`)(scene, a);
    },
    [fn.toString(), arg],
  );

/** Waits until the seal's post-hit invulnerability has worn off. */
const waitVulnerable = (page) =>
  page.waitForFunction(
    () => !window.__PHASER_GAME__.scene.getScene('Game').seal.isInvulnerable,
    null,
    { timeout: 5000 },
  );

async function danger(browser) {
  const ctx = await browser.newContext({ viewport: { width: GAME_W, height: GAME_H } });
  const page = await ctx.newPage();
  watch(page, 'danger');
  await page.goto(DANGER_URL);
  await sceneActive(page, 'Menu');
  await page.keyboard.press('Enter');
  await sceneActive(page, 'Game');
  await page.waitForTimeout(800);

  const early = await inGame(page, (s) => ({
    hazards: s.hazards.alive.length,
    predators: s.predators.alive.length,
  }));
  check('start of a run is safe', early.hazards === 0 && early.predators === 0);

  // Combo: three quick meals.
  for (let i = 0; i < 3; i++) {
    await feedOnce(page);
    await page.waitForTimeout(120);
  }
  const combo = await inGame(page, (s) => ({
    count: s.combo.count,
    mult: s.combo.multiplier,
    hud: window.__PHASER_GAME__.scene.getScene('Hud').comboRoot.visible,
  }));
  check('quick meals build a combo', combo.count >= 3 && combo.mult >= 2, `x${combo.mult}`);
  check('HUD shows the combo', combo.hud);

  // Coins popped next to the seal get collected.
  const coins0 = await inGame(page, (s) => s.runCoins);
  await inGame(page, (s) => s.coins.drop(s.seal.x + 30, s.seal.y, 3));
  await page.waitForTimeout(900);
  const coins1 = await inGame(page, (s) => ({
    run: s.runCoins,
    hud: window.__PHASER_GAME__.scene.getScene('Hud').coinText.text,
  }));
  check('coins are collected', coins1.run >= coins0 + 3, `${coins0} -> ${coins1.run}`);
  check('HUD shows coins', coins1.hud === String(coins1.run), `hud=${coins1.hud}`);

  // Jellyfish: damage, stun, knockback, invulnerability, combo reset.
  const setHunger = (v) => inGame(page, (s, value) => (s.hunger.value = value), v);
  await setHunger(80);
  await inGame(page, (s) => void s.hazards.spawnAt('jellyfish', s.seal.x, s.seal.y));
  await page.waitForTimeout(200);
  const stung = await inGame(page, (s) => ({
    hunger: s.hunger.value,
    stunned: s.seal.isStunned,
    invuln: s.seal.isInvulnerable,
    combo: s.combo.count,
    vignette: window.__PHASER_GAME__.scene.getScene('Hud').vignette.alpha,
  }));
  await page.screenshot({ path: `${OUT}/10-stung.png` });
  check(
    'jellyfish stings (hunger damage)',
    stung.hunger <= 70,
    `hunger=${stung.hunger.toFixed(1)}`,
  );
  check('jellyfish stuns the seal', stung.stunned);
  check('hit grants invulnerability', stung.invuln);
  check('getting hurt breaks the combo', stung.combo === 0);
  check(
    'hurt flashes the red vignette',
    stung.vignette > 0.2,
    `alpha=${stung.vignette.toFixed(2)}`,
  );

  const h0 = stung.hunger;
  await inGame(page, (s) => void s.hazards.spawnAt('jellyfish', s.seal.x, s.seal.y));
  await page.waitForTimeout(200);
  const h1 = await inGame(page, (s) => s.hunger.value);
  check('no damage while invulnerable', h1 > h0 - 3, `${h0.toFixed(1)} -> ${h1.toFixed(1)}`);

  // Mine: big damage and it's gone afterwards.
  await inGame(page, (s) => s.hazards.alive.forEach((h) => h.despawn()));
  await waitVulnerable(page);
  await setHunger(80);
  await inGame(page, (s) => {
    window.__mine = s.hazards.spawnAt('mine', s.seal.x, s.seal.y);
  });
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${OUT}/11-mine.png` });
  await page.waitForTimeout(200);
  const boom = await inGame(page, (s) => ({ hunger: s.hunger.value, mine: window.__mine.active }));
  check('mine explodes (big damage)', boom.hunger <= 55, `hunger=${boom.hunger.toFixed(1)}`);
  check('mine is used up', !boom.mine);

  // Shark: telegraph, chase, bite (in open water, clear of the reef).
  await teleport(page, BAY.ocean.x, BAY.ocean.y);
  await page.waitForTimeout(500);
  await waitVulnerable(page);
  await setHunger(80);
  await inGame(page, (s) => {
    window.__shark = s.predators.spawnAt('shark', s.seal.x - 320, s.seal.y, 0);
  });
  const states = new Set();
  let bitten = false;
  let telegraphShot = false;
  const until = Date.now() + 6000;
  while (Date.now() < until && !bitten) {
    const st = await inGame(page, (s) => ({
      state: window.__shark.motion.state,
      hunger: s.hunger.value,
    }));
    states.add(st.state);
    if (st.state === 'notice' && !telegraphShot) {
      telegraphShot = true;
      await page.screenshot({ path: `${OUT}/12-shark-telegraph.png` });
    }
    bitten = st.hunger < 60;
    await page.waitForTimeout(40);
  }
  const afterBite = await inGame(page, () => window.__shark.motion.state);
  check('shark telegraphs before attacking', states.has('notice'));
  check('shark chases', states.has('chase'));
  check('shark bite hurts', bitten);
  check('shark swims off after biting', afterBite === 'recover', afterBite);

  // Death by shark shows the right title and banks the run.
  await waitVulnerable(page);
  await inGame(page, (s) => {
    s.hunger.value = 5;
    const m = window.__shark.motion;
    m.state = 'chase';
    m.stateTime = 0;
    m.cooldown = 0;
    m.x = s.seal.x - 200;
    m.y = s.seal.y;
    m.heading = 0;
  });
  await sceneActive(page, 'GameOver');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/13-chomped.png` });
  const over = await page.evaluate(() => {
    const go = window.__PHASER_GAME__.scene.getScene('GameOver');
    const texts = [];
    const walk = (list) =>
      list.forEach((o) => {
        if (o.type === 'Text') texts.push(o.text);
        if (o.list) walk(o.list);
      });
    walk(go.children.list);
    return { texts, save: JSON.parse(localStorage.getItem('hungry-seal-save') ?? 'null') };
  });
  check('killed by shark shows Chomped!', over.texts.includes('Chomped!'));
  check('first run is a new best', over.texts.includes('New best!'));
  check(
    'run is saved (coins, best, runs)',
    over.save?.runs === 1 && over.save.coins >= 3 && over.save.bestScore > 0,
    JSON.stringify(over.save),
  );

  // Saved progress shows on the menu after a reload.
  await page.reload();
  await sceneActive(page, 'Menu');
  const menuTexts = await page.evaluate(() =>
    window.__PHASER_GAME__.scene
      .getScene('Menu')
      .children.list.filter((o) => o.type === 'Text')
      .map((o) => o.text),
  );
  check(
    'menu shows best score and coins after reload',
    menuTexts.some((t) => t.startsWith('Best ')),
    menuTexts.find((t) => t.startsWith('Best ')) ?? 'missing',
  );
  await ctx.close();
}

/** Phase 4: audio, mute, shop + upgrades, first-run hints, new creatures, frenzy, zones. */
async function phase4(browser) {
  const ctx = await browser.newContext({ viewport: { width: GAME_W, height: GAME_H } });
  // Start from an old v1 save with coins and no runs: exercises migration + the shop.
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('hungry-seal-save')) {
      localStorage.setItem(
        'hungry-seal-save',
        JSON.stringify({ version: 1, coins: 500, bestScore: 0, runs: 0 }),
      );
    }
  });
  const page = await ctx.newPage();
  watch(page, 'phase4');
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('hungry-seal-save')));

  await page.goto(URL);
  await sceneActive(page, 'Menu');
  await page.waitForTimeout(400);
  const audioOk = await page.evaluate(() => {
    const g = window.__PHASER_GAME__;
    return ['sfx-chomp', 'sfx-coin', 'sfx-splash', 'sfx-frenzy', 'music-ocean'].every((k) =>
      g.cache.audio.exists(k),
    );
  });
  check('synthesized sounds + music are registered', audioOk);

  // Sound toggle (menu) persists.
  await clickButton(page, 'Menu', 'sound');
  // (Phaser's sound.mute can't be read reliably before audio unlocks; check our state.)
  const soundIcon = () =>
    page.evaluate(() => {
      const menu = window.__PHASER_GAME__.scene.getScene('Menu');
      return menu.children.getByName('sound').icon.texture.key;
    });
  const muted = (await save()).settings?.muted;
  check('sound button mutes', muted === true && (await soundIcon()) === 'ui-sound-off');
  await page.reload();
  await sceneActive(page, 'Menu');
  await page.waitForTimeout(300);
  check(
    'mute persists across reloads',
    (await save()).settings.muted === true && (await soundIcon()) === 'ui-sound-off',
  );
  await clickButton(page, 'Menu', 'sound'); // back on

  // Coins to spend: the Upgrades button carries a badge.
  const badge = await page.evaluate(
    () =>
      window.__PHASER_GAME__.scene.getScene('Menu').children.getByName('upgrades').badge.visible,
  );
  check('menu badges Upgrades when something is affordable', badge);

  // Keyboard: the first arrow press shows focus on Play, the next moves it to Upgrades.
  // (Reload first: hovering the sound button moved focus there, as intended.)
  await page.mouse.move(5, 5);
  await page.reload();
  await sceneActive(page, 'Menu');
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const ring = await page.evaluate(
    () => window.__PHASER_GAME__.scene.getScene('Menu').children.getByName('upgrades').ring.visible,
  );
  check('arrow keys move a visible focus ring', ring);
  await page.screenshot({ path: `${OUT}/21-menu-focus.png` });
  await page.keyboard.press('Enter');
  await sceneActive(page, 'Shop');
  check('Enter activates the focused button (Upgrades)', true);
  await page.waitForTimeout(500);

  // Buy Big Belly.
  await clickButton(page, 'Shop', 'buy-belly');
  await page.waitForTimeout(300);
  const bought = await save();
  check(
    'shop: buying an upgrade spends coins',
    bought.upgrades?.belly === 1 && bought.coins === 440,
    `belly=${bought.upgrades?.belly} coins=${bought.coins}`,
  );
  await page.screenshot({ path: `${OUT}/14-shop.png` });
  const cards = await page.evaluate(
    () => window.__PHASER_GAME__.scene.getScene('Shop').cards.length,
  );
  check('shop lists all 7 upgrades', cards === 7, `${cards} cards`);
  await clickButton(page, 'Shop', 'play');
  await sceneActive(page, 'Game');
  await sceneActive(page, 'Hud');
  await page.waitForTimeout(900);
  const hungerMax = await inGame(page, (s) => s.hunger.max);
  check('upgrade applies in the run (+12 max hunger)', hungerMax === 112, `max=${hungerMax}`);

  const hint = await page.evaluate(() => {
    const hud = window.__PHASER_GAME__.scene.getScene('Hud');
    return { alpha: hud.hintRoot.alpha, text: hud.hintText.text };
  });
  check(
    'first run shows a how-to-swim hint',
    hint.alpha > 0.5 && /swim/i.test(hint.text),
    hint.text,
  );
  await page.screenshot({ path: `${OUT}/15-hint.png` });

  // New creatures (spawned right next to the seal).
  await noStarve(page);
  await inGame(page, (s) => {
    const { x, y } = s.seal;
    ['squid', 'penguin', 'turtle'].forEach((id, i) =>
      s.spawner.spawnAt(id, x + 220 + i * 130, y + 90, Math.PI),
    );
    s.spawner.spawnAt('seabird', x + 160, 560, Math.PI);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/16-new-creatures.png` });
  await page.waitForTimeout(2200);
  const birds = await inGame(page, (s) =>
    s.spawner.alive.filter((c) => c.active && c.def.id === 'seabird').map((c) => c.y),
  );
  check(
    'seabirds stay above the water',
    birds.length > 0 && birds.every((y) => y < 640),
    `y=${birds.map((y) => y.toFixed(0)).join(',')}`,
  );

  // Frenzy: fill the meter, one more meal starts it.
  await inGame(page, (s) => {
    s.frenzy.meter = 0.99;
  });
  await feedOnce(page);
  await page.waitForTimeout(150);
  const fr = await inGame(page, (s) => ({ active: s.frenzy.active, hud: s.frenzy.meter }));
  check('a full meter starts a frenzy', fr.active);
  await inGame(page, (s) => {
    window.__shark = s.predators.spawnAt('shark', s.seal.x + 260, s.seal.y, Math.PI);
  });
  await page.waitForTimeout(300);
  const sharkState = await page.evaluate(() => window.__shark.motion.state);
  check('frenzy: sharks flee', sharkState === 'flee', sharkState);
  await inGame(page, (s) => {
    const p = window.__shark;
    const m = s.seal.motion;
    m.heading = 0;
    m.speed = 0;
    m.x = 0;
    m.y = 0;
    const vec = {
      x: 0,
      y: 0,
      set(x, y) {
        this.x = x;
        this.y = y;
        return this;
      },
    };
    const offset = s.seal.mouthPosition(vec).x;
    m.x = p.motion.x - offset;
    m.y = p.motion.y;
    p.motion.speed = 0;
    window.__sharkMotion = p.motion;
  });
  await page.waitForTimeout(250);
  const sharkEaten = await page.evaluate(
    () => !(window.__shark.active && window.__shark.motion === window.__sharkMotion),
  );
  check('frenzy: sharks can be eaten', sharkEaten);
  const h0 = await inGame(page, (s) => {
    s.hunger.value = 80;
    window.__jelly = s.hazards.spawnAt('jellyfish', s.seal.x, s.seal.y);
    return s.hunger.value;
  });
  await page.waitForTimeout(250);
  const smash = await inGame(page, (s) => ({
    hunger: s.hunger.value,
    jelly: window.__jelly.active,
  }));
  check(
    'frenzy: hazards are smashed without damage',
    !smash.jelly && smash.hunger > h0 - 3,
    `hunger ${h0} -> ${smash.hunger.toFixed(1)}`,
  );
  await page.screenshot({ path: `${OUT}/17-frenzy.png` });

  // Zone banner on entering the open ocean.
  await teleport(page, BAY.ocean.x, BAY.ocean.y);
  await page.waitForTimeout(700);
  const banner = await page.evaluate(() => {
    const hud = window.__PHASER_GAME__.scene.getScene('Hud');
    return { alpha: hud.bannerRoot.alpha, title: hud.bannerTitle.text };
  });
  check(
    'zone banner on entering the open ocean',
    banner.alpha > 0.5 && banner.title === 'Open Ocean',
    banner.title,
  );
  await page.screenshot({ path: `${OUT}/18-zone-banner.png` });
  await ctx.close();
}

/** Phase 5: zoom by size, darkness + glows, new creatures/predators, pickups. */
async function phase5(browser) {
  const ctx = await browser.newContext({ viewport: { width: GAME_W, height: GAME_H } });
  const page = await ctx.newPage();
  watch(page, 'phase5');
  await page.goto(URL);
  await sceneActive(page, 'Menu');
  await page.keyboard.press('Enter');
  await sceneActive(page, 'Game');
  await page.waitForTimeout(800);
  await noStarve(page);

  // Growing to max size pulls the camera back.
  const zoom0 = await inGame(page, (s) => s.cameras.main.zoom);
  await inGame(page, (s) => {
    s.growth.add(10_000);
    s.seal.setStage(s.growth.stage);
  });
  await page.waitForTimeout(3000);
  const zoom1 = await inGame(page, (s) => s.cameras.main.zoom);
  check(
    'camera zooms out as the seal grows',
    zoom1 < zoom0 * 0.88,
    `${zoom0.toFixed(2)} -> ${zoom1.toFixed(2)}`,
  );

  // Pufferfish puffs up near the seal and stings when eaten puffed.
  await inGame(page, (s) => {
    window.__puffer = s.spawner.spawnAt('pufferfish', s.seal.x + 120, s.seal.y);
    window.__pufferMotion = window.__puffer.motion;
  });
  await page.waitForTimeout(400);
  const puffed = await page.evaluate(() => window.__puffer.puffed);
  check('pufferfish puffs up near the seal', puffed === true);
  const hBefore = await inGame(page, (s) => {
    s.hunger.value = 60;
    const c = window.__puffer;
    const m = s.seal.motion;
    m.heading = 0;
    m.speed = 0;
    m.x = 0;
    m.y = 0;
    const vec = {
      x: 0,
      y: 0,
      set(x, y) {
        this.x = x;
        this.y = y;
        return this;
      },
    };
    const offset = s.seal.mouthPosition(vec).x;
    m.x = c.motion.x - offset;
    m.y = c.motion.y;
    c.motion.speed = 0;
    return s.hunger.value;
  });
  await page.waitForTimeout(300);
  const sting = await inGame(page, (s) => ({
    eaten: !(window.__puffer.active && window.__puffer.motion === window.__pufferMotion),
    source: s.lastHit?.source,
  }));
  check(
    'eating a puffed pufferfish stings',
    sting.eaten && sting.source === 'pufferfish',
    JSON.stringify(sting),
  );
  await page.waitForFunction(
    () => !window.__PHASER_GAME__.scene.getScene('Game').seal.isInvulnerable,
    null,
    { timeout: 5000 },
  );
  void hBefore;

  // Orcas hunt even a max-size seal; anglerfish flee from it.
  await inGame(page, (s) => {
    window.__orca = s.predators.spawnAt('orca', s.seal.x - 380, s.seal.y, 0);
  });
  await page.waitForTimeout(400);
  const orcaState = await page.evaluate(() => window.__orca.motion.state);
  check(
    'orca hunts even a max-size seal',
    orcaState === 'notice' || orcaState === 'chase',
    orcaState,
  );
  await inGame(page, (s) => {
    window.__orca.despawn();
    window.__angler = s.predators.spawnAt('anglerfish', s.seal.x + 200, s.seal.y, Math.PI);
  });
  await page.waitForTimeout(400);
  const anglerState = await page.evaluate(() => window.__angler.motion.state);
  check('anglerfish flees a seal big enough to eat it', anglerState === 'flee', anglerState);

  // Pickups: chest bursts into coins, magnet orb powers up.
  const before = await inGame(page, (s) => ({ score: s.score, coins: s.runCoins }));
  await inGame(page, (s) => {
    s.pickups.spawnAt('chest', s.seal.x + 30, s.seal.y);
  });
  await page.waitForTimeout(1500);
  const afterChest = await inGame(page, (s) => ({ score: s.score, coins: s.runCoins }));
  check(
    'treasure chest pays out coins and score',
    afterChest.score >= before.score + 150 && afterChest.coins >= before.coins + 10,
    `coins ${before.coins} -> ${afterChest.coins}`,
  );
  await inGame(page, (s) => {
    s.pickups.spawnAt('magnet', s.seal.x + 20, s.seal.y);
  });
  await page.waitForTimeout(300);
  const magnet = await inGame(page, (s) => s.magnetLeft);
  check('magnet orb gives a coin magnet', magnet > 5, `${magnet.toFixed(1)}s`);

  // The abyss: dark, lit by glows; crabs walk the seabed.
  // Teleport first and let the camera arrive; things spawned far from the camera are
  // recycled immediately (as they should be in real play).
  await teleport(page, BAY.abyss.x, BAY.abyss.y);
  await page.waitForTimeout(1800);
  await inGame(page, (s) => {
    const t = s.map.terrain;
    const g = (x) => t.groundBelow(x, s.seal.y, 1500) ?? s.seal.y + 200;
    s.spawner.spawnAt('crab', s.seal.x + 160, g(s.seal.x + 160) - 60, Math.PI);
    s.spawner.spawnAt('lanternfish', s.seal.x - 200, s.seal.y - 100, 0);
    s.predators.spawnAt('anglerfish', s.seal.x + 380, s.seal.y - 150, Math.PI);
    s.pickups.spawnAt('chest', s.seal.x - 300, g(s.seal.x - 300) - 24);
  });
  await page.waitForTimeout(1500);
  const deep = await inGame(page, (s) => ({
    dark: s.darkness.level,
    // Each crab's height above the ground right under it.
    crabs: s.spawner.alive
      .filter((c) => c.active && c.def.id === 'crab')
      .map((c) => Math.round((s.map.terrain.groundBelow(c.x, c.y - 40, 400) ?? 1e9) - c.y)),
  }));
  check('the abyss is dark', deep.dark > 0.6, `darkness=${deep.dark.toFixed(2)}`);
  check(
    'crabs walk on the seabed',
    deep.crabs.length > 0 && deep.crabs.every((h) => h >= 0 && h <= 24),
    `above ground=${deep.crabs.join(',')}`,
  );
  await page.screenshot({ path: `${OUT}/19-abyss.png` });
  await ctx.close();
}

async function mobile(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 915, height: 412 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  watch(page, 'mobile');
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, points) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id })),
    });

  await page.goto(URL);
  await sceneActive(page, 'Menu');
  await page.waitForTimeout(400);
  const fit = await canvasInfo(page);
  check('touch: canvas fills the phone screen', fillsWindow(fit), fitDetail(fit));
  check(
    'landscape phone: ocean zoomed out, UI as on desktop',
    !fit.view.portrait &&
      fit.view.worldZoom < fit.view.zoom * 0.9 &&
      Math.abs(fit.view.viewHeight - 720) < 1,
    `zoom ${fit.view.zoom.toFixed(2)} world ${fit.view.worldZoom.toFixed(2)}`,
  );
  await page.screenshot({ path: `${OUT}/22-mobile-menu.png` });
  const playBtn = await buttonAt(page, 'Menu', 'play');
  await page.touchscreen.tap(playBtn.x, playBtn.y);
  await sceneActive(page, 'Game');
  await page.waitForTimeout(700);
  await noStarve(page);

  const boostVisible = await page.evaluate(
    () => window.__PHASER_GAME__.scene.getScene('Hud').boostButton.visible,
  );
  check('touch: boost button visible', boostVisible);

  const s0 = await sealState(page);
  // Floating joystick: touch down in the lower-left, then drag right.
  const down = await toPage(page, 260, 500);
  const right = { x: down.x + 80, y: down.y };
  await touch('touchStart', [{ ...down, id: 1 }]);
  await page.waitForTimeout(300);
  const resting = await sealState(page);
  check(
    'touch: a finger resting where it landed does not steer',
    resting.speed < 60,
    `speed=${resting.speed.toFixed(0)}`,
  );
  await touch('touchMove', [{ ...right, id: 1 }]);
  const hold = await until(page, (s) => s.x > s0.x + 200, 4000);
  check(
    'touch: dragging the joystick right swims right',
    hold.ok,
    `dx=${(hold.last.x - s0.x).toFixed(0)}`,
  );
  check('input source = touch', hold.last.source === 'touch', hold.last.source);
  const stick = await page.evaluate(() => {
    const hud = window.__PHASER_GAME__.scene.getScene('Hud');
    return {
      visible: hud.stick.visible,
      alpha: hud.stick.alpha,
      x: hud.stick.x,
      knob: hud.stickKnob.x,
    };
  });
  check(
    'touch: the joystick shows under the finger',
    stick.visible && stick.alpha > 0.8 && Math.abs(stick.x - 260) < 60 && stick.knob > 40,
    JSON.stringify(stick),
  );
  await page.screenshot({ path: `${OUT}/24-mobile-stick.png` });

  // Second finger on the boost button while still steering with the first.
  // Boost button centre: 118 design units in from the bottom-right corner.
  const boostBtn = await toPage(page, -118, -118);
  await touch('touchStart', [
    { ...right, id: 1 },
    { ...boostBtn, id: 2 },
  ]);
  const boost = await until(page, (s) => s.boosting, 2000);
  await page.waitForTimeout(250);
  const s2 = await sealState(page);
  await page.screenshot({ path: `${OUT}/06-mobile-boost.png` });
  check('touch: boost button boosts while steering', boost.ok);
  check('touch: boost finger does not steer', s2.x > boost.last.x, `still heading right`);
  await touch('touchEnd', []);
  const stop = await until(page, (s) => s.speed < 5, 5000);
  check('touch: release glides to a stop', stop.ok, `speed=${stop.last.speed.toFixed(1)}`);
  const idle = await page.evaluate(() => window.__PHASER_GAME__.scene.getScene('Hud').stick.alpha);
  check('touch: releasing returns the joystick to its faint hint', idle < 0.5, `alpha=${idle}`);

  // Tapping the pause button pauses without steering; Resume carries on.
  const before = await sealState(page);
  const pauseBtn = await buttonAt(page, 'Hud', 'pause');
  await page.touchscreen.tap(pauseBtn.x, pauseBtn.y);
  await sceneActive(page, 'Pause');
  const still = await sealState(page);
  check(
    'touch: pause button pauses without steering',
    Math.hypot(still.x - before.x, still.y - before.y) < 20,
    `moved ${Math.hypot(still.x - before.x, still.y - before.y).toFixed(1)}`,
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/23-mobile-pause.png` });
  const resumeBtn = await buttonAt(page, 'Pause', 'resume');
  await page.touchscreen.tap(resumeBtn.x, resumeBtn.y);
  await sceneActive(page, 'Game');
  const back = await page.evaluate(() => !window.__PHASER_GAME__.scene.isActive('Pause'));
  check('touch: Resume returns to the run', back);
  await ctx.close();
}

/** Upright phone: portrait UI layout, everything on screen and nothing overlapping. */
async function portrait(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  });
  await ctx.addInitScript(() => {
    localStorage.setItem(
      'hungry-seal-save',
      JSON.stringify({ version: 2, coins: 400, bestScore: 900, runs: 2, tutorialDone: true }),
    );
  });
  const page = await ctx.newPage();
  watch(page, 'portrait');
  await page.goto(URL);
  await sceneActive(page, 'Menu');
  await page.waitForTimeout(1600);
  const fit = await canvasInfo(page);
  check('portrait: canvas fills the screen', fillsWindow(fit), fitDetail(fit));
  check(
    'portrait: UI laid out 720 wide (text as big as in landscape)',
    fit.view.portrait && Math.abs(fit.view.viewWidth - 720) < 1,
    `view ${fit.view.viewWidth.toFixed(0)}x${fit.view.viewHeight.toFixed(0)}`,
  );
  check(
    'portrait: ocean shows ~850 units across (was 1280)',
    fit.view.width / fit.view.worldZoom < 900,
    `${(fit.view.width / fit.view.worldZoom).toFixed(0)} wide`,
  );

  /** Bounds (design units) of named objects in a scene; each must lie inside the view. */
  const bounds = (key, names) =>
    page.evaluate(
      ([k, list]) => {
        const scene = window.__PHASER_GAME__.scene.getScene(k);
        const find = (objs, n) => {
          for (const o of objs) {
            if (o.name === n) return o;
            const inner = o.list && find(o.list, n);
            if (inner) return inner;
          }
          return null;
        };
        return Object.fromEntries(
          list.map((n) => {
            const o = find(scene.children.list, n);
            if (!o) return [n, null];
            const b = o.getBounds();
            return [n, { left: b.left, right: b.right, top: b.top, bottom: b.bottom }];
          }),
        );
      },
      [key, names],
    );
  const inside = (b) =>
    b &&
    b.left >= -1 &&
    b.right <= fit.view.viewWidth + 1 &&
    b.top >= -1 &&
    b.bottom <= fit.view.viewHeight + 1;
  const apart = (a, b) =>
    a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;

  const menu = await bounds('Menu', ['wordmark', 'play', 'upgrades', 'coins', 'sound']);
  check(
    'portrait menu: everything on screen',
    Object.values(menu).every(inside),
    JSON.stringify(menu),
  );
  check('portrait menu: title clear of the buttons', apart(menu.wordmark, menu.play));
  await page.screenshot({ path: `${OUT}/25-portrait-menu.png` });

  const up = await buttonAt(page, 'Menu', 'upgrades');
  await page.touchscreen.tap(up.x, up.y);
  await sceneActive(page, 'Shop');
  await page.waitForTimeout(500);
  const shop = await bounds('Shop', ['back', 'coins', 'play', 'buy-speed', 'buy-frenzy']);
  check(
    'portrait upgrades: one column, all on screen',
    Object.values(shop).every(inside),
    JSON.stringify(shop),
  );
  await page.screenshot({ path: `${OUT}/26-portrait-shop.png` });

  const play = await buttonAt(page, 'Shop', 'play');
  await page.touchscreen.tap(play.x, play.y);
  await sceneActive(page, 'Hud');
  await page.waitForTimeout(900);
  const hud = await page.evaluate(() => {
    const h = window.__PHASER_GAME__.scene.getScene('Hud');
    const box = (o) => {
      const b = o.getBounds();
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
    };
    return {
      status: box(h.status),
      score: box(h.scoreText),
      pause: box(h.pauseButton),
      comboY: h.comboRoot.y,
    };
  });
  check(
    'portrait HUD: status, score and pause fit side by side',
    [hud.status, hud.score, hud.pause].every(inside) &&
      apart(hud.status, hud.score) &&
      apart(hud.score, hud.pause),
    JSON.stringify(hud),
  );
  check('portrait HUD: combo sits below the status panel', hud.comboY > hud.status.bottom);
  await page.screenshot({ path: `${OUT}/27-portrait-hud.png` });

  await page.evaluate(() => {
    window.__PHASER_GAME__.scene.getScene('Game').hunger.value = 0.01;
  });
  await sceneActive(page, 'GameOver');
  await page.waitForTimeout(2200);
  const over = await bounds('GameOver', ['retry', 'upgrades', 'menu']);
  check(
    'portrait results: stacked buttons on screen, not overlapping',
    Object.values(over).every(inside) &&
      apart(over.retry, over.upgrades) &&
      apart(over.upgrades, over.menu),
    JSON.stringify(over),
  );
  await page.screenshot({ path: `${OUT}/28-portrait-results.png` });
  await ctx.close();
}

/** Skins: buy with coins, can't buy what you can't afford, equip, and the run uses it. */
async function skins(browser) {
  const ctx = await browser.newContext({ viewport: { width: GAME_W, height: GAME_H } });
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('hungry-seal-save')) {
      localStorage.setItem(
        'hungry-seal-save',
        JSON.stringify({ version: 2, coins: 700, bestScore: 100, runs: 3, tutorialDone: true }),
      );
    }
  });
  const page = await ctx.newPage();
  watch(page, 'skins');
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('hungry-seal-save')));
  const settle = () => page.waitForTimeout(250);
  await page.goto(URL);
  await sceneActive(page, 'Menu');
  await page.waitForTimeout(400);
  const migrated = await save();
  check(
    'skins: an old save starts with the harbor seal',
    migrated === null || migrated.skins === undefined || migrated.skins.equipped === 'harbor',
  );

  await clickButton(page, 'Menu', 'skins');
  await sceneActive(page, 'Skins');
  await page.waitForTimeout(400);
  await clickButton(page, 'Skins', 'skin-arctic');
  await settle();
  await clickButton(page, 'Skins', 'buy');
  await settle();
  const bought = await save();
  check(
    'skins: buying spends coins and wears the skin',
    bought.coins === 400 &&
      bought.skins.owned.includes('arctic') &&
      bought.skins.equipped === 'arctic',
    JSON.stringify({ coins: bought.coins, skins: bought.skins }),
  );
  const preview = await page.evaluate(
    () => window.__PHASER_GAME__.scene.getScene('Skins').preview.texture.key,
  );
  check('skins: the preview shows the selected skin', preview === 'seal-arctic', preview);

  await clickButton(page, 'Skins', 'skin-elephant');
  await settle();
  const locked = await page.evaluate(() => {
    const sc = window.__PHASER_GAME__.scene.getScene('Skins');
    return { buyEnabled: sc.buy.isEnabled, buyVisible: sc.buy.visible };
  });
  check('skins: an unaffordable skin cannot be bought', locked.buyVisible && !locked.buyEnabled);
  await page.screenshot({ path: `${OUT}/29-skins.png` });

  await clickButton(page, 'Skins', 'skin-harbor');
  await settle();
  await clickButton(page, 'Skins', 'equip');
  await settle();
  check('skins: equip an owned skin', (await save()).skins.equipped === 'harbor');
  await clickButton(page, 'Skins', 'skin-arctic');
  await settle();
  await clickButton(page, 'Skins', 'equip');
  await settle();

  await page.keyboard.press('Escape');
  await sceneActive(page, 'Menu');
  await page.waitForTimeout(300);
  const menuSeal = await page.evaluate(
    () => window.__PHASER_GAME__.scene.getScene('Menu').children.getByName('seal').texture.key,
  );
  check('skins: the title screen shows the equipped skin', menuSeal === 'seal-arctic', menuSeal);
  // After the first run, Play opens the map select; Swim! starts the selected map.
  await page.keyboard.press('Enter');
  await sceneActive(page, 'Maps');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/33-maps.png` });
  const maps = await page.evaluate(() => {
    const sc = window.__PHASER_GAME__.scene.getScene('Maps');
    return ['bay', 'arctic', 'tropical'].map((id) => !!sc.children.getByName(`map-${id}`));
  });
  check('maps: a card per map', maps.every(Boolean), maps.join(','));
  await clickButton(page, 'Maps', 'swim');
  await sceneActive(page, 'Game');
  await page.waitForTimeout(500);
  const runSeal = await inGame(page, (sc) => sc.seal.texture.key);
  check('skins: the run uses the equipped skin', runSeal === 'seal-arctic', runSeal);
  await ctx.close();
}

/** Phase 6: missions (toast, payout, rotation), achievements, gems, top runs, Stats screen. */
async function progress(browser) {
  const ctx = await browser.newContext({ viewport: { width: GAME_W, height: GAME_H } });
  const page = await ctx.newPage();
  watch(page, 'progress');
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('hungry-seal-save')));
  await page.goto(URL);
  await sceneActive(page, 'Menu');
  await page.waitForTimeout(400);
  const panel = await page.evaluate(() => {
    const m = window.__PHASER_GAME__.scene.getScene('Menu').children.getByName('missions');
    return m ? m.list.filter((o) => o.type === 'Text').map((t) => t.text) : null;
  });
  check(
    'progress: a new player sees three starter missions',
    !!panel && panel.includes('Eat 20 fish in one run'),
    panel?.join(' | '),
  );

  await page.keyboard.press('Enter');
  await sceneActive(page, 'Hud');
  await page.waitForTimeout(600);
  await inGame(page, (sc) => {
    sc.hunger.value = 1e9;
    sc.eaten = 25;
    sc.eatenBy = { minnow: 25 };
    sc.score = 1500;
  });
  await page.waitForTimeout(900);
  const toast = await page.evaluate(() => {
    const hud = window.__PHASER_GAME__.scene.getScene('Hud');
    return { alpha: hud.toast.alpha, text: hud.toastText.text };
  });
  check(
    'progress: finishing a mission mid-run pops a toast',
    toast.alpha > 0.5 && toast.text === 'Eat 20 fish in one run',
    JSON.stringify(toast),
  );
  await page.screenshot({ path: `${OUT}/30-mission-toast.png` });

  const before = await save();
  await inGame(page, (sc) => {
    sc.hunger.value = 0.01;
  });
  await sceneActive(page, 'GameOver');
  await page.waitForTimeout(2600);
  const after = await save();
  const result = await page.evaluate(() => {
    const go = window.__PHASER_GAME__.scene.getScene('GameOver');
    return go.children.getByName('rewards') !== null;
  });
  const ids = after.missions.active.map((m) => m.id);
  check(
    'progress: the mission is paid and replaced when the run ends',
    after.missions.completed === 1 &&
      !ids.includes('eat-20') &&
      ids.length === 3 &&
      after.coins >= (before?.coins ?? 0) + 60,
    JSON.stringify({ coins: after.coins, ids }),
  );
  check(
    'progress: First Bite unlocks and pays a gem',
    after.achievements.includes('first-bite') && after.gems >= 1,
    JSON.stringify({ achievements: after.achievements, gems: after.gems }),
  );
  check(
    'progress: the run is on the top list, stats are counted',
    after.topRuns.length === 1 && after.stats.eaten === 25,
    JSON.stringify({ top: after.topRuns, eaten: after.stats.eaten }),
  );
  check('progress: the results screen shows the rewards', result);
  await page.screenshot({ path: `${OUT}/31-results-rewards.png` });

  await page.keyboard.press('Escape');
  await sceneActive(page, 'Menu');
  await page.waitForTimeout(400);
  await clickButton(page, 'Menu', 'stats');
  await sceneActive(page, 'Stats');
  await page.waitForTimeout(400);
  check('progress: the trophy button opens the Stats screen', true);
  await page.screenshot({ path: `${OUT}/32-stats.png` });
  await page.keyboard.press('Escape');
  await sceneActive(page, 'Menu');
  await ctx.close();
}

await mkdir(OUT, { recursive: true });
const server = await createServer({
  server: { port: PORT, strictPort: true },
  logLevel: 'error',
});
await server.listen();

const gl = process.env.PLAYTEST_GL ?? 'gpu';
const glArgs =
  gl === 'swiftshader'
    ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    : process.platform === 'win32'
      ? ['--use-angle=d3d11', '--enable-gpu']
      : ['--enable-gpu'];
const browser = await chromium.launch({
  channel: process.env.PLAYTEST_BROWSER ?? 'chrome',
  headless: true,
  args: [...glArgs, '--ignore-gpu-blocklist'],
});

// PLAYTEST_ONLY=desktop,mobile runs just those sections.
const sections = {
  screens,
  desktop,
  danger,
  phase4,
  phase5,
  gameplay,
  mobile,
  portrait,
  skins,
  progress,
};
const only = process.env.PLAYTEST_ONLY?.split(',');
try {
  for (const [name, run] of Object.entries(sections)) {
    if (!only || only.includes(name)) await run(browser);
  }
} catch (err) {
  errors.push(`playtest crashed: ${err.stack ?? err}`);
} finally {
  await browser.close();
  await server.close();
}

const failed = checks.filter((c) => !c.ok);
if (warnings.length) console.log(`\nWarnings:\n  ${warnings.join('\n  ')}`);
if (errors.length) console.log(`\nErrors:\n  ${errors.join('\n  ')}`);
console.log(
  `\n${checks.length - failed.length}/${checks.length} checks passed, ${errors.length} errors. Screenshots in ${OUT}/`,
);
process.exit(failed.length || errors.length ? 1 : 0);
