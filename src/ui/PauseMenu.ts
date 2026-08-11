import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../data/maps';
import { Audio } from '../systems/AudioManager';
import { PAUSE_SWITCH_TINT } from '../data/routes';

const PAD = 12;
const ROW_H = 16;
const FIRST_ROW = 26;

type RowId = 'close' | 'sound' | 'volume' | 'minimal' | 'exit';

/**
 * Resume first, so the default cursor position is the harmless one and the
 * destructive row is as far from it as the list allows. The two rows that
 * leave the game sit together at the bottom, with the one that leaves the site
 * entirely tinted apart from the rest.
 */
const ROWS: { id: RowId; label: string; tint?: number }[] = [
  { id: 'close', label: 'RESUME' },
  { id: 'sound', label: 'SOUND' },
  { id: 'volume', label: 'VOL' },
  { id: 'minimal', label: 'MINIMAL SITE', tint: PAUSE_SWITCH_TINT },
  { id: 'exit', label: 'EXIT TO TITLE' },
];

const VOLUME_ROW = ROWS.findIndex((r) => r.id === 'volume');

const W = 176;
/** Last row's baseline, plus a bottom margin matching the side padding. */
const H = FIRST_ROW + ROWS.length * ROW_H + PAD;
const X = Math.floor((VIEW_W - W) / 2);
const Y = Math.floor((VIEW_H - H) / 2);

/** Track geometry for the volume slider, relative to the window. */
const PCT_W = 34;
const BAR_X = PAD + 46;
const BAR_W = W - BAR_X - PAD - PCT_W;
const BAR_H = 6;
const BAR_Y = FIRST_ROW + VOLUME_ROW * ROW_H + 4;

/** Volume moves in tenths, so keyboard and tap agree on the same 11 stops. */
const STEP = 0.1;

/**
 * The pause overlay: sound, volume, and a way back to the title screen.
 *
 * Every row is reachable three ways — arrow keys, mouse, and touch — because
 * the game has no other settings surface and a phone has no Escape key.
 */
export class PauseMenu {
  private scene: Phaser.Scene;
  private dim: Phaser.GameObjects.Rectangle;
  private container: Phaser.GameObjects.Container;
  private cursor: Phaser.GameObjects.Image;
  private soundValue: Phaser.GameObjects.BitmapText;
  private barFill: Phaser.GameObjects.Rectangle;
  private barKnob: Phaser.GameObjects.Rectangle;
  private barHit: Phaser.GameObjects.Zone;
  private pct: Phaser.GameObjects.BitmapText;
  private labels: Phaser.GameObjects.BitmapText[] = [];

  private rows: RowId[] = ROWS.map((r) => r.id);
  private index = 0;
  private open = false;
  private dragging = false;

  onClose?: () => void;
  onExit?: () => void;
  onMinimal?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Swallows taps on the world behind the menu as well as dimming it.
    this.dim = scene.add
      .rectangle(0, 0, VIEW_W, VIEW_H, 0x101018, 0.65)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(13000)
      .setVisible(false)
      .setInteractive();

    const frame = scene.add
      .nineslice(0, 0, 'atlas-game', 'window-frame', W, H, 6, 6, 6, 6)
      .setOrigin(0, 0);

    const title = scene.add.bitmapText(W / 2, 8, 'font-main', 'MENU').setOrigin(0.5, 0);

    const labels = ROWS.map((r, i) => this.label(r.label, i));

    this.soundValue = scene.add
      .bitmapText(W - PAD, FIRST_ROW + this.rows.indexOf('sound') * ROW_H, 'font-main', '')
      .setOrigin(1, 0);

