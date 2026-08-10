import Phaser from 'phaser';
import { VIEW_W, ALL_MAP_KEYS } from '../data/maps';

const BAR_W = 160;
const BAR_H = 8;
const MIN_DISPLAY_MS = 800;

/** Assets whose absence should stop the game rather than degrade it. */
const CRITICAL = /tiles-|player|atlas-game|font-main|map-town|obj-town/;

export class Preload extends Phaser.Scene {
  static readonly KEY = 'Preload';

  private bar!: Phaser.GameObjects.Rectangle;
  private pct!: Phaser.GameObjects.BitmapText;
  private startedAt = 0;
  private failures: string[] = [];
  private criticalFailure = false;

  constructor() {
    super(Preload.KEY);
  }

  preload(): void {
    this.buildLoadingScreen();
    this.startedAt = this.time.now;
    this.load.setPath('assets');

    // --- tilesets ---
    this.load.image('tiles-town', 'tilesets/town-exterior.png');
    this.load.image('tiles-interior', 'tilesets/interior.png');

    // --- characters (16x24 frames, 3 cols x 4 rows walk [x2 for the player]) ---
    const chars = ['player', 'npc-professor', 'npc-townsfolk-a', 'npc-townsfolk-b', 'npc-trainer', 'npc-clerk'];
    for (const c of chars) {
      this.load.spritesheet(c, `characters/${c}.png`, { frameWidth: 16, frameHeight: 24 });
    }

    // --- atlas: props, buildings, furniture, UI chrome ---
    this.load.atlas('atlas-game', 'atlas/atlas-game.png', 'atlas/atlas-game.json');

    // --- fonts ---
    this.load.bitmapFont('font-main', 'fonts/font-main.png', 'fonts/font-main.xml');

    // --- standalone UI ---
    this.load.spritesheet('reticle', 'ui/reticle.png', { frameWidth: 16, frameHeight: 16 });
    this.load.image('title-emblem', 'ui/title-emblem.png');

    // --- maps ---
    for (const key of ALL_MAP_KEYS) {
      this.load.tilemapTiledJSON(`map-${key}`, `maps/${key}.json`);
      this.load.json(`obj-${key}`, `maps/${key}.objects.json`);
    }

    // --- audio (non-critical: the game runs fine silent) ---
    const audio = ['bgm-town', 'bgm-interior', 'sfx-bump', 'sfx-door', 'sfx-select', 'sfx-text'];
    for (const a of audio) this.load.audio(a, [`audio/${a}.ogg`, `audio/${a}.m4a`]);

    this.load.on(Phaser.Loader.Events.PROGRESS, this.onProgress, this);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onError, this);
  }

  private buildLoadingScreen(): void {
    const cx = VIEW_W / 2;

    this.anims.create({
      key: 'spin',
      frames: this.anims.generateFrameNumbers('spinner', { start: 0, end: 7 }),
      frameRate: 12,
      repeat: -1,
    });
    this.add.sprite(cx, 54, 'spinner').play('spin');

    this.add.rectangle(cx, 90, BAR_W + 4, BAR_H + 4).setStrokeStyle(1, 0x88c0e8);
    this.bar = this.add.rectangle(cx - BAR_W / 2, 90, 0, BAR_H, 0x4890d8).setOrigin(0, 0.5);

    this.pct = this.add.bitmapText(cx, 100, 'font-small', '0%').setOrigin(0.5, 0);
    // Static label. Naming each file as it loads flickers through 30-odd keys
    // in under a second, which reads as noise rather than progress.
    this.add.bitmapText(cx, 114, 'font-small', 'LOADING').setOrigin(0.5, 0);
  }

  private onProgress(value: number): void {
    this.bar.width = BAR_W * value;
    this.pct.setText(`${Math.round(value * 100)}%`);
  }

  private onError(file: Phaser.Loader.File): void {
    this.failures.push(file.key);
    if (CRITICAL.test(file.key)) this.criticalFailure = true;
  }

  create(): void {
    if (this.criticalFailure) return this.showError();
    if (this.failures.length) {
      console.warn('[preload] non-critical assets failed:', this.failures.join(', '));
    }

    // A loading screen that flashes past reads as a bug, so hold it briefly.
    const elapsed = this.time.now - this.startedAt;
    const wait = Math.max(0, MIN_DISPLAY_MS - elapsed);
    this.time.delayedCall(wait, () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('Title');
      });
    });
  }

  /** The portfolio must stay readable even when the game cannot load. */
  private showError(): void {
    this.children.removeAll();
    const cx = VIEW_W / 2;
    this.add.bitmapText(cx, 40, 'font-small', 'SOMETHING WENT WRONG.').setOrigin(0.5, 0);
    this.add.bitmapText(cx, 60, 'font-small', 'The game assets failed to load.').setOrigin(0.5, 0);

    const retry = this.add.bitmapText(cx, 90, 'font-small', '> RETRY').setOrigin(0.5, 0).setInteractive();
    const text = this.add.bitmapText(cx, 106, 'font-small', '> VIEW TEXT VERSION').setOrigin(0.5, 0).setInteractive();

    retry.on('pointerdown', () => this.scene.restart());
    text.on('pointerdown', () => document.documentElement.classList.add('text-mode'));
    this.input.keyboard?.once('keydown-ENTER', () => this.scene.restart());
    document.documentElement.classList.add('game-failed');
  }
}
