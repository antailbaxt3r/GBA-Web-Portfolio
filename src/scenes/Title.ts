import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../data/maps';
import { SaveState } from '../systems/SaveState';
import { Audio } from '../systems/AudioManager';
import { META } from '../data/content';
import { World } from './World';
import { UIScene } from './UIScene';

/**
 * The title screen exists for a hard technical reason as well as a stylistic
 * one: browsers block WebAudio until a user gesture, so without a "press to
 * start" gate the music would never play.
 */
export class Title extends Phaser.Scene {
  static readonly KEY = 'Title';

  private options: { label: string; run: () => void }[] = [];
  private index = 0;
  private cursor!: Phaser.GameObjects.Image;
  private labels: Phaser.GameObjects.BitmapText[] = [];
  private started = false;

  constructor() {
    super(Title.KEY);
  }

  create(): void {
    this.cameras.main.fadeIn(300, 0, 0, 0);
    Audio.attach(this);

    const cx = VIEW_W / 2;
    this.add.image(cx, 34, 'title-emblem').setOrigin(0.5, 0.5);

    this.add.bitmapText(cx, 58, 'font-main', META.name).setOrigin(0.5, 0).setTint(0xf8f8f8);
    this.add.bitmapText(cx, 74, 'font-small', META.tagline).setOrigin(0.5, 0);

    const hasSave = SaveState.hasSave();
    this.options = [];
    if (hasSave) {
      this.options.push({ label: 'CONTINUE', run: () => this.begin(true) });
    }
    this.options.push({ label: hasSave ? 'NEW GAME' : 'START', run: () => this.begin(false) });

    this.options.forEach((o, i) => {
      const t = this.add
        .bitmapText(cx - 30, 100 + i * 16, 'font-small', o.label)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => { this.index = i; this.select(); });
      t.on('pointerover', () => { this.index = i; this.updateCursor(); });
      this.labels.push(t);
    });

    this.cursor = this.add.image(cx - 42, 100, 'atlas-game', 'cursor').setOrigin(0, 0);
    this.updateCursor();

    this.add
      .bitmapText(cx, VIEW_H - 22, 'font-small', 'ARROWS + ENTER   or   CLICK')
      .setOrigin(0.5, 0)
      .setAlpha(0.7);

    this.input.keyboard?.on('keydown-UP', () => this.move(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.move(1));
    this.input.keyboard?.on('keydown-W', () => this.move(-1));
    this.input.keyboard?.on('keydown-S', () => this.move(1));
    for (const k of ['ENTER', 'SPACE', 'Z'] as const) {
      this.input.keyboard?.on(`keydown-${k}`, () => this.select());
    }
  }

  private move(delta: number): void {
    this.index = (this.index + delta + this.options.length) % this.options.length;
    this.updateCursor();
    Audio.play('sfx-select', 0.3);
  }

  private updateCursor(): void {
    this.cursor.y = 100 + this.index * 16;
    this.labels.forEach((l, i) => l.setAlpha(i === this.index ? 1 : 0.65));
  }

  private select(): void {
    if (this.started) return;
    this.options[this.index]?.run();
  }

  private begin(continueSave: boolean): void {
    this.started = true;
    Audio.play('sfx-select', 0.5);

    const save = SaveState.get();
    if (!continueSave) SaveState.reset();
    const target = continueSave ? save.lastMap : 'town';
    const spawn = continueSave ? 'resume' : 'default';

    // Stash the resume position so World can place the player exactly.
    if (continueSave) {
      this.registry.set('resume', { x: save.lastTile.x, y: save.lastTile.y, facing: save.facing });
    } else {
      this.registry.remove('resume');
    }

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(World.KEY, { mapKey: target, spawnId: spawn, instant: true });
      this.scene.launch(UIScene.KEY);
    });
  }
}
