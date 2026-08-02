import Phaser from 'phaser';
import { SaveState } from '../systems/SaveState';

/**
 * Loads only what the loading screen itself needs — about 2 KB — so the
 * progress bar can appear almost immediately.
 */
export class Boot extends Phaser.Scene {
  static readonly KEY = 'Boot';

  constructor() {
    super(Boot.KEY);
  }

  preload(): void {
    this.load.setPath('assets');
    this.load.spritesheet('spinner', 'boot/spinner.png', { frameWidth: 16, frameHeight: 16 });
    this.load.bitmapFont('font-small', 'boot/font-small.png', 'boot/font-small.xml');
  }

  create(): void {
    SaveState.load();
    this.sound.mute = SaveState.get().settings.muted;
    this.scene.start('Preload');
  }
}
