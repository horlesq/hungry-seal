# Hungry Seal

A Hungry Shark–style arcade game starring a very hungry seal. Swim three big maps (Seal Bay,
Arctic, Tropical Lagoon), eat everything smaller than you, grow through 8 sizes, dodge
jellyfish, mines, sharks and orcas, beat the squid bosses, and spend your coins on upgrades and
skins between runs. Installable and playable offline.

**Play it:** https://hungry-seal.horly.dev/ (desktop and mobile browsers). Changes: [CHANGELOG.md](CHANGELOG.md).

## Controls
- **Mouse:** the seal swims toward the cursor; hold the left button to boost
- **Keyboard:** WASD / arrow keys to swim, Space or Shift to boost
- **Touch:** a floating joystick: touch anywhere (e.g. bottom-left) and drag to swim; Boost button to dash
- **Pause:** Esc or P, or the pause button (top-right)
- Leap out of the water to catch birds. Fill the frenzy meter to eat *anything*.

## Development
Built with [Phaser 4](https://phaser.io), TypeScript and Vite.

```bash
npm install
npm run dev        # local dev server (npm run dev:host to test on a phone over LAN)
npm run check      # typecheck + lint + unit tests + headless browser playtest
npm run build      # production build in dist/
npm run release    # build + checks + itch.io zip in release/ (see docs/RELEASE.md)
```

More tools: `npm run balance` (bot plays a run), `npm run perf` (phone frame times),
`npm run browsers` (browser matrix), `npm run soak` (leak test), `npm run assets` (WebP art).

URL flags: `?debug` (overlay and hit circles), `?calm` (no hazards or predators).

Project docs: [design](docs/GAME_DESIGN.md), [architecture](docs/ARCHITECTURE.md),
[roadmap](docs/ROADMAP.md), [assets](docs/ASSETS.md), [release](docs/RELEASE.md).

Characters, creatures and props are modeled and rendered in Blender by the scripts in
`tools/blender/`; the UI and backgrounds are painted in code, and all sound is synthesized in
code. UI font:
[Baloo 2](https://fonts.google.com/specimen/Baloo+2) (SIL Open Font License), bundled via Fontsource.
