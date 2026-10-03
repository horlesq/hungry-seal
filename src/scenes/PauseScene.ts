// Pause overlay over a paused run: the whole map (where you are, regions and their danger,
// pearls found and still hidden, size gates, chests, the boss lair), then Resume, Restart
// run, Settings and Quit to menu, plus a sound toggle.
// GameScene pauses itself and the HUD before launching this; Esc or P resumes.
import Phaser from 'phaser';
import { SceneKeys } from '../config/keys';
import { WORLD } from '../config/zones';
import { audio } from '../services/AudioManager';
import { saves } from '../services/SaveService';
import { fitUiCamera, getSafeInsets, onResize, sharpenTexts } from '../services/Viewport';
import { Button } from '../ui/Button';
import { FocusNav } from '../ui/FocusNav';
import { mapThumbnail } from '../ui/mapThumb';
import { COLORS, CSS, drawPanel, EDGE, uiText } from '../ui/theme';
import { UiTextures } from '../ui/uiTextures';
import { currentMap } from '../world/GameMap';

/** Danger colors along the top of the map (calm .. deadly). */
/** Map panel: header (title + danger strip) above the map, legend below. */
const PANEL_HEAD = 96;
const PANEL_FOOT = 54;

function dangerColor(danger: number): number {
  return danger <= 2 ? COLORS.kelp : danger === 3 ? COLORS.gold : COLORS.coral;
}

export class PauseScene extends Phaser.Scene {
  private leaving = false;

  constructor() {
    super({ key: SceneKeys.Pause });
  }

  create(data: { restarted?: boolean } = {}): void {
    this.leaving = false;
    const v = fitUiCamera(this);
    const safe = getSafeInsets();
    const wide = !v.portrait;
    const cx = v.viewWidth / 2;
    const top = Math.max(safe.top + 10, wide ? (v.viewHeight - 720) / 2 : (v.viewHeight - 1200) / 2);

    // The scrim also swallows clicks so nothing reaches the HUD underneath.
    const scrim = this.add
      .rectangle(0, 0, v.viewWidth, v.viewHeight, COLORS.trench, 0.78)
      .setOrigin(0)
      .setInteractive();
    const content = this.add.container(0, 0);
    content.add(uiText(this, cx, top + 52, 'Paused', 'title', { size: wide ? 56 : 52 }).setOrigin(0.5));

    // Laid out top-down: title, map panel (header + map + legend), buttons.
    const mapW = wide ? Math.min(1160, v.viewWidth - 80) : Math.min(660, v.viewWidth - 40);
    const stretch = wide ? 1.3 : 2.4;
    const mapH = Math.round(WORLD.height * (mapW / currentMap().width) * stretch);
    const mapY = top + 110 + PANEL_HEAD + mapH / 2;
    content.add(this.mapPanel(cx, mapY, mapW, stretch));
    const buttonsTop = mapY + mapH / 2 + PANEL_FOOT + 50;

    const buttons: Button[] = [];
    const make = (label: string, name: string, onClick: () => void, opts: object = {}) =>
      new Button(this, 0, 0, {
        width: 240,
        height: 64,
        label,
        variant: 'secondary',
        fontSize: 26,
        onClick,
        ...opts,
      }).setName(name);
    const resume = make('Resume', 'resume', () => this.resume(), {
      width: 300,
      height: 76,
      icon: UiTextures.Play,
      variant: 'primary',
      fontSize: 34,
    });
    const restart = make('Restart run', 'restart', () => this.restartRun(), { icon: UiTextures.Restart });
    const settings = make('Settings', 'settings', () => this.openSettings());
    const quit = make('Quit to menu', 'quit', () => this.quit(), { variant: 'quiet' });
    buttons.push(resume, restart, settings, quit);
    if (wide) {
      // One row under the map: Resume in the middle-left, the rest beside it.
      const y = buttonsTop + 10;
      const widths = [300, 240, 240, 240];
      const total = widths.reduce((a, b) => a + b, 0) + 16 * 3;
      let x = cx - total / 2;
      buttons.forEach((b, i) => {
        b.setPosition(x + widths[i] / 2, y);
        x += widths[i] + 16;
      });
    } else {
      // Stacked under the map.
      let y = buttonsTop + 20;
      for (const b of buttons) {
        b.setPosition(cx, y);
        y += b === resume ? 96 : 80;
      }
    }
    const sound = new Button(this, v.viewWidth - safe.right - EDGE - 30, safe.top + EDGE + 30, {
      width: 60,
      height: 60,
      round: true,
      icon: audio.muted ? UiTextures.SoundOff : UiTextures.SoundOn,
      variant: 'quiet',
      onClick: () => {
        audio.toggleMuted();
        sound.setIcon(audio.muted ? UiTextures.SoundOff : UiTextures.SoundOn);
        if (!audio.muted) audio.startMusic();
      },
    }).setName('sound');
    content.add([...buttons, sound]);

    new FocusNav(this).add(...buttons, sound);
    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => this.resume());
    kb.on('keydown-P', () => this.resume());
    kb.on('keydown-M', () => sound.press());

    if (!data.restarted) {
      scrim.setAlpha(0);
      content.setAlpha(0).setY(12);
      this.tweens.add({ targets: scrim, alpha: 1, duration: 160 });
      this.tweens.add({ targets: content, alpha: 1, y: 0, duration: 200, ease: 'Quad.Out' });
    }

