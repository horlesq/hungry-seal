// Game audio: registers synthesized sounds in Phaser's audio cache, plays effects with
// per-key rate limiting (a school of fish shouldn't stack 20 chomps), runs the music
// (menu, shallows and deep loops, crossfading when the track changes), and owns the
// persisted mute and volume settings.
import Phaser from 'phaser';
import { EFFECT_TONES, SoundKeys, type MusicKey, type SoundKey } from '../audio/sounds';
import {
  DEEP_TRACK,
  MENU_TRACK,
  renderEffect,
  renderMusic,
  SAMPLE_RATE,
  SHALLOWS_TRACK,
  type TrackSpec,
} from '../audio/synth';
import { saves } from './SaveService';

/** Minimum seconds between two plays of the same effect. */
const MIN_GAP: Partial<Record<SoundKey, number>> = {
  [SoundKeys.Chomp]: 0.05,
  [SoundKeys.ChompBig]: 0.06,
  [SoundKeys.Coin]: 0.035,
  [SoundKeys.Splash]: 0.15,
  [SoundKeys.Bump]: 0.2,
  [SoundKeys.Thud]: 0.35,
  [SoundKeys.Puff]: 0.25,
};

const VOLUME: Partial<Record<SoundKey, number>> = {
  [SoundKeys.Chomp]: 0.55,
  [SoundKeys.Coin]: 0.5,
  [SoundKeys.Splash]: 0.5,
  [SoundKeys.Boost]: 0.45,
  [SoundKeys.Click]: 0.6,
  [SoundKeys.Zone]: 0.5,
};

/** Music level at full volume setting. */
const MUSIC_VOLUME = 0.32;
/** Seconds to crossfade between music tracks. */
const FADE_TIME = 1.6;

const TRACKS: Record<MusicKey, TrackSpec> = {
  [SoundKeys.Music]: MENU_TRACK,
  [SoundKeys.MusicShallows]: SHALLOWS_TRACK,
  [SoundKeys.MusicDeep]: DEEP_TRACK,
};

interface Playing {
  key: MusicKey;
  sound: Phaser.Sound.BaseSound & { volume: number };
  /** 0..1 fade level (multiplied with the music volume). */
  level: number;
  target: number;
}

class AudioManager {
  private game: Phaser.Game | null = null;
  private ctx: AudioContext | null = null;
  private readonly lastPlayed = new Map<string, number>();
  private readonly music: Playing[] = [];
  private wanted: MusicKey | null = null;

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
    game.events.on(Phaser.Core.Events.STEP, (_t: number, delta: number) => this.fade(delta / 1000));
    const manager = game.sound as Partial<Phaser.Sound.WebAudioSoundManager>;
    const ctx = manager.context;
    if (!ctx) return; // No Web Audio (HTML5/NoAudio): play silently.
    this.ctx = ctx;

    for (const [key, tones] of Object.entries(EFFECT_TONES)) {
      if (game.cache.audio.exists(key)) continue;
      const samples = renderEffect(tones);
      const buffer = ctx.createBuffer(1, samples.length, SAMPLE_RATE);
      buffer.getChannelData(0).set(samples);
      game.cache.audio.add(key, buffer);
    }
    this.renderTrack(SoundKeys.Music);
    // The in-game tracks are rendered a moment later so the first screen comes up quickly.
    setTimeout(() => this.renderTrack(SoundKeys.MusicShallows), 400);
    setTimeout(() => this.renderTrack(SoundKeys.MusicDeep), 900);
  }

  private renderTrack(key: MusicKey): boolean {
    const game = this.game;
    if (!game || !this.ctx) return false;
    if (game.cache.audio.exists(key)) return true;
    const [left, right] = renderMusic(TRACKS[key]);
    const buffer = this.ctx.createBuffer(2, left.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(left);
    buffer.getChannelData(1).set(right);
    game.cache.audio.add(key, buffer);
    if (this.wanted === key) this.setMusic(key);
    return true;
  }

  play(key: SoundKey, config: Phaser.Types.Sound.SoundConfig = {}): void {
    const game = this.game;
    if (!game || this.muted || !game.cache.audio.exists(key)) return;
    const sfx = saves.data.settings.sfx;
    if (sfx <= 0) return;
    const now = game.loop.time / 1000;
    const gap = MIN_GAP[key] ?? 0.03;
    if (now - (this.lastPlayed.get(key) ?? -1) < gap) return;
    this.lastPlayed.set(key, now);
    const volume = (config.volume ?? VOLUME[key] ?? 0.7) * sfx;
    game.sound.play(key, { ...config, volume });
  }

  /** Starts the menu music (after the browser allows audio). Idempotent. */
  startMusic(): void {
    this.setMusic(SoundKeys.Music);
  }

  /** Crossfades to `key` (no-op if it's already the one playing). */
  setMusic(key: MusicKey): void {
    const game = this.game;
    this.wanted = key;
    if (!game) return;
    if (!game.cache.audio.exists(key)) return; // plays once rendered (renderTrack)
    const begin = () => {
      if (this.wanted !== key) return;
      for (const m of this.music) m.target = m.key === key ? 1 : 0;
      if (this.music.some((m) => m.key === key)) return;
      const sound = game.sound.add(key, { loop: true, volume: 0 }) as Playing['sound'];
      sound.play();
      // The first track starts at full level; later ones fade in over the old one.
      const first = this.music.length === 0;
      this.music.push({ key, sound, level: first ? 1 : 0, target: 1 });
      this.applyVolumes();
    };
    if (game.sound.locked) game.sound.once(Phaser.Sound.Events.UNLOCKED, begin);
    else begin();
  }

  /** Re-applies the music volume setting (after Settings changes). */
  applyVolumes(): void {
    const v = MUSIC_VOLUME * saves.data.settings.music;
    for (const m of this.music) m.sound.volume = v * m.level;
  }

  private fade(dt: number): void {
    if (this.music.length === 0) return;
    const step = dt / FADE_TIME;
    for (let i = this.music.length - 1; i >= 0; i--) {
      const m = this.music[i];
      if (m.level === m.target) continue;
      m.level = m.target > m.level ? Math.min(1, m.level + step) : Math.max(0, m.level - step);
      if (m.level === 0 && m.target === 0) {
        m.sound.destroy();
        this.music.splice(i, 1);
      }
    }
    this.applyVolumes();
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