    const barTrack = scene.add
      .rectangle(BAR_X, BAR_Y, BAR_W, BAR_H, 0xd8e0e8)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x404868);
    this.barFill = scene.add.rectangle(BAR_X + 1, BAR_Y + 1, 0, BAR_H - 2, 0x4890d8).setOrigin(0, 0);
    this.barKnob = scene.add.rectangle(BAR_X, BAR_Y - 2, 3, BAR_H + 4, 0x404868).setOrigin(0.5, 0);
    // font-small is baked light so it reads over the map; on the menu's white
    // field it has to be tinted down to the UI text colour.
    this.pct = scene.add
      .bitmapText(W - PAD, FIRST_ROW + VOLUME_ROW * ROW_H, 'font-small', '')
      .setOrigin(1, 0)
      .setTint(0x404868);

    // A 6px-tall track is not a touch target. The grab area is the full row.
    this.barHit = scene.add
      .zone(BAR_X - 6, BAR_Y - 7, BAR_W + 12, BAR_H + 14)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    this.labels = labels;
    // Centred on the row, not hung off its top-left corner. The arrow is 8px
    // tall and a line of text is twice that, so anchoring both at y=0 leaves
    // the arrow pointing at the tops of the letters.
    this.cursor = scene.add.image(4, FIRST_ROW, 'atlas-game', 'cursor').setOrigin(0, 0.5);

    this.container = scene.add
      .container(X, Y, [
        frame, title,
        ...labels, this.soundValue,
        this.pct, barTrack, this.barFill, this.barKnob, this.barHit,
        this.cursor,
      ])
      .setScrollFactor(0)
      .setDepth(13100)
      .setVisible(false);

    this.wirePointer(labels);
  }

  private label(text: string, row: number): Phaser.GameObjects.BitmapText {
    const t = this.scene.add
      .bitmapText(PAD, FIRST_ROW + row * ROW_H, 'font-main', text)
      .setOrigin(0, 0);
    const tint = ROWS[row]?.tint;
    if (tint !== undefined) t.setTint(tint);
    return t;
  }

  private wirePointer(labels: Phaser.GameObjects.BitmapText[]): void {
    labels.forEach((l, i) => {
      // Hit area spans the window's full width so the whole row is clickable,
      // not just the glyphs.
      l.setInteractive(
        new Phaser.Geom.Rectangle(-PAD + 2, -3, W - 4, ROW_H),
        Phaser.Geom.Rectangle.Contains
      );
      l.on('pointerover', () => this.moveTo(i));
      l.on('pointerdown', () => {
        this.moveTo(i);
        // The volume row has no "activate" — dragging the bar is the action.
        if (this.rows[i] !== 'volume') this.activate();
      });
    });

    this.barHit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.moveTo(this.rows.indexOf('volume'));
      this.dragging = true;
      this.setVolumeFromPointer(p);
    });
    this.scene.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (this.dragging && this.open) this.setVolumeFromPointer(p);
    });
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, () => {
      this.dragging = false;
    });
  }

  private setVolumeFromPointer(p: Phaser.Input.Pointer): void {
    // Pointer coordinates are already in game units; the container is fixed to
    // the camera, so its own offset is all that has to come out.
    const local = p.x - X - BAR_X;
    const v = Math.round((local / BAR_W) * 10) / 10;
    this.setVolume(v, false);
  }

  // -------------------------------------------------------------------------

  get isOpen(): boolean {
    return this.open;
  }

  show(): void {
    this.open = true;
    this.index = 0;
    this.dim.setVisible(true);
    this.container.setVisible(true);
    this.refresh();
  }

  hide(): void {
    this.open = false;
    this.dragging = false;
    this.dim.setVisible(false);
    this.container.setVisible(false);
  }

  move(delta: number): void {
    if (!this.open) return;
    this.index = (this.index + delta + this.rows.length) % this.rows.length;
    this.refresh();
    Audio.play('sfx-select', 0.3);
  }

  private moveTo(index: number): void {
    if (!this.open || index === this.index || index < 0) return;
    this.index = index;
    this.refresh();
    Audio.play('sfx-select', 0.3);
  }

  /** Left/right on the volume row; ignored elsewhere. */
  nudge(delta: number): boolean {
    if (!this.open || this.rows[this.index] !== 'volume') return false;
    this.setVolume(Audio.volume + delta * STEP, true);
    return true;
  }

  private setVolume(v: number, quiet: boolean): void {
    const before = Audio.volume;
    Audio.setVolume(v);
    if (Audio.volume === before) return;
    // Un-mute on any deliberate move off zero, otherwise the slider appears
    // broken: it moves and nothing is audible.
    if (Audio.volume > 0 && Audio.muted) Audio.setMuted(false);
    this.refresh();
    if (!quiet) return;
    Audio.play('sfx-select', 0.3);
  }

  activate(): void {
    if (!this.open) return;
    switch (this.rows[this.index]) {
      case 'sound':
        Audio.toggleMute();
        Audio.play('sfx-select', 0.4);
        this.refresh();
        break;
      case 'minimal':
        Audio.play('sfx-select', 0.45);
        this.onMinimal?.();
        break;
      case 'exit':
        Audio.play('sfx-select', 0.45);
        this.onExit?.();
        break;
      case 'close':
        Audio.play('sfx-select', 0.4);
        this.onClose?.();
        break;
      case 'volume':
        break;
    }
  }

  private refresh(): void {
    const row = this.labels[this.index];
    if (row) this.cursor.y = row.y + row.height / 2;
    this.soundValue.setText(Audio.muted ? 'OFF' : 'ON');

    const v = Audio.muted ? 0 : Audio.volume;
    this.barFill.width = Math.round((BAR_W - 2) * v);
    this.barKnob.x = BAR_X + Math.round(BAR_W * v);
    this.pct.setText(`${Math.round(v * 100)}%`);
  }

  destroy(): void {
    this.dim.destroy();
    this.container.destroy();
  }
}
