import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../data/maps';
import { SaveState, TEXT_SPEED_MS } from '../systems/SaveState';
import { Audio } from '../systems/AudioManager';

const BOX_X = 4;
const BOX_W = VIEW_W - 8;
const BOX_H = 46;
const BOX_Y = VIEW_H - BOX_H - 6;
const PAD_X = 9;
const LINE_1 = 9;
const LINE_2 = 23;
const LINES_PER_PAGE = 2;

/**
 * The FireRed text box.
 *
 * Two behaviours matter and are easy to get wrong:
 *  - confirm during the reveal COMPLETES the page; it does not advance.
 *    A second confirm advances. Anything else feels broken.
 *  - pages are computed from wrapped lines, not hand-split in content.
 */
export class DialogueBox {
  private container: Phaser.GameObjects.Container;
  private line1: Phaser.GameObjects.BitmapText;
  private line2: Phaser.GameObjects.BitmapText;
  private arrow: Phaser.GameObjects.Image;
  private measure: Phaser.GameObjects.BitmapText;

  private pages: string[][] = [];
  private pageIndex = 0;
  private revealed = 0;
  private revealTimer = 0;
  private complete = false;
  private open = false;

  onPageShown?: (text: string) => void;

  constructor(scene: Phaser.Scene) {
    const frame = scene.add
      .nineslice(0, 0, 'atlas-game', 'window-frame', BOX_W, BOX_H, 6, 6, 6, 6)
      .setOrigin(0, 0);

    this.line1 = scene.add.bitmapText(PAD_X, LINE_1, 'font-main', '').setOrigin(0, 0);
    this.line2 = scene.add.bitmapText(PAD_X, LINE_2, 'font-main', '').setOrigin(0, 0);
    this.arrow = scene.add
      .image(BOX_W - 12, BOX_H - 10, 'atlas-game', 'advance-arrow')
      .setOrigin(0, 0)
      .setVisible(false);

    this.container = scene.add
      .container(BOX_X, BOX_Y, [frame, this.line1, this.line2, this.arrow])
      .setScrollFactor(0)
      .setDepth(10000)
      .setVisible(false);

    // Off-screen ruler for word wrapping; never rendered.
    this.measure = scene.add.bitmapText(-1000, -1000, 'font-main', '').setVisible(false);

    scene.tweens.add({
      targets: this.arrow,
      alpha: { from: 1, to: 0 },
      duration: 250,
      yoyo: true,
      repeat: -1,
      hold: 250,
    });
  }

  get isOpen(): boolean {
    return this.open;
  }

  get onLastPage(): boolean {
    return this.pageIndex >= this.pages.length - 1;
  }

  get pageComplete(): boolean {
    return this.complete;
  }

  private widthOf(s: string): number {
    this.measure.setText(s);
    return this.measure.width;
  }

  /** Greedy word wrap against the real glyph widths. */
  private wrap(text: string, maxWidth: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (this.widthOf(next) <= maxWidth) {
        cur = next;
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }

  show(paragraphs: string[]): void {
    const maxW = BOX_W - PAD_X * 2 - 4;
    const lines: string[] = [];
    for (const p of paragraphs) lines.push(...this.wrap(p, maxW));

    this.pages = [];
    for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
      this.pages.push(lines.slice(i, i + LINES_PER_PAGE));
    }
    this.pageIndex = 0;
    this.open = true;
    this.container.setVisible(true);
    this.startPage();
  }

  private startPage(): void {
    this.revealed = 0;
    this.revealTimer = 0;
    this.complete = false;
    this.arrow.setVisible(false);
    this.line1.setText('');
    this.line2.setText('');
    const page = this.pages[this.pageIndex];
    if (page) this.onPageShown?.(page.join(' '));
    if (TEXT_SPEED_MS[SaveState.get().settings.textSpeed] === 0) this.completePage();
  }

  private get pageChars(): number {
    const page = this.pages[this.pageIndex] ?? [];
    return page.reduce((n, l) => n + l.length, 0);
  }

  completePage(): void {
    const page = this.pages[this.pageIndex] ?? [];
    this.line1.setText(page[0] ?? '');
    this.line2.setText(page[1] ?? '');
    this.revealed = this.pageChars;
    this.complete = true;
    this.arrow.setVisible(true);
  }

  /** @returns true if there was another page to show */
  nextPage(): boolean {
    if (this.pageIndex >= this.pages.length - 1) return false;
    this.pageIndex++;
    this.startPage();
    return true;
  }

  hide(): void {
    this.open = false;
    this.container.setVisible(false);
    this.pages = [];
  }

  update(delta: number): void {
    if (!this.open || this.complete) return;
    const speed = TEXT_SPEED_MS[SaveState.get().settings.textSpeed];
    if (speed === 0) return this.completePage();

    this.revealTimer += delta;
    while (this.revealTimer >= speed && this.revealed < this.pageChars) {
      this.revealTimer -= speed;
      this.revealed++;
      if (this.revealed % 2 === 0) Audio.play('sfx-text', 0.18);
    }

    const page = this.pages[this.pageIndex] ?? [];
    const first = page[0] ?? '';
    const second = page[1] ?? '';
    this.line1.setText(first.slice(0, Math.min(this.revealed, first.length)));
    this.line2.setText(
      this.revealed > first.length ? second.slice(0, this.revealed - first.length) : ''
    );

    if (this.revealed >= this.pageChars) {
      this.complete = true;
      this.arrow.setVisible(true);
    }
  }

  destroy(): void {
    this.container.destroy();
    this.measure.destroy();
  }
}
