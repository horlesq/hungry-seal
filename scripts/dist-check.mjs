// Smoke test of the production build (what players download): serves dist/ (run `npm run build`
// first; `npm run release` does both), loads it in headless Chrome and checks that it boots
// without errors, how much it downloads before the title screen, that the service worker
// installs, and that the game still starts with the network off.
//
// Usage: npm run dist-check
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const PORT = 5199;
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch({
  channel: process.env.PLAYTEST_BROWSER ?? 'chrome',
  headless: true,
  args: [
    ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
    '--enable-gpu',
    '--ignore-gpu-blocklist',
  ],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
let bytes = 0;
const failed = [];
page.on('response', async (res) => {
  if (!res.ok() && res.status() !== 304) failed.push(`${res.status()} ${res.url()}`);
  const len = Number(res.headers()['content-length'] ?? 0);
  bytes += len || (await res.body().catch(() => Buffer.alloc(0))).length;
});

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

/** The title screen is up: the HTML loader is gone and the canvas has been drawn. */
const titleUp = () =>
  page.waitForFunction(
    () => !document.getElementById('boot') && !!document.querySelector('canvas'),
    null,
    {
      timeout: 30000,
    },
  );

const t0 = Date.now();
await page.goto(`http://localhost:${PORT}/`);
await titleUp();
// Give the preloader a moment past the loader hand-off, then count what was fetched.
await page.waitForLoadState('networkidle');
const bootMs = Date.now() - t0;
check('the build boots to the title screen', true, `${bootMs} ms on localhost`);
check(
  'boot download stays small',
  bytes < 6 * 1048576,
  `${(bytes / 1048576).toFixed(2)} MB before the first tap`,
);
check('no failed requests', failed.length === 0, failed.slice(0, 3).join(' | ') || 'none');

const sw = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((r) => setTimeout(() => r(null), 10000)),
  ]);
  return reg?.active ? reg.active.scriptURL : 'none';
});
check('service worker is active', sw.includes('sw.js?v='), sw);
// The page asks the worker to cache everything a couple of seconds after the title screen.
const cached = await page.evaluate(async () => {
  for (let i = 0; i < 40; i++) {
    const names = await caches.keys();
    let n = 0;
    for (const name of names) n += (await (await caches.open(name)).keys()).length;
    if (n > 70) return n;
    await new Promise((r) => setTimeout(r, 500));
  }
  return 0;
});
check('the art and code are cached for offline play', cached > 70, `${cached} files`);

// Offline: reload with the network cut; the cached page and assets must still boot the game.
await context.setOffline(true);
errors.length = 0;
await page.reload();
let offline = true;
try {
  await titleUp();
} catch {
  offline = false;
}
check('the game starts offline after one visit', offline);
await context.setOffline(false);
check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');
await page.screenshot({ path: '.playtest/dist-title.png' });

await browser.close();
await new Promise((r) => server.httpServer.close(r));
const bad = checks.filter((ok) => !ok).length;
console.log(`\n${checks.length - bad}/${checks.length} build checks passed`);
process.exit(bad ? 1 : 0);
