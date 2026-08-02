import Phaser from 'phaser';
import { TILE } from '../data/maps';
import { DIR_ROW, DIR_VEC, type Direction } from '../types';

// --- Movement constants. These are the feel of the game; do not tune casually.
export const WALK_MS = 250;  // ~FireRed's 16 frames at 60fps
export const RUN_MS = 130;   // ~8 frames
export const TURN_MS = 80;
export const BUFFER_WINDOW_MS = 80;
export const LEDGE_MS = 400;

export type MoveState = 'idle' | 'turning' | 'moving';

export type BlockedFn = (tx: number, ty: number, by: GridEntity) => boolean;

/**
 * A character locked to the 16px grid.
 *
 * Every mover in the game — the player, every NPC, and every click-path step —
 * goes through `tryStep`. There is exactly one movement code path, which is why
 * keyboard and click movement can never desync from collision or animation.
 */
export class GridEntity {
  readonly sprite: Phaser.GameObjects.Sprite;
  tileX: number;
  tileY: number;
  facing: Direction;
  state: MoveState = 'idle';
  running = false;

  /** Set by the owning scene; returns true if the tile cannot be entered. */
  isBlocked: BlockedFn = () => false;

  protected scene: Phaser.Scene;
  protected textureKey: string;
  private tween?: Phaser.Tweens.Tween;
  private turnTimer = 0;
  private stepParity = 0;
  private onArriveCbs: Array<() => void> = [];

  constructor(
    scene: Phaser.Scene,
    textureKey: string,
    tileX: number,
    tileY: number,
    facing: Direction = 'down'
  ) {
    this.scene = scene;
    this.textureKey = textureKey;
    this.tileX = tileX;
    this.tileY = tileY;
    this.facing = facing;

    this.sprite = scene.add.sprite(0, 0, textureKey, 0);
    // Origin at the feet: the sprite is 16x24 but occupies one 16x16 tile.
    this.sprite.setOrigin(0.5, 1);
    this.snapToTile();
    this.setIdleFrame();
  }

  // --- geometry -----------------------------------------------------------

  get pixelX(): number { return this.tileX * TILE + TILE / 2; }
  get pixelY(): number { return (this.tileY + 1) * TILE; }

  snapToTile(): void {
    this.sprite.x = this.pixelX;
    this.sprite.y = this.pixelY;
    this.sprite.depth = this.sprite.y;
  }

  /** The tile this entity is looking at. */
  facingTile(): { x: number; y: number } {
    const v = DIR_VEC[this.facing];
    return { x: this.tileX + v.x, y: this.tileY + v.y };
  }

  // --- animation ----------------------------------------------------------

  private animKey(kind: 'walk' | 'run', dir: Direction): string {
    return `${this.textureKey}-${kind}-${dir}`;
  }

  protected setIdleFrame(): void {
    this.sprite.stop();
    // Neutral frame of the current direction's walk row.
    this.sprite.setFrame(DIR_ROW[this.facing] * 3);
  }

  private playMoveAnim(): void {
    const kind = this.running ? 'run' : 'walk';
    const key = this.animKey(kind, this.facing);
    if (this.scene.anims.exists(key)) {
      this.sprite.play({ key, startFrame: this.stepParity ? 3 : 1 }, true);
    }
  }

  // --- movement -----------------------------------------------------------

  /**
   * Turn to face `dir` without moving. This is the behaviour whose absence is
   * the single biggest tell that a Pokemon-style clone is not authentic: the
   * first press in a new direction turns, it does not step.
   */
  turn(dir: Direction): void {
    if (this.facing === dir) return;
    this.facing = dir;
    this.state = 'turning';
    this.turnTimer = TURN_MS;
    this.setIdleFrame();
  }

  /**
   * Attempt one tile step. Returns false if blocked or busy.
   * @param dir direction to move
   * @param opts.ignoreTurn skip the turn-in-place beat (used by path following,
   *   which has already committed to the route)
   */
  tryStep(dir: Direction, opts: { ignoreTurn?: boolean; run?: boolean } = {}): boolean {
    if (this.state !== 'idle') return false;

    if (this.facing !== dir && !opts.ignoreTurn) {
      this.turn(dir);
      return false;
    }
    this.facing = dir;
    this.running = !!opts.run;

    const v = DIR_VEC[dir];
    const nx = this.tileX + v.x;
    const ny = this.tileY + v.y;

    if (this.isBlocked(nx, ny, this)) {
      this.onBump(nx, ny);
      return false;
    }

    this.state = 'moving';
    this.stepParity ^= 1;
    this.playMoveAnim();

    const duration = this.running ? RUN_MS : WALK_MS;
    const targetX = nx * TILE + TILE / 2;
    const targetY = (ny + 1) * TILE;

    this.tween = this.scene.tweens.add({
      targets: this.sprite,
      x: targetX,
      y: targetY,
      duration,
      ease: 'Linear', // GBA movement is linear; easing reads as modern and wrong
      onComplete: () => {
        this.tileX = nx;
        this.tileY = ny;
        this.snapToTile();
        this.state = 'idle';
        this.tween = undefined;
        this.afterArrive();
      },
    });
    return true;
  }

