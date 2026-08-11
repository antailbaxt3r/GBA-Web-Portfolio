import Phaser from 'phaser';
import { SaveState } from '../systems/SaveState';
import { Audio } from '../systems/AudioManager';
import { asset } from '../systems/assetUrl';

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
    // Absolute, not relative: a page served from a nested path (/minimal/)
    // would otherwise resolve these against that directory.
    this.load.setPath('/assets');
    this.load.spritesheet('spinner', asset('boot/spinner.png'), { frameWidth: 16, frameHeight: 16 });
    this.load.bitmapFont('font-small', asset('boot/font-small.png'), asset('boot/font-small.xml'));
  }

  create(): void {
    SaveState.load();
    Audio.attach(this);
    this.scene.start('Preload');
  }
}
