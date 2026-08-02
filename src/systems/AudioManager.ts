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
