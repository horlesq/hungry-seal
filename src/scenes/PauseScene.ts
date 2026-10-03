// Pause overlay over a paused run: Resume, Restart run, Settings, Quit to menu, a sound
// toggle, and the map of the whole level with where the seal is and the treasure spots.
// GameScene pauses itself and the HUD before launching this; Esc or P resumes.
import Phaser from 'phaser';
import { SceneKeys } from '../config/keys';
import { audio } from '../services/AudioManager';
import { fitUiCamera, getSafeInsets, onResize, sharpenTexts } from '../services/Viewport';
import { Button } from '../ui/Button';
import { FocusNav } from '../ui/FocusNav';
import { mapThumbnail } from '../ui/mapThumb';
import { COLORS, CSS, drawPanel, EDGE, uiText } from '../ui/theme';
import { WORLD } from '../config/zones';
import { currentMap } from '../world/GameMap';
import { UiTextures } from '../ui/uiTextures';

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
    // Wide: buttons on the left, the map on the right. Upright: map on top, buttons below.
    const cx = wide ? v.viewWidth / 2 - 300 : v.viewWidth / 2;
    const cy = wide ? v.viewHeight / 2 : v.viewHeight / 2 + 150;

    // The scrim also swallows clicks so nothing reaches the HUD underneath.
    const scrim = this.add
      .rectangle(0, 0, v.viewWidth, v.viewHeight, COLORS.trench, 0.74)
      .setOrigin(0)
      .setInteractive();
    const content = this.add.container(0, 0);
    content.add(uiText(this, cx, cy - 190, 'Paused', 'title').setOrigin(0.5));
    content.add(
      this.mapPanel(wide ? v.viewWidth / 2 + 230 : v.viewWidth / 2, wide ? cy : cy - 470, wide ? 560 : 620),
    );

    const resume = new Button(this, cx, cy - 50, {
      width: 360,
      height: 80,
      label: 'Resume',
      icon: UiTextures.Play,
      variant: 'primary',
      fontSize: 36,
      onClick: () => this.resume(),
    }).setName('resume');
    const restart = new Button(this, cx, cy + 54, {
      width: 360,
      height: 64,
      label: 'Restart run',
      icon: UiTextures.Restart,
      variant: 'secondary',
      fontSize: 26,
      onClick: () => this.restartRun(),
    }).setName('restart');
    const settings = new Button(this, cx, cy + 128, {
      width: 360,
      height: 64,
      label: 'Settings',
      variant: 'secondary',
      fontSize: 26,
      onClick: () => this.openSettings(),
    }).setName('settings');
    const quit = new Button(this, cx, cy + 202, {
      width: 360,
      height: 64,
      label: 'Quit to menu',
      variant: 'quiet',
      fontSize: 26,
      onClick: () => this.quit(),
    }).setName('quit');
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
    content.add([resume, restart, settings, quit, sound]);

    new FocusNav(this).add(resume, restart, settings, quit, sound);
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

  /** The whole map: where the seal is, and the treasure spots. */
  private mapPanel(x: number, y: number, width: number): Phaser.GameObjects.Container {
    const map = currentMap();
    const panel = this.add.container(x, y);
    const key = mapThumbnail(this, map.id, width);
    const img = this.add.image(0, 0, key);
    const w = img.width;
    const h = img.height;
    const bg = this.add.graphics();
    drawPanel(bg, -w / 2 - 14, -h / 2 - 56, w + 28, h + 70, { alpha: 0.9 });
    const title = uiText(this, -w / 2, -h / 2 - 30, map.def.name, 'heading', { size: 28 }).setOrigin(
      0,
      0.5,
    );
    const hint = uiText(this, w / 2, -h / 2 - 30, 'You are here', 'caption', {
      size: 16,
      color: CSS.glacier,
    }).setOrigin(1, 0.5);
    const sx = w / map.width;
    const sy = h / WORLD.height;
    const marks = this.add.graphics();
    for (const t of map.def.treasure) {
      marks.fillStyle(COLORS.gold, 1).fillCircle(-w / 2 + t.x * sx, -h / 2 + t.y * sy, 4);
      marks.lineStyle(1.5, COLORS.trench, 1).strokeCircle(-w / 2 + t.x * sx, -h / 2 + t.y * sy, 4);
    }
    panel.add([bg, img, marks, title, hint]);
    const game = this.scene.get(SceneKeys.Game) as Phaser.Scene & { seal?: { x: number; y: number } };
    if (game?.seal) {
      const px = -w / 2 + game.seal.x * sx;
      const py = -h / 2 + game.seal.y * sy;
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
