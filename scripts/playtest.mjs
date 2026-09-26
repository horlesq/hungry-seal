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
const FLOOR_CONTACT_Y = 6400 - 22;

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

const sceneActive = (page, key) =>
  page.waitForFunction((k) => window.__PHASER_GAME__?.scene.isActive(k), key, { timeout: 15000 });

/** Converts game coordinates to page coordinates using the scaled canvas rect. */
async function toPage(page, gx, gy) {
  const r = await page.evaluate(() => {
    const b = document.querySelector('canvas').getBoundingClientRect();
    return { left: b.left, top: b.top, width: b.width, height: b.height };
  });
  return { x: r.left + (gx / GAME_W) * r.width, y: r.top + (gy / GAME_H) * r.height };
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

  // Dive into the deep, then all the way to the seabed.
  await page.keyboard.down('s');
  const deep = await until(page, (s) => s.y > s0.y + 1800, 10000);
  await page.screenshot({ path: `${OUT}/04-deep.png` });
  check('dives deep', deep.ok, `y=${deep.last.y.toFixed(0)}`);
  const floor = await until(page, (s) => s.y >= FLOOR_CONTACT_Y - 0.5, 20000);
  await page.waitForTimeout(400);
  const onFloor = await sealState(page);
  await page.keyboard.up('s');
  await page.screenshot({ path: `${OUT}/05-seabed.png` });
  check(
    'stops at the seabed',
    floor.ok && onFloor.y <= FLOOR_CONTACT_Y + 0.5,
    `y=${onFloor.y.toFixed(1)}`,
  );

  // Mouse: seal swims toward the cursor without clicking.
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
  await page.keyboard.press('Escape');
  await sceneActive(page, 'Menu');
  const hudStopped = await page.evaluate(() => !window.__PHASER_GAME__.scene.isActive('Hud'));
  check('ESC returns to menu and stops HUD', hudStopped);

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
  check('HUD shows the new size', hudStage === 'SIZE 2/5', `hud=${hudStage}`);
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

  // Shark: telegraph, chase, bite.
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
  check('killed by shark shows CHOMPED!', over.texts.includes('CHOMPED!'));
  check('first run is a new best', over.texts.includes('NEW BEST!'));
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
  const center = await toPage(page, 640, 360);
  await page.touchscreen.tap(center.x, center.y);
  await sceneActive(page, 'Game');
  await page.waitForTimeout(700);
  await noStarve(page);

  const boostVisible = await page.evaluate(
    () => window.__PHASER_GAME__.scene.getScene('Hud').boostButton.visible,
  );
  check('touch: boost button visible', boostVisible);

  const s0 = await sealState(page);
  const right = await toPage(page, 1150, 380);
  await touch('touchStart', [{ ...right, id: 1 }]);
  const hold = await until(page, (s) => s.x > s0.x + 200, 4000);
  check('touch: hold steers toward finger', hold.ok, `dx=${(hold.last.x - s0.x).toFixed(0)}`);
  check('input source = touch', hold.last.source === 'touch', hold.last.source);

  // Second finger on the boost button while still steering with the first.
  const boostBtn = await toPage(page, 1162, 602);
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

try {
  await desktop(browser);
  await danger(browser);
  await gameplay(browser);
  await mobile(browser);
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
