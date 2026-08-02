import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../data/maps';
import type { TransitionKind } from '../types';

const DOOR_FADE_MS = 300;
const IRIS_MS = 550;
const BLINDS_MS = 500;
const WATCHDOG_MS = 3000;

/**
 * Screen transitions.
 *
 * The PRD specified a single mask-texture shader. Phaser 4 replaced the v3
 * pipeline system with render nodes and folded masks into filters, so a custom
 * shader is the highest-risk thing in the codebase for the least visual gain.
 * These are built from plain Graphics instead: identical on screen, and they
 * cannot break when the renderer changes.
 *
 * Every transition is watchdogged — a stalled transition must never leave input
 * permanently locked.
 */
export class TransitionSystem {
  private scene: Phaser.Scene;
  private gfx: Phaser.GameObjects.Graphics;
  private active = false;
  private watchdog?: Phaser.Time.TimerEvent;
  private tween?: Phaser.Tweens.Tween;
  private finish?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.gfx = scene.add.graphics();
    this.gfx.setScrollFactor(0).setDepth(20000).setVisible(false);
  }

  get isActive(): boolean {
    return this.active;
  }

  /** Cover the screen. Resolves when fully opaque. */
  cover(kind: TransitionKind): Promise<void> {
    return this.run(kind, 'out');
  }

  /** Uncover the screen. Resolves when fully clear. */
  reveal(kind: TransitionKind): Promise<void> {
    return this.run(kind, 'in');
  }

  private run(kind: TransitionKind, phase: 'in' | 'out'): Promise<void> {
    this.cancel();
    this.active = true;
    this.gfx.setVisible(true);

    return new Promise<void>((resolve) => {
      const done = () => {
        if (!this.active) return;
        this.active = false;
        this.watchdog?.remove();
        this.watchdog = undefined;
        this.tween = undefined;
        this.finish = undefined;
        if (phase === 'in') {
          this.gfx.clear();
          this.gfx.setVisible(false);
        } else {
          this.drawFull();
        }
        resolve();
      };
      this.finish = done;

      // If anything stalls (backgrounded tab, dropped frame), force completion.
      this.watchdog = this.scene.time.delayedCall(WATCHDOG_MS, done);

      const duration = kind === 'blinds' ? BLINDS_MS : kind === 'circle' ? IRIS_MS : DOOR_FADE_MS;
      const state = { t: phase === 'out' ? 0 : 1 };
      this.tween = this.scene.tweens.add({
        targets: state,
        t: phase === 'out' ? 1 : 0,
        duration,
        ease: 'Linear',
        onUpdate: () => this.draw(kind, state.t),
        onComplete: done,
      });
      this.draw(kind, state.t);
    });
  }

  /** t = 0 fully clear, t = 1 fully black. */
  private draw(kind: TransitionKind, t: number): void {
    const g = this.gfx;
    g.clear();
    if (t <= 0) return;
    if (t >= 1) return this.drawFull();

    switch (kind) {
      case 'circle': {
        // Iris: fill everything outside a shrinking circle. Built from wedges,
        // which needs nothing beyond fillPath.
        const cx = VIEW_W / 2;
        const cy = VIEW_H / 2;
        const maxR = Math.hypot(VIEW_W, VIEW_H) / 2 + 4;
        const r = maxR * (1 - t);
        const SEGMENTS = 48;
        g.fillStyle(0x000000, 1);
        for (let i = 0; i < SEGMENTS; i++) {
          const a0 = (i / SEGMENTS) * Math.PI * 2;
          const a1 = ((i + 1) / SEGMENTS) * Math.PI * 2;
          g.beginPath();
          g.moveTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
          g.lineTo(cx + Math.cos(a0) * maxR, cy + Math.sin(a0) * maxR);
          g.lineTo(cx + Math.cos(a1) * maxR, cy + Math.sin(a1) * maxR);
          g.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
          g.closePath();
          g.fillPath();
        }
        break;
      }
      case 'blinds': {
        const BANDS = 8;
        const bandH = VIEW_H / BANDS;
        g.fillStyle(0x000000, 1);
        for (let i = 0; i < BANDS; i++) {
          g.fillRect(0, i * bandH, VIEW_W, Math.ceil(bandH * t));
        }
        break;
      }
      default: {
        g.fillStyle(0x000000, t);
        g.fillRect(0, 0, VIEW_W, VIEW_H);
      }
    }
  }

  private drawFull(): void {
    this.gfx.clear();
    this.gfx.fillStyle(0x000000, 1);
    this.gfx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  /** Force-complete anything in flight (scene shutdown, interruption). */
  cancel(): void {
    this.tween?.remove();
    this.tween = undefined;
    this.watchdog?.remove();
    this.watchdog = undefined;
    const f = this.finish;
    this.finish = undefined;
    this.active = false;
    f?.();
  }

  destroy(): void {
    this.cancel();
    this.gfx.destroy();
  }
}