    sharpenTexts(this);
    onResize(this, () => {
      if (!this.leaving) this.scene.restart({ restarted: true });
    });
  }

  /** The whole map with markers, centred at (x, y). */
  private mapPanel(x: number, y: number, width: number, stretch: number): Phaser.GameObjects.Container {
    const map = currentMap();
    const def = map.def;
    const panel = this.add.container(x, y);
    const img = this.add.image(0, 0, mapThumbnail(this, map.id, width, stretch));
    const w = img.width;
    const h = img.height;
    const sx = w / map.width;
    const sy = h / WORLD.height;
    const X = (wx: number) => -w / 2 + wx * sx;
    const Y = (wy: number) => -h / 2 + wy * sy;

    const bg = this.add.graphics();
    drawPanel(bg, -w / 2 - 16, -h / 2 - PANEL_HEAD, w + 32, h + PANEL_HEAD + PANEL_FOOT, { alpha: 0.92 });
    const game = this.scene.get(SceneKeys.Game) as Phaser.Scene & { seal?: { x: number; y: number } };
    const here = game?.seal ? map.regionAt(game.seal.x, game.seal.y) : def.regions[0];
    const found = saves.data.maps.pearls[map.id] ?? [];
    const title = uiText(this, -w / 2, -h / 2 - 70, def.name, 'heading', { size: 28 }).setOrigin(0, 0.5);
    const where = uiText(this, w / 2, -h / 2 - 70, `You are in ${here.name}`, 'caption', {
      size: 17,
      color: CSS.glacier,
    }).setOrigin(1, 0.5);

    // Danger strip: one segment per region along the top, with its name when there's room.
    const g = this.add.graphics();
    const labels: Phaser.GameObjects.Text[] = [];
    for (const r of def.regions) {
      if (r.y0 !== undefined) continue; // lairs are marked separately
      const x0 = X(r.x0);
      const x1 = X(r.x1);
      g.fillStyle(dangerColor(r.danger), r.id === here.id ? 1 : 0.6).fillRect(x0, -h / 2 - 34, x1 - x0 - 2, 8);
      const label = uiText(this, (x0 + x1) / 2, -h / 2 - 44, r.name, 'caption', {
        size: 12,
        weight: r.id === here.id ? 800 : 600,
        color: r.id === here.id ? CSS.foam : CSS.mist,
      }).setOrigin(0.5, 1);
      if (label.width < x1 - x0 - 6) labels.push(label);
      else label.destroy();
    }

    // Gates: a bar across each current with its size.
    for (const gate of def.gates) {
      g.fillStyle(COLORS.gold, 0.9).fillRect(X(gate.x - gate.w / 2), Y(gate.y) - 1.5, Math.max(4, gate.w * sx), 3);
      labels.push(
        uiText(this, X(gate.x + gate.w / 2) + 4, Y(gate.y), String(gate.minStage), 'caption', {
          size: 13,
          weight: 800,
          color: CSS.gold,
        }).setOrigin(0, 0.5),
      );
    }
    // Chests.
    for (const t of def.treasure) {
      g.fillStyle(COLORS.gold, 1).fillCircle(X(t.x), Y(t.y), 3.5);
    }
    // The boss lair.
    const bx = X(def.boss.x);
    const by = Y(def.boss.y);
    const beaten = saves.data.maps.bosses.includes(map.id);
    g.fillStyle(beaten ? COLORS.mist : COLORS.coral, 1).fillCircle(bx, by, 8);
    g.lineStyle(2.5, COLORS.trench, 1).lineBetween(bx - 4, by - 4, bx + 4, by + 4).lineBetween(bx + 4, by - 4, bx - 4, by + 4);
    // Pearls: filled = found, rings = still out there.
    def.pearls.forEach((p, i) => {
      if (found.includes(i)) g.fillStyle(0xffd6f5, 1).fillCircle(X(p.x), Y(p.y), 5);
      else g.lineStyle(2, 0xffd6f5, 0.95).strokeCircle(X(p.x), Y(p.y), 5);
    });

    // Legend.
    const legend = uiText(
      this,
      0,
      h / 2 + 30,
      `Pearls ${found.length}/${def.pearls.length}   gold bars: size gates   red: boss lair${beaten ? ' (beaten)' : ''}`,
      'caption',
      { size: 15, color: CSS.mist },
    ).setOrigin(0.5);

    panel.add([bg, img, g, title, where, legend, ...labels]);
    if (game?.seal) {
      const px = X(game.seal.x);
      const py = Y(game.seal.y);
      const ring = this.add.circle(px, py, 9).setStrokeStyle(3, COLORS.glacier);
      const dot = this.add.circle(px, py, 5, COLORS.buoy).setStrokeStyle(2, COLORS.foam);
      panel.add([ring, dot]);
      this.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 900, repeat: -1 });
    }
    return panel;
  }

  private openSettings(): void {
    if (this.leaving) return;
    this.scene.launch(SceneKeys.Settings, { from: SceneKeys.Pause });
    this.scene.pause();
  }

  private resume(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.resume(SceneKeys.Game);
    this.scene.resume(SceneKeys.Hud);
    this.scene.stop();
  }

  private restartRun(): void {
    if (this.leaving) return;
    this.leaving = true;
    // Restarting GameScene also relaunches the HUD; this overlay shuts down.
    this.scene.start(SceneKeys.Game);
  }

  private quit(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.stop(SceneKeys.Game);
    this.scene.start(SceneKeys.Menu);
  }
}
