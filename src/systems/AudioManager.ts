import Phaser from 'phaser';
import { SaveState } from './SaveState';

/**
 * Thin wrapper over Phaser sound. Every call is tolerant of a missing asset so
 * a failed audio download can never break gameplay.
 */
class AudioManagerImpl {
  private scene?: Phaser.Scene;
  private music?: Phaser.Sound.BaseSound;
  private currentKey = '';
  private lastPlayed = new Map<string, number>();

  attach(scene: Phaser.Scene): void {
    this.scene = scene;
    // Phaser's sound manager is global, but a scene starting fresh has no
    // reason to know that the player turned the volume down three scenes ago.
    this.applySettings();
    // The Web Audio context stays locked until the first user gesture, and the
    // master gain node written to before then is thrown away when Phaser swaps
    // in the unlocked context. Without this, a saved volume silently reverts to
    // full the moment the player presses START.
    scene.sound.once(Phaser.Sound.Events.UNLOCKED, () => this.applySettings());
  }

  /** Push the saved mute/volume onto the (global) sound manager. */
  applySettings(): void {
    if (!this.scene) return;
    const { muted, volume } = SaveState.get().settings;
    this.scene.sound.mute = muted;
    this.scene.sound.volume = volume;
  }

  get muted(): boolean {
    return SaveState.get().settings.muted;
  }

  setMuted(v: boolean): void {
    SaveState.setSetting('muted', v);
    if (this.scene) this.scene.sound.mute = v;
  }

  toggleMute(): boolean {
    const next = !this.muted;
    this.setMuted(next);
    return next;
  }

  get volume(): number {
    return SaveState.get().settings.volume;
  }

  /**
   * Master level, 0..1. This scales the sound manager rather than the music
   * track, so sound effects move with it — "mute all volume" and a slider that
   * only touched the background loop would disagree with each other.
   */
  setVolume(v: number): void {
    const clamped = Math.min(1, Math.max(0, v));
    SaveState.setSetting('volume', clamped);
    if (this.scene) this.scene.sound.volume = clamped;
  }

  playMusic(key: string): void {
    if (!this.scene || this.currentKey === key) return;
    if (!this.scene.cache.audio.exists(key)) return;
    this.music?.stop();
    this.music?.destroy();
    this.music = this.scene.sound.add(key, { loop: true, volume: 0.35 });
    this.currentKey = key;
    try {
      this.music.play();
    } catch {
      /* autoplay blocked until the title-screen gesture; harmless */
    }
  }

  stopMusic(): void {
    this.music?.stop();
    this.currentKey = '';
  }

  /** @param throttleMs suppress repeats within this window (bump spam) */
  play(key: string, volume = 0.5, throttleMs = 0): void {
    if (!this.scene || !this.scene.cache.audio.exists(key)) return;
    if (throttleMs) {
      const now = this.scene.time.now;
      const last = this.lastPlayed.get(key) ?? -Infinity;
      if (now - last < throttleMs) return;
      this.lastPlayed.set(key, now);
    }
    this.scene.sound.play(key, { volume });
  }
}

export const Audio = new AudioManagerImpl();
