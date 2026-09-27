// Pause overlay over a paused run: Resume, Restart run, Quit to menu, and a sound toggle.
// GameScene pauses itself and the HUD before launching this; Esc or P resumes.
import Phaser from 'phaser';
import { SceneKeys } from '../config/keys';
import { audio } from '../services/AudioManager';
import { fitUiCamera, getSafeInsets, onResize, sharpenTexts } from '../services/Viewport';
import { Button } from '../ui/Button';
import { FocusNav } from '../ui/FocusNav';
import { COLORS, EDGE, uiText } from '../ui/theme';
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
    const cx = v.viewWidth / 2;
    const cy = v.viewHeight / 2;

    // The scrim also swallows clicks so nothing reaches the HUD underneath.
    const scrim = this.add
      .rectangle(0, 0, v.viewWidth, v.viewHeight, COLORS.trench, 0.74)
      .setOrigin(0)
      .setInteractive();
    const content = this.add.container(0, 0);
    content.add(uiText(this, cx, cy - 170, 'Paused', 'title').setOrigin(0.5));

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
    const quit = new Button(this, cx, cy + 140, {
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
    content.add([resume, restart, quit, sound]);

    new FocusNav(this).add(resume, restart, quit, sound);
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