  /** Two-tile hop with an arc, used for one-way ledges. */
  hopLedge(dir: Direction): boolean {
    if (this.state !== 'idle') return false;
    const v = DIR_VEC[dir];
    const nx = this.tileX + v.x * 2;
    const ny = this.tileY + v.y * 2;
    this.facing = dir;
    this.state = 'moving';
    this.playMoveAnim();

    const startY = this.sprite.y;
    const targetX = nx * TILE + TILE / 2;
    const targetY = (ny + 1) * TILE;
    const obj = { t: 0 };
    this.tween = this.scene.tweens.add({
      targets: obj,
      t: 1,
      duration: LEDGE_MS,
      ease: 'Linear',
      onUpdate: () => {
        this.sprite.x = Phaser.Math.Linear(this.pixelX, targetX, obj.t);
        const flat = Phaser.Math.Linear(startY, targetY, obj.t);
        this.sprite.y = flat - Math.sin(obj.t * Math.PI) * 10;
        this.sprite.depth = flat;
      },
      onComplete: () => {
        this.tileX = nx;
        this.tileY = ny;
        this.snapToTile();
        this.state = 'idle';
        this.tween = undefined;
        this.afterArrive();
      },
    });
    return true;
  }

  /** True while the current step is close enough to completion to buffer input. */
  inBufferWindow(): boolean {
    if (this.state !== 'moving' || !this.tween) return false;
    const total = this.running ? RUN_MS : WALK_MS;
    return this.tween.elapsed >= total - BUFFER_WINDOW_MS;
  }

  onArrive(cb: () => void): void {
    this.onArriveCbs.push(cb);
  }

  /** Fire once on the next arrival, then forget. */
  onArriveOnce(cb: () => void): void {
    this.onceCbs.push(cb);
  }

  private onceCbs: Array<() => void> = [];

  /** Face a direction immediately, with no turn delay. */
  face(dir: Direction): void {
    this.facing = dir;
    if (this.state === 'idle') this.setIdleFrame();
  }

  private afterArrive(): void {
    this.setIdleFrame();
    for (const cb of this.onArriveCbs) cb();
    const once = this.onceCbs;
    this.onceCbs = [];
    for (const cb of once) cb();
  }

  protected onBump(_tx: number, _ty: number): void {
    /* overridden by Player to play the bump sfx */
  }

  /** Cancel any motion immediately and snap to the nearest whole tile. */
  halt(): void {
    this.tween?.remove();
    this.tween = undefined;
    this.state = 'idle';
    this.snapToTile();
    this.setIdleFrame();
  }

  update(dtMs: number): void {
    if (this.state === 'turning') {
      this.turnTimer -= dtMs;
      if (this.turnTimer <= 0) this.state = 'idle';
    }
    if (this.state === 'moving') this.sprite.depth = this.sprite.y;
  }

  destroy(): void {
    this.tween?.remove();
    this.sprite.destroy();
  }
}

/**
 * Registers walk/run animations for a character texture.
 * Sheet layout: 3 columns x 4 rows walk, then 4 rows run.
 * Cycle is neutral -> stepA -> neutral -> stepB, which is how FireRed reads.
 */
export function registerCharacterAnims(
  scene: Phaser.Scene,
  textureKey: string,
  hasRun: boolean
): void {
  const dirs: Direction[] = ['down', 'up', 'left', 'right'];
  dirs.forEach((dir) => {
    const base = DIR_ROW[dir] * 3;
    const key = `${textureKey}-walk-${dir}`;
    if (!scene.anims.exists(key)) {
      scene.anims.create({
        key,
        frames: [base, base + 1, base, base + 2].map((f) => ({ key: textureKey, frame: f })),
        frameRate: 8, // two frames per 250ms step
        repeat: -1,
      });
    }
    if (!hasRun) return;
    const runBase = 12 + DIR_ROW[dir] * 3;
    const runKey = `${textureKey}-run-${dir}`;
    if (!scene.anims.exists(runKey)) {
      scene.anims.create({
        key: runKey,
        frames: [runBase, runBase + 1, runBase, runBase + 2].map((f) => ({ key: textureKey, frame: f })),
        frameRate: 15, // two frames per 130ms step
        repeat: -1,
      });
    }
  });
}
