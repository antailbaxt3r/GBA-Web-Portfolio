import Phaser from 'phaser';
import { GridEntity } from './GridEntity';
import { DIRECTIONS, OPPOSITE, type Direction } from '../types';
import type { NpcObject } from '../types';

/**
 * NPCs reuse GridEntity wholesale — they are grid movers with a scripted
 * intent source instead of an input source.
 */
export class NPC extends GridEntity {
  readonly contentId: string;
  private movement: NpcObject['movement'];
  private bounds?: { x: number; y: number; w: number; h: number };
  private timer: number;
  private frozen = false;
  private homeFacing: Direction;

  constructor(scene: Phaser.Scene, def: NpcObject) {
    super(scene, def.sprite, def.x / 16, def.y / 16, def.facing);
    this.contentId = def.contentId;
    this.movement = def.movement;
    this.bounds = def.wander;
    this.homeFacing = def.facing;
    this.timer = this.nextDelay();
  }

  private nextDelay(): number {
    return this.movement === 'wander'
      ? Phaser.Math.Between(2000, 5000)
      : Phaser.Math.Between(2000, 4000);
  }

  /** Halt and face the player while a conversation is open. */
  freeze(lookAt?: Direction): void {
    this.frozen = true;
    if (this.state === 'idle' && lookAt) {
      this.facing = lookAt;
      this.setIdleFrame();
    }
  }

  unfreeze(): void {
    this.frozen = false;
    this.timer = this.nextDelay();
    if (this.state === 'idle' && this.movement === 'static') {
      this.facing = this.homeFacing;
      this.setIdleFrame();
    }
  }

  override update(dtMs: number): void {
    super.update(dtMs);
    if (this.frozen || this.movement === 'static') return;
    if (this.state !== 'idle') return;

    this.timer -= dtMs;
    if (this.timer > 0) return;
    this.timer = this.nextDelay();

    if (this.movement === 'lookAround') {
      const dir = DIRECTIONS[Phaser.Math.Between(0, 3)]!;
      if (dir !== this.facing) {
        this.facing = dir;
        this.setIdleFrame();
      }
      return;
    }

    // wander: pick a direction that keeps us inside our patch
    const dir = DIRECTIONS[Phaser.Math.Between(0, 3)]!;
    if (!this.withinBounds(dir)) {
      this.facing = OPPOSITE[dir];
      this.setIdleFrame();
      return;
    }
    this.tryStep(dir, { ignoreTurn: true });
  }

  private withinBounds(dir: Direction): boolean {
    if (!this.bounds) return true;
    const v = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[dir]!;
    const nx = this.tileX + v[0]!;
    const ny = this.tileY + v[1]!;
    return (
      nx >= this.bounds.x &&
      ny >= this.bounds.y &&
      nx < this.bounds.x + this.bounds.w &&
      ny < this.bounds.y + this.bounds.h
    );
  }
}
