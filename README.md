# Hungry Seal

A Hungry Shark–style arcade game starring a very hungry seal. Swim an endless ocean, eat
everything smaller than you, grow, dodge jellyfish, mines and sharks, and spend your coins on
upgrades between runs.

**Play it:** https://horlesq.github.io/hungry-seal/ (desktop and mobile browsers)

## Controls
- **Mouse:** the seal swims toward the cursor; hold the left button to boost
- **Keyboard:** WASD / arrow keys to swim, Space or Shift to boost
- **Touch:** hold and drag to swim, BOOST button to dash
- Leap out of the water to catch birds. Fill the frenzy meter to eat *anything*.

## Development
Built with [Phaser 4](https://phaser.io), TypeScript and Vite.

```bash
npm install
npm run dev        # local dev server (npm run dev:host to test on a phone over LAN)
npm run check      # typecheck + lint + unit tests + headless browser playtest
npm run build      # production build in dist/
```

URL flags: `?debug` (overlay and hit circles), `?calm` (no hazards or predators).

Project docs: [design](docs/GAME_DESIGN.md), [architecture](docs/ARCHITECTURE.md),
[roadmap](docs/ROADMAP.md), [assets](docs/ASSETS.md).

All art is currently generated placeholder art, and all sound is synthesized in code.
