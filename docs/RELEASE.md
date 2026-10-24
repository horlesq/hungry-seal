# Releasing

Hungry Seal ships in two places from the same build: the website (Vercel deploys `main` to
https://hungry-seal.horly.dev/) and itch.io (a zip of `dist/`, uploaded by hand).

## Versions
- The version lives in `package.json` (semver). It's shown on the title screen (bottom corner),
  names the service worker's cache (`sw.js?v=<version>`, so players get the new files) and the
  release zip.
- Bump it for every release that players get: patch for fixes and tuning, minor for new content
  or features, major for save-breaking changes (the save has its own `version` and migrations).
- Add an entry to [CHANGELOG.md](../CHANGELOG.md) (newest first, written for players).

## Checklist
1. On the phase/feature branch, everything green:
   - `npm run check` (typecheck, lint, unit tests, browser playtest), and look at `.playtest/`
   - `npm run soak`, `npm run perf`, `npm run browsers`
   - after tuning: balance bot runs per map (see [REGRESSION.md](REGRESSION.md))
   - the by-hand list in [REGRESSION.md](REGRESSION.md) on a real phone
2. Bump `package.json` `version` and write the CHANGELOG entry.
3. `npm run release`: builds `dist/`, runs `dist-check` (boots, boot download < 6 MB, service
   worker active, starts offline, no console errors) and writes
   `release/hungry-seal-<version>-web.zip`.
4. If the art or UI changed visibly: `npm run store-shots` and replace the images on itch.io.
5. Merge to `main` and push: CI runs, Vercel deploys the site.
6. itch.io: upload the zip (see below), then play it once on the itch page (desktop and phone).
7. Tag the release: `git tag v<version>` and push the tag.

## itch.io
- Project kind: **HTML**. Upload `release/hungry-seal-<version>-web.zip` and tick **This file
  will be played in the browser**.
- Embed options: viewport **1280 x 720**, **Mobile friendly** on (orientation: landscape is best;
  the game also lays out upright), **Fullscreen button** on, **Automatically start on page
  load** off (the first tap also unlocks sound).
- Page: cover `store/cover-630x500.png`, screenshots `store/01-*.png` to `store/07-*.png`, text
  and tags in [store/itch-page.md](../store/itch-page.md).
- The game uses relative paths (`base: './'`), so it runs from itch's subfolder as is. The
  service worker may not register inside itch's iframe; the game then simply plays online.

## Hotfix
Branch from `main`, fix, bump the patch version, CHANGELOG entry, `npm run release`, merge,
upload. The new version's service worker replaces the old cache on the next visit.
