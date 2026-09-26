// Game audio: registers synthesized sounds in Phaser's audio cache, plays effects with
// per-key rate limiting (a school of fish shouldn't stack 20 chomps), runs the music loop,
// and owns the persisted mute setting.
import Phaser from 'phaser';
import { EFFECT_TONES, SoundKeys, type SoundKey } from '../audio/sounds';
import { renderEffect, renderMusic, SAMPLE_RATE } from '../audio/synth';
import { saves } from './SaveService';

/** Minimum seconds between two plays of the same effect. */
const MIN_GAP: Partial<Record<SoundKey, number>> = {
  [SoundKeys.Chomp]: 0.05,
  [SoundKeys.ChompBig]: 0.06,
  [SoundKeys.Coin]: 0.035,
  [SoundKeys.Splash]: 0.15,
  [SoundKeys.Bump]: 0.2,
};

const VOLUME: Partial<Record<SoundKey, number>> = {
  [SoundKeys.Chomp]: 0.55,
  [SoundKeys.Coin]: 0.5,
  [SoundKeys.Splash]: 0.5,
  [SoundKeys.Boost]: 0.45,
  [SoundKeys.Click]: 0.6,
};

const MUSIC_VOLUME = 0.32;

class AudioManager {
  private game: Phaser.Game | null = null;
  private readonly lastPlayed = new Map<string, number>();
  private music: Phaser.Sound.BaseSound | null = null;

  /** Synthesizes and caches all sounds. Safe to call once the game has booted. */
  register(game: Phaser.Game): void {
    this.game = game;
    // Web Audio can't apply the mute gain while the context is still locked (before the
    // first user gesture), so apply it now and again once unlocked. Our own `muted` (from
    // the save) is the source of truth; `sound.mute` is just the master switch.
    game.sound.mute = this.muted;
    game.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
      game.sound.mute = this.muted;
    });
    const manager = game.sound as Partial<Phaser.Sound.WebAudioSoundManager>;
    const ctx = manager.context;
    if (!ctx) return; // No Web Audio (HTML5/NoAudio): play silently.

    for (const [key, tones] of Object.entries(EFFECT_TONES)) {
      if (game.cache.audio.exists(key)) continue;
      const samples = renderEffect(tones);
      const buffer = ctx.createBuffer(1, samples.length, SAMPLE_RATE);
      buffer.getChannelData(0).set(samples);
      game.cache.audio.add(key, buffer);
    }
    if (!game.cache.audio.exists(SoundKeys.Music)) {
      const [left, right] = renderMusic();
      const buffer = ctx.createBuffer(2, left.length, SAMPLE_RATE);
      buffer.getChannelData(0).set(left);
      buffer.getChannelData(1).set(right);
      game.cache.audio.add(SoundKeys.Music, buffer);
    }
  }

  play(key: SoundKey, config: Phaser.Types.Sound.SoundConfig = {}): void {
    const game = this.game;
    if (!game || this.muted || !game.cache.audio.exists(key)) return;
    const now = game.loop.time / 1000;
    const gap = MIN_GAP[key] ?? 0.03;
    if (now - (this.lastPlayed.get(key) ?? -1) < gap) return;
    this.lastPlayed.set(key, now);
    game.sound.play(key, { volume: VOLUME[key] ?? 0.7, ...config });
  }

  /** Starts the looping music (after the browser allows audio). Idempotent. */
  startMusic(): void {
    const game = this.game;
    if (!game || this.music || !game.cache.audio.exists(SoundKeys.Music)) return;
    const begin = () => {
      if (this.music) return;
      this.music = game.sound.add(SoundKeys.Music, { loop: true, volume: MUSIC_VOLUME });
      this.music.play();
    };
    if (game.sound.locked) game.sound.once(Phaser.Sound.Events.UNLOCKED, begin);
    else begin();
  }

  get muted(): boolean {
    return saves.data.settings.muted;
  }

  setMuted(muted: boolean): void {
    saves.setMuted(muted);
    if (this.game) this.game.sound.mute = muted;
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }
}

export const audio = new AudioManager();
