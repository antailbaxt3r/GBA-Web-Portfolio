import Phaser from 'phaser';
import type { Direction } from '../types';

export type Intent = 'confirm' | 'cancel' | 'menu';

/**
 * Normalises keyboard, touch and pointer input into one intent stream, so no
 * downstream system knows or cares where the input came from.
 *
 * Arrows and WASD are simultaneously live — there is no mode switch.
 */
export class InputController {
  private scene: Phaser.Scene;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private held = new Set<Direction>();
  /** Direction press order; the most recent wins, so diagonals resolve cleanly. */
  private order: Direction[] = [];
  private justPressed = new Set<Intent>();
  private locked = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    if (!kb) return;

    const map: Record<string, string> = {
      up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT',
      w: 'W', a: 'A', s: 'S', d: 'D',
      z: 'Z', x: 'X', enter: 'ENTER', space: 'SPACE',
      esc: 'ESC', shift: 'SHIFT', backspace: 'BACKSPACE',
    };
    for (const [name, code] of Object.entries(map)) {
      this.keys[name] = kb.addKey(code, true, true);
    }

    // Stop the page scrolling out from under the canvas.
    kb.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE', 'W', 'A', 'S', 'D', 'Z', 'X', 'ENTER']);

    // A blurred window must not leave a key stuck down.
    this.scene.game.events.on(Phaser.Core.Events.BLUR, this.clear, this);
    kb.on('keydown', this.onKeyDown, this);
  }

  /**
   * Presses are latched on the keydown event rather than polled with
   * Phaser.Input.Keyboard.JustDown. JustDown reads a flag that Key.onUp clears,
   * so a press and release landing in the same tick — a fast tap, or any
   * synthetic input — is silently dropped.
   */
  private onKeyDown(ev: KeyboardEvent): void {
    const dir = this.codeToDir(ev.code);
    if (dir) {
      this.order = this.order.filter((d) => d !== dir);
      this.order.push(dir);
      this.dirPressed = true;
      this.latchedDir = dir;
      return;
    }
    switch (ev.code) {
      case 'KeyZ': case 'Enter': case 'Space':
        this.justPressed.add('confirm');
        break;
      case 'KeyX': case 'Escape': case 'Backspace':
        this.justPressed.add('cancel');
        break;
      default:
        break;
    }
  }

  private dirPressed = false;
  private latchedDir: Direction | null = null;

  /**
   * The most recent direction *keydown*, consumed on read.
   *
   * Menus need this rather than direction(): that one polls `isDown`, so a
   * press and release inside a single frame never registers. Walking can poll
   * safely because a step that short would be invisible anyway, but a dropped
   * menu keystroke reads as the UI ignoring you.
   */
  takeDirection(): Direction | null {
    if (this.locked) return null;
    const d = this.latchedDir;
    this.latchedDir = null;
    return d;
  }

  private codeToDir(code: string): Direction | null {
    switch (code) {
      case 'ArrowUp': case 'KeyW': return 'up';
      case 'ArrowDown': case 'KeyS': return 'down';
      case 'ArrowLeft': case 'KeyA': return 'left';
      case 'ArrowRight': case 'KeyD': return 'right';
      default: return null;
    }
  }

  setLocked(v: boolean): void {
    this.locked = v;
    if (v) this.clear();
  }

  clear(): void {
    this.held.clear();
    this.order.length = 0;
    this.justPressed.clear();
    this.dirPressed = false;
    this.latchedDir = null;
  }

  /** Raise an intent from a source other than the keyboard — a screen tap. */
  pressTouch(intent: Intent): void {
    this.justPressed.add(intent);
  }

  /** The direction currently being requested, or null. */
  direction(): Direction | null {
    if (this.locked) return null;

    this.held.clear();
    if (this.keys.up?.isDown || this.keys.w?.isDown) this.held.add('up');
    if (this.keys.down?.isDown || this.keys.s?.isDown) this.held.add('down');
    if (this.keys.left?.isDown || this.keys.a?.isDown) this.held.add('left');
    if (this.keys.right?.isDown || this.keys.d?.isDown) this.held.add('right');
    if (this.held.size === 0) return null;

    // Most recently pressed direction that is still held.
    for (let i = this.order.length - 1; i >= 0; i--) {
      const d = this.order[i]!;
      if (this.held.has(d)) return d;
    }
    return [...this.held][0] ?? null;
  }

  isRunning(): boolean {
    if (this.locked) return false;
    return !!this.keys.shift?.isDown || !!this.keys.x?.isDown;
  }

  /** Edge-triggered. Consumes the press. */
  pressed(intent: Intent): boolean {
    if (this.locked) {
      this.justPressed.clear();
      return false;
    }
    if (this.justPressed.has(intent)) {
      this.justPressed.delete(intent);
      return true;
    }
    return false;
  }

  /** True if any movement key was pressed this frame — used to cancel click-paths. */
  anyDirectionPressed(): boolean {
    if (this.locked) return false;
    const v = this.dirPressed;
    this.dirPressed = false;
    return v;
  }

  destroy(): void {
    this.scene.game.events.off(Phaser.Core.Events.BLUR, this.clear, this);
    this.scene.input.keyboard?.off('keydown', this.onKeyDown, this);
  }
}
