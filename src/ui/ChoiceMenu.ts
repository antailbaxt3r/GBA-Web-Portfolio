import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../data/maps';
import { Audio } from '../systems/AudioManager';
import type { Choice } from '../data/content';

const ROW_H = 14;
const PAD = 10;

/** FireRed's right-aligned selection window with the red cursor. */
export class ChoiceMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private frame: Phaser.GameObjects.NineSlice;
  private cursor: Phaser.GameObjects.Image;
  private labels: Phaser.GameObjects.BitmapText[] = [];
  private choices: Choice[] = [];
  private index = 0;
  private open = false;

  onSelect?: (choice: Choice, index: number) => void;
  onCancel?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.frame = scene.add
      .nineslice(0, 0, 'atlas-game', 'menu-frame', 80, 40, 6, 6, 6, 6)
      .setOrigin(0, 0);
    this.cursor = scene.add.image(4, 0, 'atlas-game', 'cursor').setOrigin(0, 0);
    this.container = scene.add
      .container(0, 0, [this.frame, this.cursor])
      .setScrollFactor(0)
      .setDepth(10500)
      .setVisible(false);
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(choices: Choice[]): void {
    this.clearLabels();
    this.choices = choices;
    this.index = 0;

    let maxW = 0;
    choices.forEach((c, i) => {
      const t = this.scene.add
        .bitmapText(PAD + 4, PAD - 4 + i * ROW_H, 'font-main', c.label)
        .setOrigin(0, 0);
      maxW = Math.max(maxW, t.width);
      this.labels.push(t);
      this.container.add(t);
    });

    const w = Math.max(64, maxW + PAD * 2 + 6);
    const h = choices.length * ROW_H + PAD + 2;
    this.frame.setSize(w, h);
    this.container.setPosition(VIEW_W - w - 4, VIEW_H - h - 56);
    this.container.setVisible(true);
    this.open = true;
    this.updateCursor();
  }

  private clearLabels(): void {
    for (const l of this.labels) l.destroy();
    this.labels = [];
  }

  private updateCursor(): void {
    this.cursor.setPosition(4, PAD - 4 + this.index * ROW_H);
  }

  move(delta: number): void {
    if (!this.open || !this.choices.length) return;
    this.index = (this.index + delta + this.choices.length) % this.choices.length;
    this.updateCursor();
    Audio.play('sfx-select', 0.3);
  }

  confirm(): void {
    if (!this.open) return;
    const choice = this.choices[this.index];
    if (!choice) return;
    Audio.play('sfx-select', 0.45);
    this.onSelect?.(choice, this.index);
  }

  cancel(): void {
    if (!this.open) return;
    this.onCancel?.();
  }

  hide(): void {
    this.open = false;
    this.container.setVisible(false);
    this.clearLabels();
  }

  destroy(): void {
    this.clearLabels();
    this.container.destroy();
  }
}
