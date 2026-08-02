import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../data/maps';
import type { Direction } from '../types';

const DPAD = 60;
const BTN = 28;

/**
 * On-screen D-pad and A/B buttons. Only ever shown once a real touch event has
 * been seen — never from user-agent sniffing, so a touchscreen laptop does not
 * get controls it did not ask for.
 */
export class TouchControls {
  private scene: Phaser.Scene;
  private dpad: Phaser.GameObjects.Image;
  private btnA: Phaser.GameObjects.Image;
  private btnB: Phaser.GameObjects.Image;
  private dpadZone: Phaser.GameObjects.Zone;
  private enabled = false;
  private activePointer: number | null = null;

  onDirection?: (dir: Direction | null) => void;
  onA?: () => void;
  onB?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const dx = 5;
    const dy = VIEW_H - DPAD - 5;
    this.dpad = scene.add.image(dx, dy, 'dpad').setOrigin(0, 0).setScrollFactor(0).setDepth(11000);

    // Hit area is 25% larger than the art so thumbs are forgiving.
    const pad = DPAD * 0.125;
    this.dpadZone = scene.add
      .zone(dx - pad, dy - pad, DPAD + pad * 2, DPAD + pad * 2)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: false });

    this.btnA = scene.add
      .image(VIEW_W - BTN - 6, VIEW_H - BTN - 10, 'btn-a')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(11000)
      .setInteractive({ useHandCursor: false });

    this.btnB = scene.add
      .image(VIEW_W - BTN * 2 - 12, VIEW_H - BTN - 26, 'btn-b')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(11000)
      .setInteractive({ useHandCursor: false });

    this.dpadZone.on('pointerdown', this.onPadDown, this);
    this.dpadZone.on('pointermove', this.onPadMove, this);
    this.dpadZone.on('pointerup', this.onPadUp, this);
    this.dpadZone.on('pointerout', this.onPadUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPadUp, this);

    this.btnA.on('pointerdown', () => this.onA?.());
    this.btnB.on('pointerdown', () => this.onB?.());

    this.setVisible(false);

    // Reveal on the first genuine touch.
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (!this.enabled && p.wasTouch) {
        this.enabled = true;
        this.setVisible(true);
      }
    });
  }

  private dirFromPointer(p: Phaser.Input.Pointer): Direction | null {
    const cx = this.dpad.x + DPAD / 2;
    const cy = this.dpad.y + DPAD / 2;
    const cam = this.scene.cameras.main;
    const px = (p.x - cam.x) / cam.zoom + cam.scrollX;
    const py = (p.y - cam.y) / cam.zoom + cam.scrollY;
    const dx = px - cx;
    const dy = py - cy;
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return null;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  }

  private onPadDown(p: Phaser.Input.Pointer): void {
    this.activePointer = p.id;
    this.onDirection?.(this.dirFromPointer(p));
  }

  private onPadMove(p: Phaser.Input.Pointer): void {
    if (this.activePointer !== p.id) return;
    this.onDirection?.(this.dirFromPointer(p));
  }

  private onPadUp(p?: Phaser.Input.Pointer): void {
    if (p && this.activePointer !== null && p.id !== this.activePointer) return;
    this.activePointer = null;
    this.onDirection?.(null);
  }

  setVisible(v: boolean): void {
    this.dpad.setVisible(v);
    this.btnA.setVisible(v);
    this.btnB.setVisible(v);
    this.dpadZone.setActive(v);
    if (v) this.dpadZone.setInteractive();
    else this.dpadZone.disableInteractive();
  }

  /** Movement is locked during dialogue, so hide the pad but keep A/B. */
  setDialogueMode(on: boolean): void {
    if (!this.enabled) return;
    this.dpad.setVisible(!on);
    if (on) {
      this.dpadZone.disableInteractive();
      this.onDirection?.(null);
    } else {
      this.dpadZone.setInteractive();
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }
}
