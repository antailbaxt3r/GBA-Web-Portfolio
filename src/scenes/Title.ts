import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../data/maps';
import { SaveState } from '../systems/SaveState';
import { Audio } from '../systems/AudioManager';
import { META } from '../data/content';
import { World } from './World';
import { UIScene } from './UIScene';
import { SWITCH_TINT } from '../data/routes';
import { openMinimalSite } from '../systems/navigate';

/**
 * The title screen exists for a hard technical reason as well as a stylistic
 * one: browsers block WebAudio until a user gesture, so without a "press to
 * start" gate the music would never play.
 */
/** First option's baseline, and the gap between options. */
const OPT_Y = 90;
const OPT_H = 16;

export class Title extends Phaser.Scene {
  static readonly KEY = 'Title';

  private options: { label: string; run: () => void; tint?: number }[] = [];
  private index = 0;
  private cursor!: Phaser.GameObjects.Image;
  private labels: Phaser.GameObjects.BitmapText[] = [];
  private started = false;

  constructor() {
    super(Title.KEY);
  }

  create(): void {
    // Phaser keeps one instance of a scene and re-runs create() on re-entry,
    // so every field set during the last visit is still here. `started` in
    // particular latched true the first time the player pressed START, which
    // made select() a no-op for good once they came back from the pause menu.
    this.started = false;
    this.index = 0;
    this.labels = [];

    this.cameras.main.fadeIn(300, 0, 0, 0);
    Audio.attach(this);

    const cx = VIEW_W / 2;
    this.add.image(cx, 30, 'title-emblem').setOrigin(0.5, 0.5);

    this.add.bitmapText(cx, 52, 'font-main', META.name).setOrigin(0.5, 0).setTint(0xf8f8f8);
    this.add.bitmapText(cx, 68, 'font-small', META.tagline).setOrigin(0.5, 0);

    const hasSave = SaveState.hasSave();
    this.options = [];
    if (hasSave) {
      this.options.push({ label: 'CONTINUE', run: () => this.begin(true) });
    }
    this.options.push({ label: hasSave ? 'NEW GAME' : 'START', run: () => this.begin(false) });
    // Tinted, because it leaves the game entirely rather than starting it.
    this.options.push({
      label: 'MINIMAL SITE',
      run: () => openMinimalSite(),
      tint: SWITCH_TINT,
    });

    this.options.forEach((o, i) => {
      const t = this.add
        .bitmapText(cx - 30, OPT_Y + i * OPT_H, 'font-small', o.label)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      if (o.tint !== undefined) t.setTint(o.tint);
      t.on('pointerdown', () => { this.index = i; this.select(); });
      t.on('pointerover', () => { this.index = i; this.updateCursor(); });
      this.labels.push(t);
    });

    // Origin at the arrow's vertical middle so it points at the centre of the
    // option, not the top of its letters.
    this.cursor = this.add.image(cx - 42, OPT_Y, 'atlas-game', 'cursor').setOrigin(0, 0.5);
    this.updateCursor();

    this.add
      .bitmapText(cx, VIEW_H - 18, 'font-small', 'TAP   or   ARROWS + ENTER')
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
    const row = this.labels[this.index];
    if (row) this.cursor.y = row.y + row.height / 2;
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
